/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/async-store-resource.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:11-08:00 (1795869131)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module code cannot act as another flow by copying that flow's async store onto a resource of its own.
 *
 * @description
 * Where `AsyncContextFrame` is off (Node 22, or a later Node run with `--no-async-context-frame`), Node keeps what an
 * `AsyncLocalStorage` holds on each async resource, under a symbol, and reads it back from the running resource. A
 * module holding a promise the host's `run()` made can copy that value onto the promise its own `then()` hands back;
 * the reaction then runs with the host's flow. With the reaction a function that has no module code of its own (an api
 * function, or a bound built-in such as `Reflect.get` / `Reflect.apply`), nothing on the stack says whose code it is.
 * The copied value must not be taken: the reaction runs as the code that registered it.
 *
 * A child process runs each case, with Node's default async context and, where the Node running the suite has the
 * switch, with `AsyncContextFrame` off.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ROOT = path.join(process.cwd(), "tmp", "async-store-resource");
const PROBE = path.join(ROOT, "probe.mjs");

/**
 * Write a fixture file, creating its folder.
 * @param {string} file - Path below the fixture root.
 * @param {string[]} lines - File contents, one line each.
 * @returns {void}
 */
function write(file, lines) {
	const target = path.join(ROOT, file);
	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, lines.join("\n") + "\n");
}

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	write("api/base/base.mjs", ["export function ping() {", '\treturn "pong";', "}"]);
	write("secret/secret.mjs", [
		'import { context } from "@cldmv/slothlet/runtime";',
		"export function read() {",
		'\treturn "secret:" + (context.user ?? "-");',
		"}"
	]);
	write("reader/reader.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"// Copy what Node keeps for each storage on `from` onto `to`.",
		"function copyStore(from, to) {",
		"\tlet copied = 0;",
		"\tfor (const key of Object.getOwnPropertySymbols(from)) {",
		'\t\tif (key.description === "kResourceStore") {',
		"\t\t\tto[key] = from[key];",
		"\t\t\tcopied++;",
		'\t\t} else if (key.description === "kAsyncLocalStorageContext") {',
		"\t\t\tconst held = from[key];",
		'\t\t\tif (to[key] === null || typeof to[key] !== "object") to[key] = {};',
		"\t\t\tfor (const inner of Reflect.ownKeys(held)) to[key][inner] = held[inner];",
		"\t\t\tcopied++;",
		"\t\t}",
		"\t}",
		"\treturn copied;",
		"}",
		"// A reaction Node runs with `from`'s store copied onto its job.",
		"async function step(from, fn) {",
		"\tconst job = Promise.resolve().then(fn);",
		"\tif (from) copyStore(from, job);",
		"\treturn await job;",
		"}",
		"async function attempt(fn) {",
		"\ttry {",
		"\t\treturn String(await fn());",
		"\t} catch (error) {",
		'\t\treturn "denied:" + (error.code ?? error.message);',
		"\t}",
		"}",
		"export async function probe(from) {",
		"\tconst copied = from ? copyStore(from, Promise.resolve()) : 0;",
		"\tconst secret = await attempt(async () => {",
		'\t\tconst node = await step(from, Reflect.get.bind(null, self, "secret"));',
		'\t\tconst fn = await step(from, Reflect.get.bind(null, node, "read"));',
		"\t\treturn step(from, Reflect.apply.bind(null, fn, node, []));",
		"\t});",
		"\tconst control = await attempt(async () => {",
		"\t\tconst permissions = self.slothlet.permissions;",
		'\t\tconst node = await step(from, Reflect.get.bind(null, permissions, "control"));',
		'\t\tconst fn = await step(from, Reflect.get.bind(null, node, "report"));',
		"\t\tconst report = await step(from, Reflect.apply.bind(null, fn, node, []));",
		"\t\treturn report.mode;",
		"\t});",
		"\treturn { copied, secret, control };",
		"}"
	]);
	write("probe.mjs", [
		'import slothlet from "@cldmv/slothlet";',
		'const root = new URL(".", import.meta.url).pathname;',
		"const api = await slothlet({",
		'\tbase: root + "api",',
		"\tsilent: true,",
		'\tpermissions: { mode: "on", rules: [{ caller: "reader.**", target: "secret.**", effect: "deny" }] }',
		"});",
		'await api.slothlet.api.add("secret", root + "secret", { id: "secret" });',
		'await api.slothlet.api.add("reader", root + "reader", { id: "reader" });',
		'const [held] = await api.slothlet.context.run({ user: "host" }, () => [Promise.resolve()]);',
		'const host = await api.slothlet.context.run({ user: "host" }, () => api.secret.read());',
		"const plain = await api.reader.probe(null);",
		"const copied = await api.reader.probe(held);",
		"await api.shutdown();",
		"console.log(JSON.stringify({ host, plain, copied }));"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Run the probe in a child process.
 * @param {string[]} nodeFlags - Flags for Node.
 * @returns {{host: string, plain: object, copied: object}} What the probe saw.
 */
function probe(nodeFlags) {
	const result = spawnSync(process.execPath, [...nodeFlags, "--conditions=slothlet-dev", PROBE], {
		cwd: process.cwd(),
		env: process.env,
		encoding: "utf8",
		timeout: 60000
	});
	if (result.status !== 0) throw new Error(`probe failed (${result.status}): ${result.stderr}`);
	return JSON.parse(result.stdout.trim().split("\n").pop());
}

// Node 24 and later switch AsyncContextFrame off with this flag; Node 22 runs without it by default.
const FRAMES = process.allowedNodeEnvironmentFlags.has("--no-async-context-frame")
	? [
			["default async context", []],
			["AsyncContextFrame off", ["--no-async-context-frame"]]
		]
	: [["default async context", []]];

describe.each(FRAMES)("Permissions > async store resource > %s", (_label, nodeFlags) => {
	it("runs a reaction as the code that registered it, whatever store was copied onto its job", () => {
		const { host, plain, copied } = probe(nodeFlags);
		expect(host).toBe("secret:host");
		expect(plain.secret).toBe("denied:PERMISSION_DENIED");
		expect(plain.control).toBe("denied:PERMISSION_DENIED");
		// Where Node keeps nothing on the promise (AsyncContextFrame on) there is nothing to copy; either way the
		// reader stays itself.
		expect(copied.secret).toBe("denied:PERMISSION_DENIED");
		expect(copied.control).toBe("denied:PERMISSION_DENIED");
	});
});
