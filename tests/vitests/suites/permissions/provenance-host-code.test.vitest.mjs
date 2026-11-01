/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/provenance-host-code.test.vitest.mjs
 *	@Date: 2026-05-18T09:38:51-07:00 (1779122331)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-01T01:39:20-07:00 (1793522360)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `permissions.provenance` (#597) and the host's own code, under Node's own loader: host code a module's
 * call runs — a global function the host defined, an in-memory module whose functions are in the host's file, a host
 * callback, Node's own `util.inspect` reading a node — runs as that call, with provenance on as with it off. Under
 * vitest the host's files are transformed by vite and cannot be verified as their own source (#682), so the tests
 * that rely on host code there pin provenance off; this is where it is covered on.
 *
 * @module tests/vitests/suites/permissions/provenance-host-code
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ROOT = path.join(process.cwd(), "tmp", "provenance-host-code");
const PROBE = path.join(ROOT, "probe.mjs");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	for (const dir of ["vault", "m"]) mkdirSync(path.join(ROOT, "api", dir), { recursive: true });
	writeFileSync(
		path.join(ROOT, "api", "vault", "vault.mjs"),
		[
			"export const secret = 42;",
			"let calls = 0;",
			"export function log() {",
			"\tcalls++;",
			"}",
			"export function count() {",
			"\treturn calls;",
			"}",
			""
		].join("\n")
	);
	writeFileSync(
		path.join(ROOT, "api", "m", "m.mjs"),
		[
			'import util from "node:util";',
			'import fs from "node:fs";',
			'import { EventEmitter } from "node:events";',
			'import { Readable, Writable, pipeline } from "node:stream";',
			'import { self } from "@cldmv/slothlet/runtime";',
			"export async function callGlobal() {",
			"\treturn globalThis.__provenanceHostRead();",
			"}",
			"export async function run(fn) {",
			"\treturn fn();",
			"}",
			"export async function callMemory() {",
			"\treturn self.mem.read();",
			"}",
			// A module's own api function handed straight to Node as a callback, which Node's own code then calls.
			"export async function nodeCallback(kind) {",
			"\tconst before = self.vault.count();",
			"\tconst settled = new Promise((resolve) => setTimeout(resolve, 30));",
			"\tswitch (kind) {",
			'\t\tcase "readFile": fs.readFile(new URL(import.meta.url), self.vault.log); break;',
			'\t\tcase "stat": fs.stat(new URL(import.meta.url), self.vault.log); break;',
			'\t\tcase "pipeline": pipeline(Readable.from(["a"]), new Writable({ write(_c, _e, cb) { cb(); } }), self.vault.log); break;',
			'\t\tcase "data": Readable.from(["a"]).on("data", self.vault.log); break;',
			'\t\tcase "emit": { const emitter = new EventEmitter(); emitter.on("x", self.vault.log); emitter.emit("x"); break; }',
			'\t\tcase "then": Promise.resolve(1).then(self.vault.log); break;',
			"\t}",
			"\tawait settled;",
			"\treturn self.vault.count() > before;",
			"}",
			"export function inspectVault() {",
			'\treturn util.inspect(self.vault).includes("42");',
			"}",
			""
		].join("\n")
	);
	writeFileSync(
		PROBE,
		[
			'import slothlet from "@cldmv/slothlet";',
			'import { self } from "@cldmv/slothlet/runtime";',
			'const base = new URL("./api/", import.meta.url).pathname;',
			"globalThis.__provenanceHostRead = async () => self.vault.secret;",
			"const settle = (promise) => Promise.resolve(promise).then((value) => value, (error) => error.code ?? error.message);",
			"const out = {};",
			'for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) for (const provenance of [true, false]) {',
			'\tconst api = await slothlet({ base, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", provenance } });',
			'\tawait api.slothlet.api.add("mem", { read: async () => self.vault.secret });',
			"\tout[`${mode}/${runtime}/${provenance}`] = {",
			"\t\tglobalFunction: await settle(api.m.callGlobal()),",
			"\t\tcallback: await settle(api.m.run(async () => self.vault.secret)),",
			"\t\tmemoryModule: await settle(api.m.callMemory()),",
			"\t\tinspect: await settle(api.m.inspectVault()),",
			'\t\tnodeCallbacks: await Promise.all(["readFile", "stat", "pipeline", "data", "emit", "then"].map((kind) => settle(api.m.nodeCallback(kind))))',
			"\t};",
			"\t// Let Node finish calling back (a stream's last event, say) before the instance goes.",
			"\tawait new Promise((resolve) => setTimeout(resolve, 100));",
			"\tawait api.slothlet.shutdown();",
			"}",
			"console.log(JSON.stringify(out));",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

describe("Permissions > provenance and the host's own code, under Node's own loader (#597)", () => {
	it("runs host code inside a module's call as that call, with provenance on as with it off", () => {
		const result = spawnSync(process.execPath, [PROBE], { cwd: process.cwd(), env: process.env, encoding: "utf8", timeout: 120000 });
		expect(result.status, result.stderr).toBe(0);
		const out = JSON.parse(result.stdout.trim().split("\n").pop());
		expect(Object.keys(out)).toHaveLength(8);
		for (const [config, cases] of Object.entries(out)) {
			expect({ config, ...cases }).toEqual({
				config,
				globalFunction: 42,
				callback: 42,
				memoryModule: 42,
				inspect: true,
				nodeCallbacks: [true, true, true, true, true, true]
			});
		}
	});
});
