/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/runtime/live-runtime-async-resource-child.test.vitest.mjs
 *	@Date: 2026-11-21T13:24:37-08:00 (1795296277)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:57-08:00 (1795869177)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A process whose instances all use the live runtime makes no `AsyncResource` and no `AsyncLocalStorage`
 * when module code registers callbacks: an EventEmitter listener, an EventTarget listener and an `on<event>` handler
 * property.
 *
 * A child process replaces `AsyncResource` and `AsyncLocalStorage` on `node:async_hooks` with counting versions before
 * it imports slothlet (slothlet takes the members of Node's built-in modules as it loads), then builds a live-runtime
 * instance, with permissions off and on, whose module registers and fires each kind of callback. Each callback still
 * runs as the module (it reads `self`), and nothing was constructed. An async-runtime instance made afterwards in the
 * same process does make resources for the same callbacks, so the check is not vacuous.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ROOT = path.join(process.cwd(), "tmp", "live-runtime-async-resource-child");
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
	write("api/math/math.mjs", ["export function add(a, b) {", "\treturn a + b;", "}"]);
	write("api/events/events.mjs", [
		'import { EventEmitter } from "node:events";',
		'import { self } from "@cldmv/slothlet/runtime";',
		"export function fire() {",
		"\tconst got = {};",
		"\tconst emitter = new EventEmitter();",
		'\temitter.on("ping", () => {',
		"\t\tgot.emitter = self.math.add(1, 2);",
		"\t});",
		'\temitter.emit("ping");',
		"\tconst target = new EventTarget();",
		'\ttarget.addEventListener("ping", () => {',
		"\t\tgot.target = self.math.add(3, 4);",
		"\t});",
		'\ttarget.dispatchEvent(new Event("ping"));',
		"\tconst controller = new AbortController();",
		"\tcontroller.signal.onabort = () => {",
		"\t\tgot.property = self.math.add(5, 6);",
		"\t};",
		"\tcontroller.abort();",
		"\treturn got;",
		"}"
	]);
	write("probe.mjs", [
		'import * as hooks from "node:async_hooks";',
		'import { syncBuiltinESMExports } from "node:module";',
		"const [permissions] = process.argv.slice(2);",
		"const counts = { resources: 0, storages: 0 };",
		"const asyncHooks = process.getBuiltinModule('node:async_hooks');",
		"const OriginalResource = asyncHooks.AsyncResource;",
		"class CountingResource extends OriginalResource {",
		"\tconstructor(...args) {",
		"\t\tsuper(...args);",
		"\t\tcounts.resources++;",
		"\t}",
		"}",
		"const OriginalStorage = asyncHooks.AsyncLocalStorage;",
		"class CountingStorage extends OriginalStorage {",
		"\tconstructor(...args) {",
		"\t\tsuper(...args);",
		"\t\tcounts.storages++;",
		"\t}",
		"}",
		"// Node exports them through getters: replaced by values.",
		"Object.defineProperty(asyncHooks, 'AsyncResource', { value: CountingResource, writable: true, enumerable: true, configurable: true });",
		"Object.defineProperty(asyncHooks, 'AsyncLocalStorage', { value: CountingStorage, writable: true, enumerable: true, configurable: true });",
		"syncBuiltinESMExports();",
		"if (hooks.AsyncResource !== CountingResource || hooks.AsyncLocalStorage !== CountingStorage) throw new Error('counters not in place');",
		"const { default: slothlet } = await import('@cldmv/slothlet');",
		'const API = new URL("./api/", import.meta.url).pathname;',
		"const config = (runtime) => {",
		"\tconst out = { base: API, runtime, silent: true };",
		"\tif (permissions === 'on') out.permissions = { policy: 'allow' };",
		"\treturn out;",
		"};",
		"const out = {};",
		"const live = await slothlet(config('live'));",
		"out.live = await live.events.fire();",
		"await live.shutdown();",
		"out.liveCounts = { ...counts };",
		"const async = await slothlet(config('async'));",
		"out.async = await async.events.fire();",
		"await async.shutdown();",
		"out.asyncCounts = { ...counts };",
		"process.stdout.write(JSON.stringify(out) + '\\n');",
		"process.exit(0);"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Run the probe in a child process and read what it reports.
 * @param {string} permissions - "on" or "off".
 * @returns {object} The report.
 */
function probe(permissions) {
	const result = spawnSync(process.execPath, ["--conditions=slothlet-dev", PROBE, permissions], { cwd: process.cwd(), encoding: "utf8" });
	if (result.status !== 0) throw new Error(`probe failed (${result.status}): ${result.stderr}`);
	const line = result.stdout.trim().split("\n").pop();
	return JSON.parse(line);
}

describe("Runtime > the live runtime makes no AsyncResource for callbacks module code registers", () => {
	for (const permissions of ["off", "on"]) {
		it(`an EventEmitter listener, an EventTarget listener and an on<event> handler, permissions ${permissions}`, () => {
			const out = probe(permissions);
			const answers = { emitter: 3, target: 7, property: 11 };
			expect(out.live).toEqual(answers);
			expect(out.liveCounts).toEqual({ resources: 0, storages: 0 });
			// The same callbacks on the async runtime do make resources: the counters see them.
			expect(out.async).toEqual(answers);
			expect(out.asyncCounts.resources).toBeGreaterThan(0);
		});
	}
});
