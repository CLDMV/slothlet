/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/live-runtime-async-storage-child.test.vitest.mjs
 *	@Date: 2026-11-14T10:00:00-08:00 (1794679200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:21-08:00 (1794882621)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A process whose instances all use the live runtime never makes or runs an `AsyncLocalStorage`, so on
 * Node 22 (where a run store switches async hooks on for the whole process) async hooks stay off.
 *
 * A child process replaces `AsyncLocalStorage` and `createHook` on `node:async_hooks` with counting versions before it
 * imports slothlet (slothlet takes the members of Node's built-in modules as it loads), then builds a live-runtime
 * instance and uses it: plain and awaited calls, the first call of a lazy callable folder, a refused call, a hook,
 * `context.run()`, an event, a timer and shutdown. Nothing may have been constructed, run or hooked by then, and a
 * `setImmediate` callback's stack has no `callbackTrampoline` frame (Node's sign that async hooks are on; Node 24 and
 * later run `AsyncLocalStorage` without async hooks, so there only the counts tell). An async-runtime instance made
 * afterwards in the same process does make and run one (and on Node 22 the frame appears), so the check is not
 * vacuous. Mixed processes, either order, both alive and one shut down, answer every step as a single runtime does.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ROOT = path.join(process.cwd(), "tmp", "live-runtime-async-storage-child");
const PROBE = path.join(ROOT, "probe.mjs");
const NODE_MAJOR = Number(process.versions.node.split(".")[0]);

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
	write("api/math/math.mjs", [
		"export function add(a, b) {",
		"\treturn a + b;",
		"}",
		"export async function sum(a, b) {",
		"\tawait null;",
		"\treturn a + b;",
		"}"
	]);
	write("api/kit/def.mjs", ["export default function (name) {", '\treturn "kit:" + name;', "}"]);
	write("api/guest/guest.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export function tryMath() {",
		"\treturn self.math.add(1, 1);",
		"}"
	]);
	write("api/ctx/ctx.mjs", ['import { context } from "@cldmv/slothlet/runtime";', "export function who() {", "\treturn context.who;", "}"]);
	write("api/emit/emit.mjs", [
		'import { EventEmitter } from "node:events";',
		'import { self } from "@cldmv/slothlet/runtime";',
		"export function fire() {",
		"\tconst emitter = new EventEmitter();",
		"\tlet got = null;",
		'\temitter.on("ping", () => {',
		"\t\tgot = self.math.add(3, 4);",
		"\t});",
		'\temitter.emit("ping");',
		"\treturn got;",
		"}"
	]);
	write("api/timer/timer.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export function later() {",
		"\treturn new Promise((resolve) => setTimeout(() => resolve(self.math.add(5, 6)), 1));",
		"}"
	]);
	write("probe.mjs", [
		'import * as hooks from "node:async_hooks";',
		'import { syncBuiltinESMExports } from "node:module";',
		"const [scenario, mode, permissions, hooked] = process.argv.slice(2);",
		"const counts = { constructed: 0, run: 0, enterWith: 0, createHook: 0 };",
		"// Counting versions, in place before slothlet loads.",
		"const asyncHooks = process.getBuiltinModule('node:async_hooks');",
		"const Original = asyncHooks.AsyncLocalStorage;",
		"class CountingStorage extends Original {",
		"\tconstructor(...args) {",
		"\t\tsuper(...args);",
		"\t\tcounts.constructed++;",
		"\t}",
		"\trun(...args) {",
		"\t\tcounts.run++;",
		"\t\treturn super.run(...args);",
		"\t}",
		"\tenterWith(...args) {",
		"\t\tcounts.enterWith++;",
		"\t\treturn super.enterWith(...args);",
		"\t}",
		"}",
		"// Node exports it through a getter: replaced by a value.",
		"Object.defineProperty(asyncHooks, 'AsyncLocalStorage', { value: CountingStorage, writable: true, enumerable: true, configurable: true });",
		"const createHook = asyncHooks.createHook;",
		"asyncHooks.createHook = function (...args) {",
		"\tcounts.createHook++;",
		"\treturn createHook.apply(this, args);",
		"};",
		"syncBuiltinESMExports();",
		"if (hooks.AsyncLocalStorage !== CountingStorage) throw new Error('counter not in place');",
		"const { default: slothlet } = await import('@cldmv/slothlet');",
		'const API = new URL("./api/", import.meta.url).pathname;',
		"const trampoline = () => new Promise((resolve) => setImmediate(() => resolve(/callbackTrampoline/.test(new Error().stack))));",
		"const step = async (fn) => {",
		"\ttry {",
		"\t\treturn await fn();",
		"\t} catch (error) {",
		"\t\treturn error?.code ?? 'threw ' + error?.message;",
		"\t}",
		"};",
		"const config = (runtime) => {",
		"\tconst out = { base: API, mode, runtime, context: { who: 'base' } };",
		"\tif (permissions !== 'off') out.permissions = { policy: 'allow', rules: [{ caller: 'guest.**', target: 'math.**', effect: 'deny' }], caller: { attribution: permissions } };",
		"\tif (hooked === 'on') out.hook = true;",
		"\treturn out;",
		"};",
		"// Every step a live-only process takes, answered as plain JavaScript would.",
		"async function use(api) {",
		"\tconst out = {};",
		"\tout.add = await step(() => api.math.add(2, 3));",
		"\tout.sum = await step(() => api.math.sum(3, 4));",
		"\tout.kit = await step(() => api.kit('x'));",
		"\tout.guest = await step(() => api.guest.tryMath());",
		"\tif (hooked === 'on') {",
		"\t\tout.hooked = await step(async () => {",
		"\t\t\tapi.slothlet.hook.on('math.add:after', ({ result }) => result * 10, { id: 'times-ten' });",
		"\t\t\tconst result = await api.math.add(1, 2);",
		"\t\t\tapi.slothlet.hook.remove({ id: 'times-ten' });",
		"\t\t\treturn result;",
		"\t\t});",
		"\t}",
		"\tout.context = await step(() => api.slothlet.context.run({ who: 'run' }, () => api.ctx.who()));",
		"\tout.event = await step(() => api.emit.fire());",
		"\tout.timer = await step(() => api.timer.later());",
		"\treturn out;",
		"}",
		"const build = (runtime) => step(() => slothlet(config(runtime)));",
		"const out = { counts: {}, trampoline: {} };",
		"const mark = async (name) => {",
		"\tout.counts[name] = { ...counts };",
		"\tout.trampoline[name] = await trampoline();",
		"};",
		"if (scenario === 'live') {",
		"\tconst live = await build('live');",
		"\tout.live = await use(live);",
		"\tout.shutdown = await step(async () => { await live.shutdown(); return 'done'; });",
		"\tawait mark('live');",
		"\tconst async = await build('async');",
		"\tout.async = await use(async);",
		"\tawait async.shutdown();",
		"\tawait mark('async');",
		"} else if (scenario === 'async-live') {",
		"\tconst async = await build('async');",
		"\tout.async = await use(async);",
		"\tconst live = await build('live');",
		"\tout.live = await use(live);",
		"\tout.asyncAgain = await use(async);",
		"\tawait async.shutdown();",
		"\tout.liveAlone = await use(live);",
		"\tawait live.shutdown();",
		"} else if (scenario === 'live-async') {",
		"\tconst live = await build('live');",
		"\tout.live = await use(live);",
		"\tconst async = await build('async');",
		"\tout.async = await use(async);",
		"\tout.liveAgain = await use(live);",
		"\tawait live.shutdown();",
		"\tout.asyncAlone = await use(async);",
		"\tawait async.shutdown();",
		"} else if (scenario === 'both') {",
		"\tconst [live, async] = [await build('live'), await build('async')];",
		"\tconst [a, b] = await Promise.all([use(live), use(async)]);",
		"\tout.live = a;",
		"\tout.async = b;",
		"\tawait Promise.all([live.shutdown(), async.shutdown()]);",
		"}",
		"process.stdout.write(JSON.stringify(out) + '\\n');",
		"process.exit(0);"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Run the probe in a child process.
 * @param {string[]} args - Scenario, mode, permissions ("off", "precise" or "fast") and hooks ("on" or "off").
 * @returns {object} What each step answered, the counts and the stack checks.
 */
function probe(args) {
	const result = spawnSync(process.execPath, ["--conditions=slothlet-dev", PROBE, ...args], {
		cwd: process.cwd(),
		env: process.env,
		encoding: "utf8",
		timeout: 120000
	});
	expect(result.status, result.stderr).toBe(0);
	return JSON.parse(result.stdout.trim().split("\n").pop());
}

/**
 * What every step answers, as plain JavaScript gives it.
 * @param {string} permissions - "off", "precise" or "fast".
 * @param {string} hooked - "on" or "off".
 * @returns {object} The answers.
 */
function expected(permissions, hooked) {
	return {
		add: 5,
		sum: 7,
		kit: "kit:x",
		guest: permissions === "off" ? 2 : "PERMISSION_DENIED",
		...(hooked === "on" ? { hooked: 30 } : {}),
		context: "run",
		event: 7,
		timer: 11
	};
}

const LIVE_CONFIGS = [];
for (const mode of ["eager", "lazy"]) {
	for (const permissions of ["off", "precise", "fast"]) {
		for (const hooked of ["on", "off"]) LIVE_CONFIGS.push({ mode, permissions, hooked });
	}
}

describe.each(LIVE_CONFIGS)(
	"a live-only process ($mode, permissions $permissions, hooks $hooked)",
	{ timeout: 180000 },
	({ mode, permissions, hooked }) => {
		it("constructs and runs no AsyncLocalStorage and leaves async hooks off; an async instance afterwards does run one", () => {
			const out = probe(["live", mode, permissions, hooked]);
			expect(out.live).toEqual(expected(permissions, hooked));
			expect(out.shutdown).toBe("done");
			expect(out.counts.live).toEqual({ constructed: 0, run: 0, enterWith: 0, createHook: 0 });
			expect(out.trampoline.live).toBe(false);
			// The same process, then an instance on the async runtime: the store is made and run for it.
			expect(out.async).toEqual(expected(permissions, hooked));
			expect(out.counts.async.constructed).toBeGreaterThan(0);
			expect(out.counts.async.run).toBeGreaterThan(0);
			// Node 22 runs AsyncLocalStorage on async hooks; Node 24 and later do not.
			expect(out.trampoline.async).toBe(NODE_MAJOR < 24);
		});
	}
);

const MIXED_CONFIGS = [];
for (const scenario of ["async-live", "live-async", "both"]) {
	for (const mode of ["eager", "lazy"]) {
		for (const permissions of ["precise", "fast"]) MIXED_CONFIGS.push({ scenario, mode, permissions });
	}
}

describe.each(MIXED_CONFIGS)("a mixed process ($scenario, $mode, $permissions)", { timeout: 180000 }, ({ scenario, mode, permissions }) => {
	it("answers every step on both runtimes as a single runtime does", () => {
		const out = probe([scenario, mode, permissions, "on"]);
		const answers = expected(permissions, "on");
		for (const key of ["live", "async", "asyncAgain", "liveAlone", "liveAgain", "asyncAlone"]) {
			if (key in out) expect(out[key], key).toEqual(answers);
		}
		expect(out.live).toBeDefined();
		expect(out.async).toBeDefined();
	});
});
