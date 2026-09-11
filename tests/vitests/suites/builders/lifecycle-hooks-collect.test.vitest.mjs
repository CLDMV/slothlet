/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/builders/lifecycle-hooks-collect.test.vitest.mjs
 *	@Date: 2026-07-09 18:03:53 -07:00 (1783645433)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (git@cldmv.net)
 *	@Last modified time: 2026-07-09 18:19:34 -07:00 (1783646374)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for issue #176: nested `shutdown`/`destroy` leaves must remain
 * directly callable (defect-1 fix), and the opt-in `collectLifecycleHooks` config option
 * must discover and invoke them from `api.shutdown()`/`api.destroy()` in the correct order.
 *
 * @description
 * Defect-1 (always-on, regardless of `collectLifecycleHooks`): nested modules that export
 * functions literally named `shutdown`/`destroy` were being dropped — both by
 * `___adoptImplChildren`'s root-only `builtinKeys` skip (unified-wrapper.mjs) incorrectly
 * running on every nested wrapper, and by `ComponentBase.INTERNAL_KEYS` (component-base.mjs)
 * blanket-filtering those names out of every wrapper's `getTrap`/`setTrap`/extraction paths.
 * Both filters were meant to protect the plain root object's builtins, but the root is never
 * a `UnifiedWrapper` — so the filters only ever fired on (and broke) nested wrappers.
 *
 * `collectLifecycleHooks` (default `false`) is a new opt-in: when enabled, `api.shutdown()`
 * and `api.destroy()` walk the API tree, collect nested `shutdown`/`destroy` functions
 * (deepest-first), and invoke them (best-effort) before the root-level user hook and the
 * existing teardown logic.
 *
 * @module tests/vitests/suites/builders/lifecycle-hooks-collect
 */

