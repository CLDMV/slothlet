/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/core/reload-failed-context.test.vitest.mjs
 *	@Date: 2026-11-17T16:20:23-08:00 (1794961223)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:38-08:00 (1795869098)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A reload that fails leaves no context store behind. A reload moves the instance to a new ID and sets up
 * that ID's context before any module loads, so after a reload that fails while loading, the instance runs in the new
 * ID's context and the one it ran in before goes. A reload that fails before the new context exists keeps the instance
 * in the old one until a reload succeeds or the instance shuts down. Either way, `run()` stores made before the failure
 * follow the instance, and after any number of failed reloads, a good reload and `shutdown()` the context managers hold
 * what they held before the instance was made. A reload asked for inside a `run()` rebuilds only the run's copy: when
 * it fails, the run keeps the copy and context it had, as the instance does, and the instance keeps its ID and context.
 *
 * Fixture (written at run time): `ok/ok.mjs` (`ok.who()` → the run's `user`) and `bad/bad.mjs`, which throws on load
 * while `globalThis[FAIL]` is set; {@link writeCopyFixture} adds `ok.copy()`, the copy number held when the file loaded.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { asyncContextManager, jobHookCount } from "#handlers/context-async";
import { liveContextManager } from "#handlers/context-live";

const ROOT = path.join(process.cwd(), "tmp", "reload-failed-context");
const FAIL = Symbol.for("slothlet.test.reload-failed-context.fail");
const COPY = Symbol.for("slothlet.test.reload-failed-context.copy");

/**
 * Write a fixture folder whose `ok/ok.mjs` answers the run's `user` (`who()`) and the copy number `globalThis[COPY]`
 * held when the file loaded (`copy()`), and whose `bad/bad.mjs` throws on load while `globalThis[FAIL]` is set.
 * @param {string} base - The folder.
 * @returns {void}
 */
function writeCopyFixture(base) {
	mkdirSync(path.join(base, "ok"), { recursive: true });
	mkdirSync(path.join(base, "bad"), { recursive: true });
	writeFileSync(
		path.join(base, "ok", "ok.mjs"),
		[
			'import { context } from "@cldmv/slothlet/runtime";',
			'const loaded = globalThis[Symbol.for("slothlet.test.reload-failed-context.copy")];',
			"export const who = () => context.user ?? null;",
			"export const copy = () => loaded;",
			""
		].join("\n")
	);
	writeFileSync(
		path.join(base, "bad", "bad.mjs"),
		[
			'if (globalThis[Symbol.for("slothlet.test.reload-failed-context.fail")]) throw new Error("bad.mjs refuses to load");',
			"export function ping() {",
			'\treturn "pong";',
			"}",
			""
		].join("\n")
	);
}

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(ROOT, "api", "ok"), { recursive: true });
	mkdirSync(path.join(ROOT, "api", "bad"), { recursive: true });
	writeFileSync(
		path.join(ROOT, "api", "ok", "ok.mjs"),
		['import { context } from "@cldmv/slothlet/runtime";', "export function who() {", "\treturn context.user ?? null;", "}", ""].join("\n")
	);
	writeFileSync(
		path.join(ROOT, "api", "bad", "bad.mjs"),
		[
			'if (globalThis[Symbol.for("slothlet.test.reload-failed-context.fail")]) throw new Error("bad.mjs refuses to load");',
			"export function ping() {",
			'\treturn "pong";',
			"}",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

afterEach(() => {
	delete globalThis[FAIL];
	delete globalThis[COPY];
});

describe.each([
	["async", asyncContextManager],
	["live", liveContextManager]
])("reload that fails — %s runtime", (runtime, manager) => {
	let api;
	let storesBefore;
	let hooksBefore;

	/**
	 * Make the instance, noting what the managers held before it.
	 * @returns {Promise<void>}
	 */
	async function make() {
		storesBefore = manager.instances.size;
		hooksBefore = jobHookCount();
		api = await slothlet({ base: path.join(ROOT, "api"), runtime, silent: true });
	}

	/**
	 * Run `fn` with `manager.initialize` throwing on its next call, as a reload that fails before the new ID's context
	 * is set up does.
	 * @param {Function} fn - What to run.
	 * @returns {Promise<void>}
	 */
	async function failingInitialize(fn) {
		manager.initialize = function initialize() {
			delete manager.initialize;
			throw new Error("initialize refused");
		};
		try {
			await fn();
		} finally {
			delete manager.initialize;
		}
	}

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	it("three reloads failing while loading, then a good one: one store again, and none after shutdown", async () => {
		await make();
		expect(manager.instances.size).toBe(storesBefore + 1);
		globalThis[FAIL] = true;
		for (let k = 0; k < 3; k++) {
			await expect(api.slothlet.reload()).rejects.toThrow();
			expect(manager.instances.size).toBe(storesBefore + 1);
			expect(manager.instances.has(api.slothlet.instance.id)).toBe(true);
		}
		delete globalThis[FAIL];
		await api.slothlet.reload();
		expect(manager.instances.size).toBe(storesBefore + 1);
		expect(api.bad.ping()).toBe("pong");
		await api.slothlet.shutdown();
		api = null;
		expect(manager.instances.size).toBe(storesBefore);
		expect(jobHookCount()).toBe(hooksBefore);
	});

	it("a run() store made before failed reloads follows the instance to each new ID", async () => {
		await make();
		const seen = await api.slothlet.context.run({ user: "alice" }, async () => {
			const who = [api.ok.who()];
			globalThis[FAIL] = true;
			for (let k = 0; k < 2; k++) {
				await expect(api.slothlet.reload()).rejects.toThrow();
				who.push(api.ok.who());
			}
			delete globalThis[FAIL];
			await api.slothlet.reload();
			who.push(api.ok.who());
			return who;
		});
		expect(seen).toEqual(["alice", "alice", "alice", "alice"]);
		expect(manager.instances.size).toBe(storesBefore + 1);
	});

	it("a reload failing before the new context exists keeps the old one until a good reload replaces it (outside any run)", async () => {
		await make();
		const first = api.slothlet.instance.id;
		await failingInitialize(() => expect(api.slothlet.reload()).rejects.toThrow("initialize refused"));
		const kept = manager.instances.has(first);
		await api.slothlet.reload();
		const seen = await api.slothlet.context.run({ user: "alice" }, async () => ({
			kept,
			after: api.ok.who(),
			gone: !manager.instances.has(first)
		}));
		expect(seen).toEqual({ kept: true, after: "alice", gone: true });
		expect(manager.instances.size).toBe(storesBefore + 1);
	});

	it("a reload failing inside a run keeps the run's copy until a good reload replaces it, and the instance's ID and context as they are", async () => {
		// A reload inside a run rebuilds the run's own copy: it claims no ID and sets up no context, so the failure it can
		// meet is its own build's. Here a module of the run's copy refuses to load as it is read again.
		const base = path.join(ROOT, `run-replace-${runtime}`, "api");
		writeCopyFixture(base);
		globalThis[COPY] = 1;
		storesBefore = manager.instances.size;
		hooksBefore = jobHookCount();
		api = await slothlet({ base, runtime, silent: true });
		const first = api.slothlet.instance.id;
		const seen = await api.slothlet.context.run({ user: "alice" }, async () => {
			globalThis[COPY] = 2;
			globalThis[FAIL] = true;
			await expect(api.slothlet.reload()).rejects.toThrow("bad.mjs refuses to load");
			delete globalThis[FAIL];
			const kept = { copy: api.ok.copy(), who: api.ok.who(), id: api.slothlet.instance.id, store: manager.instances.has(first) };
			globalThis[COPY] = 3;
			await api.slothlet.reload();
			const after = { copy: api.ok.copy(), who: api.ok.who(), id: api.slothlet.instance.id, store: manager.instances.has(first) };
			return { kept, after };
		});
		expect(seen).toEqual({
			kept: { copy: 1, who: "alice", id: first, store: true },
			after: { copy: 3, who: "alice", id: first, store: true }
		});
		// The instance never saw either reload: same ID, same context, the copy it had.
		expect(api.slothlet.instance.id).toBe(first);
		expect(manager.instances.has(first)).toBe(true);
		expect(manager.instances.size).toBe(storesBefore + 1);
		expect(api.ok.copy()).toBe(1);
		expect(await api.slothlet.context.run({ user: "bob" }, async () => api.ok.who())).toBe("bob");
		await api.slothlet.shutdown();
		api = null;
		expect(manager.instances.size).toBe(storesBefore);
		expect(jobHookCount()).toBe(hooksBefore);
	});

	it("a reload failing before the new context exists, then one failing while loading: the first context goes", async () => {
		await make();
		const first = api.slothlet.instance.id;
		await failingInitialize(() => expect(api.slothlet.reload()).rejects.toThrow("initialize refused"));
		globalThis[FAIL] = true;
		await expect(api.slothlet.reload()).rejects.toThrow();
		expect(manager.instances.has(first)).toBe(false);
		expect(manager.instances.size).toBe(storesBefore + 1);
	});

	it("a reload failing before the new context exists, then shutdown: no store is left", async () => {
		await make();
		await failingInitialize(() => expect(api.slothlet.reload()).rejects.toThrow("initialize refused"));
		await api.slothlet.shutdown();
		api = null;
		expect(manager.instances.size).toBe(storesBefore);
		expect(jobHookCount()).toBe(hooksBefore);
	});

	it("a reload failing before it switches IDs keeps the instance on its ID and context (outside any run)", async () => {
		// Its own fixture folder: the entry below can never be deleted, so a reload of any instance on this folder fails
		// as it clears the CommonJS cache, before it switches IDs.
		const base = path.join(ROOT, `early-${runtime}`, "api");
		mkdirSync(path.join(base, "ok"), { recursive: true });
		writeFileSync(
			path.join(base, "ok", "ok.mjs"),
			'import { context } from "@cldmv/slothlet/runtime";\nexport const who = () => context.user ?? null;\n'
		);
		storesBefore = manager.instances.size;
		hooksBefore = jobHookCount();
		api = await slothlet({ base, runtime, silent: true });
		const require = createRequire(import.meta.url);
		Object.defineProperty(require.cache, path.join(base, "stuck.cjs"), { value: {}, enumerable: true, configurable: false });
		const first = api.slothlet.instance.id;
		await expect(api.slothlet.reload()).rejects.toThrow(TypeError);
		const seen = await api.slothlet.context.run({ user: "alice" }, async () => ({
			same: api.slothlet.instance.id === first,
			who: api.ok.who()
		}));
		expect(seen).toEqual({ same: true, who: "alice" });
		expect(manager.instances.size).toBe(storesBefore + 1);
		await api.slothlet.shutdown();
		api = null;
		expect(manager.instances.size).toBe(storesBefore);
		expect(jobHookCount()).toBe(hooksBefore);
	});

	it("a reload failing inside a run keeps the run on its copy and context, and the instance on its ID and context", async () => {
		// A reload inside a run rebuilds the run's own copy and switches no ID; the failure it can meet is its own build's:
		// here a module of the run's copy refuses to load as it is read again.
		const base = path.join(ROOT, `run-early-${runtime}`, "api");
		writeCopyFixture(base);
		globalThis[COPY] = 1;
		storesBefore = manager.instances.size;
		hooksBefore = jobHookCount();
		api = await slothlet({ base, runtime, silent: true });
		const first = api.slothlet.instance.id;
		const seen = await api.slothlet.context.run({ user: "alice" }, async () => {
			globalThis[COPY] = 2;
			globalThis[FAIL] = true;
			await expect(api.slothlet.reload()).rejects.toThrow("bad.mjs refuses to load");
			return { same: api.slothlet.instance.id === first, who: api.ok.who(), copy: api.ok.copy(), bad: api.bad.ping() };
		});
		expect(seen).toEqual({ same: true, who: "alice", copy: 1, bad: "pong" });
		expect(api.slothlet.instance.id).toBe(first);
		expect(manager.instances.has(first)).toBe(true);
		expect(manager.instances.size).toBe(storesBefore + 1);
		expect(api.ok.copy()).toBe(1);
		await api.slothlet.shutdown();
		api = null;
		expect(manager.instances.size).toBe(storesBefore);
		expect(jobHookCount()).toBe(hooksBefore);
	});
});

/**
 * After any failed reload the instance answers calls from the copy it had before: sync and async leaves, a call through
 * `self`, `context` and `metadata.self()`, in each runtime and permission mode. A good reload then switches to the new
 * copy, and shutdown leaves no store behind.
 *
 * Fixture (written at run time): `calls/calls.mjs`, whose leaves answer the copy number `globalThis[COPY]` held when the
 * file loaded, and `bad/bad.mjs`, which throws on load while `globalThis[FAIL]` is set.
 */
const HOLD = Symbol.for("slothlet.test.reload-failed-context.hold");
const CALLS_ROOT = path.join(ROOT, "calls-api");

describe.each([
	["async", asyncContextManager],
	["live", liveContextManager]
])("calls after a failed reload — %s runtime", (runtime, manager) => {
	beforeAll(() => {
		mkdirSync(path.join(CALLS_ROOT, "calls"), { recursive: true });
		mkdirSync(path.join(CALLS_ROOT, "bad"), { recursive: true });
		writeFileSync(
			path.join(CALLS_ROOT, "calls", "calls.mjs"),
			[
				'import { self, context } from "@cldmv/slothlet/runtime";',
				'const copy = globalThis[Symbol.for("slothlet.test.reload-failed-context.copy")];',
				"export function copyOf() {",
				"\treturn copy;",
				"}",
				"export async function copyLater() {",
				"\tawait null;",
				"\treturn copy;",
				"}",
				"export function viaSelf() {",
				"\treturn self.calls.copyOf();",
				"}",
				"export function user() {",
				"\treturn context.user ?? null;",
				"}",
				"export function selfPath() {",
				'\treturn self.slothlet.metadata.self().path.join(".");',
				"}",
				"export async function viaSelfAfter(hold) {",
				"\tawait hold;",
				"\treturn { own: copy, viaSelf: self.calls.copyOf(), user: self.calls.user() };",
				"}",
				"export function userWhen(ready, done) {",
				"\tconst handle = setInterval(() => {",
				"\t\tif (!ready()) return;",
				"\t\tclearInterval(handle);",
				"\t\tdone({ own: context.user ?? null, viaSelf: self.calls.user() });",
				"\t}, 5);",
				"}",
				""
			].join("\n")
		);
		mkdirSync(path.join(CALLS_ROOT, "slow"), { recursive: true });
		writeFileSync(
			path.join(CALLS_ROOT, "slow", "slow.mjs"),
			[
				'const hold = globalThis[Symbol.for("slothlet.test.reload-failed-context.hold")];',
				"if (hold) {",
				"\thold.entered();",
				"\tawait hold.promise;",
				"}",
				"export function ready() {",
				"\treturn true;",
				"}",
				""
			].join("\n")
		);
		writeFileSync(
			path.join(CALLS_ROOT, "bad", "bad.mjs"),
			[
				'if (globalThis[Symbol.for("slothlet.test.reload-failed-context.fail")]) throw new Error("bad.mjs refuses to load");',
				"export function ping() {",
				'\treturn "pong";',
				"}",
				""
			].join("\n")
		);
	});

	afterEach(() => {
		delete globalThis[COPY];
	});

	/**
	 * Every answer the instance gives, read inside a `run()` with `user: "alice"`.
	 * @param {object} api - The instance's api.
	 * @returns {Promise<object>} The answers.
	 */
	async function answers(api) {
		return api.slothlet.context.run({ user: "alice" }, async () => ({
			sync: api.calls.copyOf(),
			async: await api.calls.copyLater(),
			viaSelf: api.calls.viaSelf(),
			user: api.calls.user(),
			selfPath: api.calls.selfPath()
		}));
	}

	/**
	 * Fail one reload the way `shape` says.
	 * @param {object} api - The instance's api.
	 * @param {string} shape - `"initialize"` (before the new ID's context exists), `"keep"` (an `instance: "keep"` reload
	 *   whose context cannot be set up again) or `"load"` (while a module loads).
	 * @returns {Promise<void>}
	 */
	async function failReload(api, shape) {
		globalThis[COPY] = 2;
		if (shape === "initialize" || shape === "keep") {
			manager.initialize = function initialize() {
				delete manager.initialize;
				throw new Error("initialize refused");
			};
			try {
				await expect(api.slothlet.reload(shape === "keep" ? { instance: "keep" } : undefined)).rejects.toThrow("initialize refused");
			} finally {
				delete manager.initialize;
			}
		} else {
			globalThis[FAIL] = true;
			try {
				await expect(api.slothlet.reload()).rejects.toThrow("bad.mjs refuses to load");
			} finally {
				delete globalThis[FAIL];
			}
		}
	}

	describe.each([["none"], ["off"], ["disabled"], ["on"]])("permissions %s", (mode) => {
		describe.each([["initialize"], ["keep"], ["load"], ["initialize then load"], ["keep then load"]])("reload failing at %s", (shapes) => {
			it("keeps answering from the copy it had, then a good reload switches and shutdown cleans up", async () => {
				const storesBefore = manager.instances.size;
				const hooksBefore = jobHookCount();
				globalThis[COPY] = 1;
				const api = await slothlet({
					base: CALLS_ROOT,
					runtime,
					silent: true,
					...(mode === "none" ? {} : { permissions: mode })
				});
				try {
					const before = await answers(api);
					expect(before).toEqual({ sync: 1, async: 1, viaSelf: 1, user: "alice", selfPath: "calls.selfPath" });
					for (const shape of shapes.split(" then ")) {
						await failReload(api, shape);
						expect(await answers(api)).toEqual(before);
						expect(api.bad.ping()).toBe("pong");
					}
					globalThis[COPY] = 3;
					await api.slothlet.reload();
					expect(await answers(api)).toEqual({ ...before, sync: 3, async: 3, viaSelf: 3 });
					expect(manager.instances.size).toBe(storesBefore + 1);
				} finally {
					await api.slothlet.shutdown();
				}
				expect(manager.instances.size).toBe(storesBefore);
				expect(jobHookCount()).toBe(hooksBefore);
			});
		});
	});
});

/**
 * Calls made while a reload is still loading the new copy answer from the copy the instance has, on both runtimes, and a
 * module's late work set inside a `run()` before a reload keeps that run's context after it (#897's case, a call through
 * `self` from the old copy's timer).
 *
 * Fixture: the `calls-api` folder above; `slow/slow.mjs` waits on `globalThis[HOLD]` while it loads, when that is set.
 */
describe.each([["async"], ["live"]])("calls while a reload runs, and late work across it — %s runtime", (runtime) => {
	afterEach(() => {
		delete globalThis[COPY];
		delete globalThis[HOLD];
	});

	/**
	 * A promise with its resolve function.
	 * @returns {{promise: Promise<*>, release: Function}} The gate.
	 */
	function gate() {
		let release;
		const promise = new Promise((resolve) => {
			release = resolve;
		});
		return { promise, release };
	}

	describe.each([["none"], ["off"], ["disabled"], ["on"]])("permissions %s", (mode) => {
		/**
		 * Make an instance on the copy numbered 1.
		 * @returns {Promise<object>} The api.
		 */
		async function make() {
			globalThis[COPY] = 1;
			return slothlet({ base: CALLS_ROOT, runtime, silent: true, ...(mode === "none" ? {} : { permissions: mode }) });
		}

		it("a call made while the reload loads answers from the copy the instance has", async () => {
			const api = await make();
			const entered = gate();
			const held = gate();
			globalThis[HOLD] = { entered: entered.release, promise: held.promise };
			globalThis[COPY] = 2;
			const reloading = api.slothlet.reload();
			// Let the reload go on if an assertion below fails, so shutdown does not wait on it.
			reloading.catch(() => {});
			try {
				await entered.promise;
				const during = await api.slothlet.context.run({ user: "alice" }, async () => ({
					sync: api.calls.copyOf(),
					async: await api.calls.copyLater(),
					viaSelf: api.calls.viaSelf(),
					user: api.calls.user(),
					selfPath: api.calls.selfPath()
				}));
				expect(during).toEqual({ sync: 1, async: 1, viaSelf: 1, user: "alice", selfPath: "calls.selfPath" });
				delete globalThis[HOLD];
				held.release();
				await reloading;
				expect(api.calls.copyOf()).toBe(2);
				expect(api.calls.viaSelf()).toBe(2);
			} finally {
				held.release();
				await reloading.catch(() => {});
				await api.slothlet.shutdown();
			}
		});

		it("a call in flight across a reload finishes on the copy it started on", async () => {
			const api = await make();
			try {
				const hold = gate();
				const pending = api.slothlet.context.run({ user: "alice" }, () => api.calls.viaSelfAfter(hold.promise));
				globalThis[COPY] = 2;
				await api.slothlet.reload();
				hold.release();
				// The call runs in a run() opened before the reload, which keeps the copy it started with: its own code and its
				// call through `self` both answer from that copy, while the instance has moved on.
				expect(await pending).toEqual({ own: 1, viaSelf: 1, user: "alice" });
				expect(api.calls.viaSelf()).toBe(2);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a module's timer set inside a run before a reload reads the run's context through self after it", async () => {
			const api = await make();
			try {
				const seen = gate();
				let reloaded = false;
				await api.slothlet.context.run({ user: "alice" }, () => api.calls.userWhen(() => reloaded, seen.release));
				await api.slothlet.reload();
				reloaded = true;
				expect(await seen.promise).toEqual({ own: "alice", viaSelf: "alice" });
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});
});
