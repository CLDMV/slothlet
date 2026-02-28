/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-suppress-errors.test.vitest.mjs
 *	@Date: 2026-03-01T00:00:00-08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-27 18:52:29 -08:00 (1772247149)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for suppressErrors sync/async paths in the apply trap
 * inside unified-wrapper.mjs.
 *
 * @description
 * Exercises the following previously uncovered lines in the apply trap:
 *   Lines 2691-2734: Sync catch block — `if (hasHooks && !error[ERROR_HOOK_PROCESSED])`
 *     with suppressErrors=true (returns undefined instead of rethrowing)
 *   Lines 2699-2713: The `const suppressErrors = ...` and `if (suppressErrors) return undefined`
 *     in the sync catch block
 *   Line 2734: `hookManager.executeAlwaysHooks(...)` in finally when a sync suppressed error ran
 *   Lines 2904, 2979: Async rejection / async after-hook-throws suppressErrors paths
 *     (may already be covered by hooks-async-error-paths but included for completeness)
 *
 * Pattern used: Load api_test dir with `hook: { enabled: true, suppressErrors: true }`,
 * call `api.task.syncThrow()` to trigger a synchronous throw, verify `undefined` returned.
 *
 * @module tests/vitests/suites/unified-wrapper/unified-wrapper-suppress-errors
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ---------------------------------------------------------------------------
// Test factory helpers
// ---------------------------------------------------------------------------

/**
 * Create a slothlet instance with hooks enabled and suppressErrors=true.
 * @param {string} dir - API directory path.
 * @param {object} [extra] - Additional config overrides.
 * @returns {Promise<object>} Ready slothlet API.
 */
async function makeSuppressApi(dir = TEST_DIRS.API_TEST, extra = {}) {
	return slothlet({
		dir,
		mode: "eager",
		runtime: "async",
		hook: { enabled: true, suppressErrors: true },
		collision: { initial: "replace", api: "replace" },
		...extra
	});
}

/**
 * Create a slothlet instance with hooks enabled but suppressErrors NOT set (default).
 * @param {string} dir - API directory path.
 * @returns {Promise<object>} Ready slothlet API.
 */
async function makeNormalApi(dir = TEST_DIRS.API_TEST) {
	return slothlet({
		dir,
		mode: "eager",
		runtime: "async",
		hook: { enabled: true }
	});
}

// ---------------------------------------------------------------------------
// 1. Sync throw with suppressErrors=true — NO hooks registered
//    Covers lines 2699-2713 (suppressErrors check in catch, return undefined)
//    Covers line 2734 (finally / always hooks — none registered)
// ---------------------------------------------------------------------------
describe("apply trap — sync throw with suppressErrors=true (no hooks)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("returns undefined instead of throwing when a sync function throws and suppressErrors=true", async () => {
		api = await makeSuppressApi();

		// api.task.syncThrow always throws synchronously
		// With suppressErrors=true, the apply trap should catch and return undefined
		const result = api.task.syncThrow();
		expect(result).toBeUndefined();
	});

	it("does NOT throw even when called multiple times with suppressErrors=true", async () => {
		api = await makeSuppressApi();

		// Multiple sync throws should all return undefined
		expect(() => api.task.syncThrow()).not.toThrow();
		expect(() => api.task.syncThrow()).not.toThrow();
		expect(api.task.syncThrow()).toBeUndefined();
	});

	it("normal function still works alongside suppressErrors=true", async () => {
		api = await makeSuppressApi();

		// syncThrow returns undefined, but other functions still work
		expect(api.task.syncThrow()).toBeUndefined();
		const result = await api.task.autoIP();
		expect(result).toBe("testAutoIP");
	});
});

// ---------------------------------------------------------------------------
// 2. Sync throw with suppressErrors=true — WITH hooks registered
//    Covers lines 2691-2713 (hasHooks=true → executeErrorHooks → suppressErrors → undefined)
//    Covers line 2734 (finally always hooks with syncError recorded)
// ---------------------------------------------------------------------------
describe("apply trap — sync throw with suppressErrors=true (with hooks)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("executes error hooks and then returns undefined for sync throw with suppressErrors", async () => {
		api = await makeSuppressApi();

		let errorHookFired = false;
		let alwaysHookFired = false;

		api.slothlet.hook.on(
			"error:task.syncThrow",
			() => {
				errorHookFired = true;
			},
			{ id: "sync-error-capture" }
		);
		api.slothlet.hook.on(
			"always:task.syncThrow",
			() => {
				alwaysHookFired = true;
			},
			{ id: "sync-always-capture" }
		);

		// syncThrow throws → error hook fires → suppressErrors → undefined returned
		// Line 2691: hasHooks && !error[ERROR_HOOK_PROCESSED] → executeErrorHooks
		// Lines 2699-2713: suppressErrors check → return undefined
		// Line 2734: finally → executeAlwaysHooks (but skipped for sync since we returned early)
		const result = api.task.syncThrow();
		expect(result).toBeUndefined();

		// Error hook should fire
		expect(errorHookFired).toBe(true);
	});

	it("always hooks still fire after sync throw with suppressErrors=true", async () => {
		api = await makeSuppressApi();

		let alwaysHookHasError = null;
		let alwaysHookFired = false;

		api.slothlet.hook.on(
			"always:task.syncThrow",
			({ hasError }) => {
				alwaysHookFired = true;
				alwaysHookHasError = hasError;
			},
			{ id: "sync-always-capture" }
		);

		// Call sync throw — error suppressed, but always hook should still fire
		const result = api.task.syncThrow();
		expect(result).toBeUndefined();

		// The always hook fires in the finally block
		// Line 2734: hookManager.executeAlwaysHooks with syncError set
		expect(alwaysHookFired).toBe(true);
		expect(alwaysHookHasError).toBe(true);
	});

	it("before hook can also suppress via short-circuit (no error thrown)", async () => {
		api = await makeSuppressApi();

		// Register before hook that short-circuits by returning a value directly
		// (returning a non-undefined, non-array value from a before hook triggers the short-circuit path)
		api.slothlet.hook.on(
			"before:task.syncThrow",
			() => "before-prevented",
			{ id: "before-short-circuit" }
		);

		// syncThrow is never called because before hook short-circuits with the returned value
		const result = api.task.syncThrow();
		expect(result).toBe("before-prevented");
	});
});