import { describe, it, expect, beforeEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Retrieve the raw slothlet instance from any wrapper in the API.
 * @param {object} api - Slothlet API proxy.
 * @returns {object} Internal slothlet instance.
 */
function getSlothlet(api) {
	return resolveWrapper(api.math).slothlet;
}

describe.each(["eager", "lazy"])("mode: %s", (mode) => {
	beforeEach(() => {
		globalThis.__slothletHookLog = [];
	});

	// ─── Defect-1: nested shutdown/destroy leaves must be directly callable ──────
	// True regardless of the collectLifecycleHooks option — proves the fix is orthogonal
	// to the opt-in collection behavior.

	describe("defect-1 — nested shutdown/destroy leaves are no longer dropped", () => {
		it("api.setup.shutdown and api.setup.destroy are functions, and api.deep.nested.leaf.shutdown is a function", async () => {
			const api = await slothlet({ base: TEST_DIRS.API_TEST_LIFECYCLE_HOOKS, silent: true, mode });
			try {
				expect(typeof api.setup.shutdown).toBe("function");
				expect(typeof api.setup.destroy).toBe("function");
				expect(typeof api.deep.nested.leaf.shutdown).toBe("function");
			} finally {
				await api.shutdown();
			}
		});

		it("calling api.setup.shutdown() directly works and logs setup:shutdown", async () => {
			const api = await slothlet({ base: TEST_DIRS.API_TEST_LIFECYCLE_HOOKS, silent: true, mode });
			try {
				// Eager mode returns the value synchronously; lazy mode returns a Promise (the
				// call may trigger materialization first) — await works uniformly for both.
				const result = await api.setup.shutdown();
				expect(result).toEqual({ ok: true });
				expect(globalThis.__slothletHookLog).toContain("setup:shutdown");
			} finally {
				await api.shutdown();
			}
		});
	});

	// ─── Option ON: collectLifecycleHooks: true ──────────────────────────────────

	describe("collectLifecycleHooks: true — nested hooks fire before the root hook", () => {
		it("api.shutdown() invokes nested shutdown hooks before the root shutdown hook", async () => {
			const api = await slothlet({ base: TEST_DIRS.API_TEST_LIFECYCLE_HOOKS, silent: true, mode, collectLifecycleHooks: true });
			getSlothlet(api).userHooks.shutdown = () => globalThis.__slothletHookLog.push("root:shutdown");

			await api.shutdown();

			const log = globalThis.__slothletHookLog;
			expect(log).toContain("deep.nested:shutdown");
			expect(log).toContain("setup:shutdown");
			expect(log).toContain("root:shutdown");
			expect(log.indexOf("deep.nested:shutdown")).toBeLessThan(log.indexOf("root:shutdown"));
			expect(log.indexOf("setup:shutdown")).toBeLessThan(log.indexOf("root:shutdown"));
		});

		it("api.destroy() invokes nested destroy hooks, then the root destroy hook, then nested shutdown hooks (via internal api.shutdown()) — each exactly once", async () => {
			const api = await slothlet({ base: TEST_DIRS.API_TEST_LIFECYCLE_HOOKS, silent: true, mode, collectLifecycleHooks: true });
			getSlothlet(api).userHooks.destroy = () => globalThis.__slothletHookLog.push("root:destroy");

			const destroyFn = api.destroy;
			await destroyFn();

			const log = globalThis.__slothletHookLog;
			expect(log.indexOf("setup:destroy")).toBeLessThan(log.indexOf("root:destroy"));
			expect(log.indexOf("root:destroy")).toBeLessThan(log.indexOf("setup:shutdown"));
			expect(log.indexOf("root:destroy")).toBeLessThan(log.indexOf("deep.nested:shutdown"));

			// Each hook fired exactly once — no double-invoke between the destroy pass and the
			// internal api.shutdown() pass (destroy-kind and shutdown-kind hooks are distinct functions).
			expect(log.filter((entry) => entry === "setup:destroy")).toHaveLength(1);
			expect(log.filter((entry) => entry === "setup:shutdown")).toHaveLength(1);
			expect(log.filter((entry) => entry === "deep.nested:shutdown")).toHaveLength(1);
			expect(log.filter((entry) => entry === "root:destroy")).toHaveLength(1);
		});

		it("auto-invoked nested shutdown hooks preserve the owning-node receiver (method using `this`)", async () => {
			const api = await slothlet({ base: TEST_DIRS.API_TEST_LIFECYCLE_HOOKS, silent: true, mode, collectLifecycleHooks: true });

			await api.shutdown();

			// api.resource.shutdown() is a method that reads `this.marker`. Invoking the collected
			// hook via Reflect.apply(fn, receiver) must reproduce a direct api.resource.shutdown()
			// call; a dropped receiver would resolve `this` to undefined and log ":NO_THIS".
			const log = globalThis.__slothletHookLog;
			expect(log).toContain("resource:shutdown:resource-42");
			expect(log).not.toContain("resource:shutdown:NO_THIS");
		});

		it("auto-invoked nested destroy hooks preserve the owning-node receiver (method using `this`)", async () => {
			const api = await slothlet({ base: TEST_DIRS.API_TEST_LIFECYCLE_HOOKS, silent: true, mode, collectLifecycleHooks: true });

			const destroyFn = api.destroy;
			await destroyFn();

			const log = globalThis.__slothletHookLog;
			expect(log).toContain("resource:destroy:resource-42");
			expect(log).not.toContain("resource:destroy:NO_THIS");
		});

		it("a second api.destroy() call after the first does not throw and does not re-push nested log entries", async () => {
			const api = await slothlet({ base: TEST_DIRS.API_TEST_LIFECYCLE_HOOKS, silent: true, mode, collectLifecycleHooks: true });

			const destroyFn = api.destroy;
			await destroyFn();
			const logAfterFirst = [...globalThis.__slothletHookLog];

			await expect(destroyFn()).resolves.not.toThrow();
			expect(globalThis.__slothletHookLog).toEqual(logAfterFirst);
		});
	});

	// ─── Option OFF (default): nested hooks are not auto-invoked ─────────────────

	describe("collectLifecycleHooks: false (default) — nested hooks are not auto-invoked", () => {
		it("api.shutdown() invokes the root hook but not nested hooks, while direct nested calls remain unaffected", async () => {
			const api = await slothlet({ base: TEST_DIRS.API_TEST_LIFECYCLE_HOOKS, silent: true, mode });
			getSlothlet(api).userHooks.shutdown = () => globalThis.__slothletHookLog.push("root:shutdown");

			await api.shutdown();

			const log = globalThis.__slothletHookLog;
			expect(log).toContain("root:shutdown");
			expect(log).not.toContain("setup:shutdown");
			expect(log).not.toContain("deep.nested:shutdown");
		});

		it("api.setup.shutdown() remains directly callable regardless of the option (defect-1 fix is orthogonal)", async () => {
			const api = await slothlet({ base: TEST_DIRS.API_TEST_LIFECYCLE_HOOKS, silent: true, mode });
			try {
				expect(typeof api.setup.shutdown).toBe("function");
				await api.setup.shutdown();
				expect(globalThis.__slothletHookLog).toContain("setup:shutdown");
			} finally {
				await api.shutdown();
			}
		});
	});
});

// ─── F1: lazy materialization-failure guard (lazy-only) ─────────────────────────
// A subtree that fails to materialize in lazy mode must NOT produce a phantom routine
// contribution: an unmaterialized lazy wrapper's property access returns a "waiting proxy" whose
// typeof is "function" even when no real export exists. The replaced `_collectLifecycleHooks`
// bailed on the materialize error rather than recording that waiting proxy; the routine system's
// own `#materializeTree` (routine-manager.mjs) does the same — a materialize failure inside its
// `visit()` closure returns early rather than descending into (or registering from) a broken
// subtree. Verified end-to-end (not via internal introspection, which no longer exists) since
// #341's replacement of `_collectLifecycleHooks`.
//
// Lazy-only by construction: the fixture tree contains a module that throws at import time,
// so eager boot would surface the throw at load — the false-positive can only occur in lazy
// mode, where the failing module isn't imported until materialization is attempted.
describe("collectLifecycleHooks: true — lazy materialize-failure guard (F1)", () => {
	beforeEach(() => {
		globalThis.__slothletHookLog = [];
	});

	it("does not invoke a phantom hook from a subtree that fails to materialize — only the healthy sibling's real hook fires", async () => {
		const api = await slothlet({
			base: TEST_DIRS.API_TEST_LIFECYCLE_HOOKS_FAIL,
			silent: true,
			mode: "lazy",
			collectLifecycleHooks: true
		});

		// api.shutdown() invokes only the genuine hook, never a waiting proxy from the broken
		// subtree — no error, no phantom log entry, exactly the healthy sibling's own hook.
		await expect(api.shutdown()).resolves.not.toThrow();
		expect(globalThis.__slothletHookLog).toEqual(["good:shutdown"]);
	});
});

// ─── Walk-coverage: the routine system's own materialization walk over non-wrapper nodes ───
// Exercises the same edge cases the replaced `_collectLifecycleHooks`'s `collect(obj, depth)`
// closure used to cover — now verified against `RoutineManager`'s own `#materializeTree` walk and
// event-driven registration, through observable `api.shutdown()` behavior rather than internal
// introspection (that method no longer exists — see #341's replacement of
// `_collectLifecycleHooks`):
//   • plain (non-wrapper) reference data merged onto the root, including a same-named `shutdown`
//     function, must never be treated as a routine contribution — the routine system only ever
//     registers from real `impl:created`/`impl:changed` events, which plain reference data never
//     fires, so this case needs no special-casing to pass;
//   • a version-dispatcher proxy node must not produce a phantom contribution or crash the walk.
describe.each(["eager", "lazy"])("collectLifecycleHooks — routine system walk coverage (mode: %s)", (mode) => {
	it("plain reference data (including a same-named `shutdown` function) is never invoked as a routine contribution", async () => {
		// A plain object merged onto the root via `reference` is NOT a UnifiedWrapper and never fires
		// impl:created/impl:changed, so the routine system can never observe it as a contribution —
		// regardless of what it contains, including a function literally named "shutdown".
		const shared = { flag: true };
		const reference = {
			refdata: {
				name: "walk",
				count: 3,
				nothing: null,
				nested: {
					value: 1,
					inner: { deep: "x" },
					// Must never be invoked by api.shutdown() — it's plain data, not a wrapper leaf.
					shutdown: () => {
						globalThis.__slothletHookLog.push("phantom");
					}
				},
				first: shared,
				second: shared
			}
		};

		const api = await slothlet({
			base: TEST_DIRS.API_TEST_LIFECYCLE_HOOKS_WALK,
			silent: true,
			mode,
			collectLifecycleHooks: true,
			reference
		});
		// The reference data is merged onto the root and deeply reachable as plain data.
		expect(api.refdata.nested.inner.deep).toBe("x");
		// The `____`-prefixed export is an own enumerable key on the leaf's wrapper; the sibling
		// `ping` leaf stays callable regardless.
		expect(api.funky.thing.____weird).toBeDefined();
		// Eager returns synchronously; lazy returns a Promise (call may materialize first) —
		// await works uniformly for both.
		expect(await api.funky.thing.ping()).toBe("pong");

		globalThis.__slothletHookLog = [];
		await api.shutdown();

		// No fixture leaf in this base declares a shutdown hook, and the phantom `shutdown`
		// function buried in the plain reference data is not a wrapper leaf — so it never fires.
		expect(globalThis.__slothletHookLog).not.toContain("phantom");
	});

	it("a version-dispatcher node does not produce a phantom contribution or crash the dispose path", async () => {
		const api = await slothlet({
			base: TEST_DIRS.API_TEST_LIFECYCLE_HOOKS_WALK,
			silent: true,
			mode,
			collectLifecycleHooks: true
		});
		await api.slothlet.api.add("auth", `${TEST_DIRS.API_TEST_VERSIONED}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${TEST_DIRS.API_TEST_VERSIONED}/v2`, {}, { version: "v2" });

		// The logical path now resolves to a version-dispatcher proxy.
		expect(api.auth.__isVersionDispatcher).toBe(true);

		// The dispatcher and the versioned auth namespaces (login/logout/createUser only) own no
		// shutdown hooks — api.shutdown() must resolve cleanly with no phantom invocation or crash.
		globalThis.__slothletHookLog = [];
		await expect(api.shutdown()).resolves.not.toThrow();
		expect(globalThis.__slothletHookLog).toEqual([]);
	});
});
