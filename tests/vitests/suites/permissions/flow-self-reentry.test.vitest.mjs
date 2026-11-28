/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/flow-self-reentry.test.vitest.mjs
 *	@Date: 2026-11-17T14:41:11-08:00 (1794955271)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:14-08:00 (1795869134)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module code that enters the scope of a flow's own promise or tick job by itself keeps its own context.
 *
 * @description
 * On the async runtime a promise's or a `process.nextTick()` job the flow's own code made runs in the flow when Node
 * begins it: nothing of the flow's is on the stack then, so such a job is told by where it was made. Both objects carry
 * the async id `AsyncResource.prototype.runInAsyncScope()` reads, so module code holding one (a promise the host handed
 * it inside a `run()`, the tick object `executionAsyncResource()` returns inside the host's tick callback) can run a
 * function of its own in that job's scope later. With `AsyncContextFrame` off the scope carries the run's store; with it
 * on, the module first copies the context frame of an `AsyncResource` the host made in the run onto the object. Either
 * way the module's own code acts outside the run: it reads neither that run's context nor the run it is called in, and
 * `metadata.self()` names the module, also when it enters a second job's scope inside the first ("nested"). The host's
 * own code entering the same scope keeps the run.
 *
 * A `Promise` subclass a `run()` / `scope()` callback returns is taken up in the run, as any thenable is: its own `then`
 * runs there, not where the caller awaits it.
 *
 * A child process runs each configuration, with Node's default async context and, where the Node running the suite has
 * the switch, with `AsyncContextFrame` off. The suite's own process runs the same routes once more as on a Node whose
 * async hooks cannot leave promises out, where a promise's job is told by walking the stack: the
 * install-time probe's answer is put in place for it.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { AsyncResource, createHook, executionAsyncId, executionAsyncResource } from "node:async_hooks";
import v8 from "node:v8";
import vm from "node:vm";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { answerPromiseProbe, promiseProbeResult } from "#handlers/context-async";
import { stackReadCount } from "#helpers/stack-read";

const ROOT = path.join(process.cwd(), "tmp", "flow-self-reentry");
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
	write("api/job/job.mjs", [
		'import { context } from "@cldmv/slothlet/runtime";',
		"export function peek() {",
		"\treturn context.user ?? null;",
		"}"
	]);
	write("api/evil/evil.mjs", [
		'import { self, context } from "@cldmv/slothlet/runtime";',
		'import { AsyncResource, executionAsyncResource } from "node:async_hooks";',
		"const held = {};",
		"// Give `target` the context frame Node keeps on `donor` (with AsyncContextFrame on; nothing to copy with it off).",
		"function copyFrame(target, donor) {",
		"\tfor (const key of Object.getOwnPropertySymbols(donor)) {",
		"\t\tif (/context_frame/.test(String(key))) target[key] = donor[key];",
		"\t}",
		"}",
		"// Handed a promise and a resource the host made inside its run.",
		"export function take(promise, donor, second) {",
		"\theld.promise = promise;",
		"\theld.second = second;",
		"\theld.donor = donor;",
		"\tcopyFrame(promise, donor);",
		"\tcopyFrame(second, donor);",
		"\treturn true;",
		"}",
		"// Called by the host's tick callback inside its run: keeps the tick job running it.",
		"export function grab() {",
		"\theld.tick = executionAsyncResource();",
		"\tcopyFrame(held.tick, held.donor);",
		"\treturn true;",
		"}",
		"// Runs the module's own code in the scope of the job it kept; `nested` enters a second job's scope inside first.",
		"export function peek(which) {",
		'\tconst job = which === "nested" ? held.promise : held[which];',
		"\treturn AsyncResource.prototype.runInAsyncScope.call(job, () => {",
		'\t\tif (which === "nested") AsyncResource.prototype.runInAsyncScope.call(held.second, () => null);',
		"\t\tconst me = self.slothlet.metadata.self();",
		"\t\treturn { user: context.user ?? null, self: me ? (me.apiPath ?? (Array.isArray(me.path) ? me.path.join('.') : null)) : null };",
		"\t});",
		"}"
	]);
	write("probe.mjs", [
		'import slothlet from "@cldmv/slothlet";',
		'import { AsyncResource, executionAsyncResource } from "node:async_hooks";',
		"const [mode] = process.argv.slice(2);",
		'const root = new URL(".", import.meta.url).pathname;',
		'const config = { base: root + "api", silent: true };',
		'if (mode !== "none") config.permissions = { mode };',
		"const api = await slothlet(config);",
		"const out = {};",
		"// What the host keeps of its run: the promise it hands the module, and its own tick job.",
		"const kept = {};",
		'await api.slothlet.context.run({ user: "alice" }, async () => {',
		"\tkept.promise = Promise.resolve(1);",
		'\tapi.evil.take(kept.promise, new AsyncResource("host"), Promise.resolve(2));',
		"\tawait new Promise((resolve) => process.nextTick(() => ((kept.tick = executionAsyncResource()), api.evil.grab(), resolve())));",
		"});",
		'for (const which of ["promise", "tick", "nested"]) {',
		'\tout[which + ":outside"] = api.evil.peek(which);',
		'\tout[which + ":bob"] = await api.slothlet.context.run({ user: "bob" }, () => api.evil.peek(which));',
		'\tif (which === "nested") continue;',
		"\t// The host's own code entering the same scope keeps the run.",
		'\tout[which + ":host"] = AsyncResource.prototype.runInAsyncScope.call(kept[which], () => api.job.peek());',
		"}",
		"// A Promise subclass whose own `then` reads the context, returned from run() and scope().",
		"class Sub extends Promise {",
		"\tthen(onFulfilled, onRejected) {",
		"\t\treturn super.then(() => onFulfilled(api.job.peek()), onRejected);",
		"\t}",
		"}",
		'out.subRun = await api.slothlet.context.run({ user: "alice" }, () => Sub.resolve(1));',
		'out.subScope = await api.slothlet.context.scope({ context: { user: "alice" }, fn: () => Sub.resolve(1) });',
		"// A native promise given a `then` and a `constructor` of its own.",
		"const ownThen = () => {",
		"\tconst promise = Promise.resolve(1);",
		"\tpromise.then = function (onFulfilled, onRejected) {",
		"\t\treturn Promise.prototype.then.call(this, () => onFulfilled(api.job.peek()), onRejected);",
		"\t};",
		"\tpromise.constructor = Object;",
		"\treturn promise;",
		"};",
		'out.ownThenRun = await api.slothlet.context.run({ user: "alice" }, ownThen);',
		'out.ownThenScope = await api.slothlet.context.scope({ context: { user: "alice" }, fn: ownThen });',
		"// A plain native promise comes back as before.",
		'out.nativeRun = await api.slothlet.context.run({ user: "alice" }, async () => api.job.peek());',
		"await api.slothlet.shutdown();",
		"console.log(JSON.stringify(out));"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Run the probe in a child process.
 * @param {string[]} nodeFlags - Flags for Node.
 * @param {string} mode - The permission mode, or "none" for no permissions config.
 * @returns {Record<string, *>} What each route saw.
 */
function probe(nodeFlags, mode) {
	const result = spawnSync(process.execPath, [...nodeFlags, "--conditions=slothlet-dev", PROBE, mode], {
		cwd: process.cwd(),
		env: process.env,
		encoding: "utf8",
		timeout: 120000
	});
	if (result.status !== 0) throw new Error(`probe failed (${result.status}): ${result.stderr}`);
	return JSON.parse(result.stdout.trim().split("\n").pop());
}

// Node 24 and later switch AsyncContextFrame off with this flag.
const FRAMES = process.allowedNodeEnvironmentFlags.has("--no-async-context-frame")
	? [
			["default async context", []],
			["AsyncContextFrame off", ["--no-async-context-frame"]]
		]
	: [["default async context", []]];

const MODES = [
	["no permissions config", "none"],
	["permissions off", "off"],
	["permissions on", "on"]
];

describe.each(FRAMES)("Permissions > a flow's own promise or tick job re-entered by module code > %s", (_label, nodeFlags) => {
	describe.each(MODES)("%s", (_name, mode) => {
		let result;

		beforeAll(() => {
			result = probe(nodeFlags, mode);
		});

		it.each(["promise", "tick", "nested"])("the module's own code run in the %s job's scope outside every run sees no run", (which) => {
			expect(result[which + ":outside"].user).toBeNull();
			expect(result[which + ":outside"].self).toMatch(/^evil(\.|$)/);
		});

		it.each(["promise", "tick", "nested"])(
			"the module's own code run in the %s job's scope inside another run sees neither run",
			(which) => {
				expect(result[which + ":bob"].user).toBeNull();
				expect(result[which + ":bob"].self).toMatch(/^evil(\.|$)/);
			}
		);

		it.each(["promise", "tick"])("the host's own code run in the %s job's scope keeps the run", (which) => {
			expect(result[which + ":host"]).toBe("alice");
		});

		it("a Promise subclass returned from run() and scope() settles in the run", () => {
			expect(result.subRun).toBe("alice");
			expect(result.subScope).toBe("alice");
		});

		it("a native promise with a then or constructor of its own, returned from run() and scope(), settles in the run", () => {
			expect(result.ownThenRun).toBe("alice");
			expect(result.ownThenScope).toBe("alice");
		});

		it("a native promise returned from run() comes back as before", () => {
			expect(result.nativeRun).toBe("alice");
		});
	});
});

/**
 * Run `fn` where no callback Node began is running: in a `FinalizationRegistry` cleanup callback, which Node runs with
 * no async hook around it.
 * @param {Function} fn - The code to run.
 * @returns {Promise<*>} What it returned.
 */
async function outsideEveryCallback(fn) {
	v8.setFlagsFromString("--expose-gc");
	const gc = vm.runInNewContext("gc");
	let settled = null;
	const registry = new FinalizationRegistry(() => {
		try {
			settled = { value: fn() };
		} catch (error) {
			settled = { error };
		}
	});
	(() => registry.register({}, 0))();
	for (let attempt = 0; settled === null && attempt < 50; attempt++) {
		gc();
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	if (settled === null) throw new Error("the cleanup callback never ran");
	if (settled.error) throw settled.error;
	return settled.value;
}

describe.each([
	["told by the second async hook", null],
	["told by the stack", false]
])("Permissions > a flow's own promise job re-entered by module code where no callback runs > %s", (_label, answer) => {
	let api;

	beforeAll(async () => {
		answerPromiseProbe(answer);
		api = await slothlet({ base: path.join(ROOT, "api"), silent: true, runtime: "async" });
	});

	afterAll(async () => {
		answerPromiseProbe(null);
		await api?.slothlet.shutdown();
	});

	it("the module's own code entering the promise's scope sees no run; the host's own code keeps it", async () => {
		const kept = {};
		await api.slothlet.context.run({ user: "alice" }, () => {
			kept.promise = Promise.resolve(1);
			api.evil.take(kept.promise, new AsyncResource("host"), Promise.resolve(2));
		});
		const seen = await outsideEveryCallback(() => ({
			module: api.evil.peek("promise"),
			nested: api.evil.peek("nested"),
			host: AsyncResource.prototype.runInAsyncScope.call(kept.promise, () => api.job.peek())
		}));
		expect(seen.module.user).toBeNull();
		expect(seen.module.self).toMatch(/^evil(\.|$)/);
		expect(seen.nested.user).toBeNull();
		expect(seen.host).toBe("alice");
	});
});

describe("Permissions > a flow's own promise or tick job re-entered by module code > promise jobs told by the stack", () => {
	let api;

	beforeAll(async () => {
		answerPromiseProbe(false);
		api = await slothlet({ base: path.join(ROOT, "api"), silent: true, runtime: "async" });
	});

	afterAll(async () => {
		answerPromiseProbe(null);
		await api?.slothlet.shutdown();
	});

	it("the module's own code in a job's scope sees no run, the host's keeps it, and the flow's continuations keep it", async () => {
		const kept = {};
		const continuations = await api.slothlet.context.run({ user: "alice" }, async () => {
			kept.promise = Promise.resolve(1);
			api.evil.take(kept.promise, new AsyncResource("host"), Promise.resolve(2));
			await new Promise((resolve) => process.nextTick(() => ((kept.tick = executionAsyncResource()), api.evil.grab(), resolve())));
			await null;
			const afterAwait = api.job.peek();
			const inThen = await Promise.resolve().then(() => api.job.peek());
			return { afterAwait, inThen };
		});
		expect(continuations).toEqual({ afterAwait: "alice", inThen: "alice" });
		for (const which of ["promise", "tick", "nested"]) {
			const outside = api.evil.peek(which);
			const bob = await api.slothlet.context.run({ user: "bob" }, () => api.evil.peek(which));
			expect([which, outside.user, bob.user]).toEqual([which, null, null]);
			expect(outside.self).toMatch(/^evil(\.|$)/);
			expect(bob.self).toMatch(/^evil(\.|$)/);
		}
		for (const which of ["promise", "tick"]) {
			expect([which, AsyncResource.prototype.runInAsyncScope.call(kept[which], () => api.job.peek())]).toEqual([which, "alice"]);
		}
	});

	it("a promise's job of the flow reads the stack once it is told by the stack, and not otherwise", async () => {
		const reads = async () =>
			api.slothlet.context.run({ user: "alice" }, async () => {
				await null;
				const before = stackReadCount();
				await Promise.resolve().then(() => api.job.peek());
				return stackReadCount() - before;
			});
		const walked = await reads();
		answerPromiseProbe(null);
		try {
			expect(walked).toBeGreaterThan(await reads());
		} finally {
			answerPromiseProbe(false);
		}
	});
});

/**
 * Whether the Node running the suite leaves an async hook made with `trackPromises: false` out of a promise's job: told by a hook of the test's own,
 * whose `before` would see the job's async id. Call it while slothlet's job hook is installed, so promises get ids.
 * @returns {Promise<boolean>} Whether promise jobs are left out.
 */
function nodeLeavesPromiseJobsOut() {
	return new Promise((resolve) => {
		let seen = -1;
		const hook = createHook({
			before(asyncId) {
				seen = asyncId;
			},
			trackPromises: false
		});
		hook.enable();
		Promise.resolve().then(() => {
			const job = executionAsyncId();
			hook.disable();
			resolve(seen !== job);
		});
	});
}

describe("Permissions > the install-time probe of promise jobs", () => {
	let api;

	beforeAll(async () => {
		answerPromiseProbe(null);
		api = await slothlet({ base: path.join(ROOT, "api"), silent: true, runtime: "async" });
		await new Promise((resolve) => setImmediate(resolve));
	});

	afterAll(async () => {
		await api?.slothlet.shutdown();
	});

	it("answers whether Node leaves the second async hook out of a promise's job, as a hook of the test's own finds", async () => {
		expect(promiseProbeResult()).toBe(await nodeLeavesPromiseJobsOut());
	});
});
