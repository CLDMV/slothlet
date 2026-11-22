/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/live-runtime-no-async-hooks-cycle-child.test.vitest.mjs
 *	@Date: 2026-11-21T15:13:18-08:00 (1795302798)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T16:50:20-08:00 (1795308620)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A process whose instances all use the live runtime makes no `AsyncLocalStorage` and no `AsyncResource`
 * through a whole cycle: calls, `reload()`, `restart()`, a `run()` that adds a module and reloads and restarts its own
 * copy, and `slothlet.bind()`.
 *
 * A child process replaces `AsyncResource` and `AsyncLocalStorage` on `node:async_hooks` with counting versions before
 * it imports slothlet (slothlet takes the members of Node's built-in modules as it loads), then runs the cycle on a
 * live-runtime instance, with permissions off and on. Every step answers as it should (what a run does stays in the
 * run, a bound function runs in the run and as the module that bound it), and nothing was constructed. An async-runtime
 * instance taken through the same cycle afterwards in the same process does make them, so the check is not vacuous.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ROOT = path.join(process.cwd(), "tmp", "live-runtime-no-async-hooks-cycle-child");
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
	write("api/binder/binder.mjs", [
		'import { self, context } from "@cldmv/slothlet/runtime";',
		"export function make() {",
		"\treturn self.slothlet.bind(() => ({ user: context.user, sum: self.math.add(2, 3) }));",
		"}"
	]);
	write("extra/extra.mjs", ["export function hello() {", '\treturn "hello";', "}"]);
	write("probe.mjs", [
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
		"\t// Node's static bind makes its resource with its own class: counted here.",
		"\tstatic bind(...args) {",
		"\t\tcounts.resources++;",
		"\t\treturn Reflect.apply(OriginalResource.bind, this, args);",
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
		"const { default: slothlet } = await import('@cldmv/slothlet');",
		'const API = new URL("./api/", import.meta.url).pathname;',
		'const EXTRA = new URL("./extra/", import.meta.url).pathname;',
		"const config = (runtime) => {",
		"\tconst out = { base: API, runtime, silent: true };",
		"\tif (permissions === 'on') out.permissions = { policy: 'allow' };",
		"\treturn out;",
		"};",
		"const cycle = async (runtime) => {",
		"\tconst api = await slothlet(config(runtime));",
		"\tconst got = {};",
		"\tgot.call = await api.math.add(1, 2);",
		"\tawait api.slothlet.reload();",
		"\tgot.afterReload = await api.math.add(1, 2);",
		"\tawait api.slothlet.restart();",
		"\tgot.afterRestart = await api.math.add(1, 2);",
		"\tlet bound;",
		"\tgot.run = await api.slothlet.context.run({ user: 'r' }, async () => {",
		"\t\tawait api.slothlet.api.add('extra', EXTRA, { id: 'extra' });",
		"\t\tconst hello = await api.extra.hello();",
		"\t\tawait null;",
		"\t\tawait api.slothlet.reload();",
		"\t\tawait api.slothlet.restart();",
		"\t\tbound = await api.binder.make();",
		"\t\treturn { hello, extraAfterRestart: typeof api.extra };",
		"\t});",
		"\tgot.extraOutside = typeof api.extra;",
		"\tgot.bound = await bound();",
		"\tawait api.slothlet.shutdown();",
		"\treturn got;",
		"};",
		"const out = {};",
		"out.live = await cycle('live');",
		"out.liveCounts = { ...counts };",
		"out.async = await cycle('async');",
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

describe("Runtime > the live runtime makes no AsyncLocalStorage and no AsyncResource through a cycle", () => {
	for (const permissions of ["off", "on"]) {
		it(`calls, reload, restart, a run that adds, reloads and restarts its copy, and bind, permissions ${permissions}`, () => {
			const out = probe(permissions);
			const answers = {
				call: 3,
				afterReload: 3,
				afterRestart: 3,
				run: { hello: "hello", extraAfterRestart: "undefined" },
				extraOutside: "undefined",
				bound: { user: "r", sum: 5 }
			};
			expect(out.live).toEqual(answers);
			expect(out.liveCounts).toEqual({ resources: 0, storages: 0 });
			// The same cycle on the async runtime does make them: the counters see them.
			expect(out.async).toEqual(answers);
			expect(out.asyncCounts.storages).toBeGreaterThan(0);
			expect(out.asyncCounts.resources).toBeGreaterThan(0);
		});
	}
});