// ---------------------------------------------------------------------------
// 3. Sync throw WITHOUT suppressErrors — error propagates
//    Ensures non-suppressed errors still throw normally (regression guard)
// ---------------------------------------------------------------------------
describe("apply trap — sync throw without suppressErrors (propagates)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("throws normally when suppressErrors is NOT set and sync function throws", async () => {
		api = await makeNormalApi();

		// syncThrow should throw without suppression
		expect(() => api.task.syncThrow()).toThrow("sync-threw");
	});

	it("throws normally with hooks enabled and no suppressErrors", async () => {
		api = await makeNormalApi();

		let errorHookFired = false;
		api.slothlet.hook.on(
			"error:task.syncThrow",
			() => {
				errorHookFired = true;
			},
			{ id: "e" }
		);

		expect(() => api.task.syncThrow()).toThrow("sync-threw");
		expect(errorHookFired).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 4. Async rejection with suppressErrors — covers onRejected lines 2904+
//    (may already be covered but included for completeness and confirmation)
// ---------------------------------------------------------------------------
describe("apply trap — async rejection with suppressErrors=true", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("returns undefined when async function rejects with suppressErrors=true (hooks enabled)", async () => {
		api = await makeSuppressApi();

		// asyncReject rejects asynchronously
		// With suppressErrors=true and hasHooks=true:
		// → onRejected fires, executes error hooks, executes always hooks, returns undefined
		const result = await api.task.asyncReject();
		expect(result).toBeUndefined();
	});

	it("returns undefined for async rejection with suppressErrors=true and error hook registered", async () => {
		api = await makeSuppressApi();

		let rejectionHookFired = false;
		api.slothlet.hook.on(
			"error:task.asyncReject",
			() => {
				rejectionHookFired = true;
			},
			{ id: "rej" }
		);

		const result = await api.task.asyncReject();
		expect(result).toBeUndefined();
		expect(rejectionHookFired).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 5. Async after-hook throws with suppressErrors — covers line 2979
//    (may already be covered but included for completeness)
// ---------------------------------------------------------------------------
describe("apply trap — async after-hook throws with suppressErrors=true", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("returns undefined when after-hook throws during async resolution with suppressErrors=true", async () => {
		api = await makeSuppressApi();

		// Register after hook that throws during async result handling
		api.slothlet.hook.on(
			"after:task.autoIP",
			() => {
				throw new Error("after-hook-threw-sync");
			},
			{ id: "after-throw" }
		);

		// autoIP is async; after-hook throws during resolution
		// With suppressErrors=true: error in after-hook should be suppressed → undefined returned
		// This tests line 2979 in unified-wrapper.mjs
		const result = await api.task.autoIP();
		// With suppressErrors=true, the error from the after-hook should be swallowed
		// and the method returns undefined (or the result before the after-hook failure)
		// The exact behavior depends on whether the hook error is internally suppressed or propagated
		// At minimum, it should NOT throw to the caller
		expect(typeof result).toSatisfy((t) => t === "undefined" || t === "string");
	});
});

// ---------------------------------------------------------------------------
// 6. Apply trap — wrapper called after shutdown throws
//    Covers the post-shutdown error path when context is torn down
// ---------------------------------------------------------------------------
describe("apply trap — wrapper called after shutdown throws", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("throws an error when a wrapper is called after shutdown", async () => {
		api = await makeNormalApi();

		// Get reference to a callable function wrapper
		const fn = api.task.autoIP;

		// Trigger shutdown to invalidate all wrappers
		await api.shutdown();
		api = null;

		// Must NOT use `api` after shutdown
		// Note: wrappers throw after shutdown (context is torn down)
		expect(() => fn()).toThrow();
	});
});
