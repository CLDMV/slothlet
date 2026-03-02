/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-lazy-inflight.test.vitest.mjs
 *	@Date: 2026-02-27T20:33:02-08:00 (1772253182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:56 -08:00 (1772425316)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for unified-wrapper.mjs lazy in-flight apply trap (lines 2499-2629)
 * @module @cldmv/slothlet/tests/unified-wrapper/lazy-inflight
 * @internal
 * @private
 *
 * @description
 * Tests the polling-promise path in the apply trap when a lazy wrapper is called while
 * its materialization is already in progress (inFlight === true).
 *
 * Key paths covered:
 * - Line 2533: `if (mode=lazy && inFlight)` - the in-flight detection check
 * - Lines 2548-2601: The polling promise creation and resolution (function impl)
 * - Lines 2593-2601: The object.default function path
 * - Lines 2609-2619: Reject when inFlight clears without materializing (failure path)
 * - Lines 2618-2629: INVALID_CONFIG_NOT_A_FUNCTION via polling after namespace impl
 *
 * @example
 * // Internal usage only
 * // npm run vitest unified-wrapper-lazy-inflight
 */
process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper, UnifiedWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

let _api = null;

afterEach(async () => {
	if (_api && typeof _api.shutdown === "function") {
		await _api.shutdown();
	}
	_api = null;
	await new Promise((r) => setTimeout(r, 30));
});

// ---------------------------------------------------------------------------
// Helper: get slothlet instance from an API proxy
// ---------------------------------------------------------------------------

/**
 * Gets the internal slothlet instance from any API proxy that has wrapper children.
 * @param {object} api - Slothlet API object
 * @param {string} childKey - Key of a lazily-wrapped child (e.g. "task")
 * @returns {object} The slothlet instance
 */
function getSlothletInstance(api, childKey = "task") {
	const childProxy = api[childKey];
	const wrapper = resolveWrapper(childProxy);
	if (!wrapper) {
		throw new Error(`No wrapper found at api.${childKey}`);
	}
	return wrapper.slothlet;
}

// ---------------------------------------------------------------------------
// Group 1: In-flight namespace wrapper called directly → INVALID_CONFIG_NOT_A_FUNCTION
// Covers lines 2533, 2548-2549, 2554, 2593-2601, 2618-2629
// ---------------------------------------------------------------------------
describe("unified-wrapper: in-flight lazy wrapper → not-a-function reject (lines 2533-2629)", () => {
	it("calling in-flight lazy NAMESPACE wrapper rejects with not-a-function error", async () => {
		// In lazy mode, api.task is a lazy NAMESPACE wrapper (mode="lazy").
		// We manually trigger _materialize() to set inFlight=true synchronously,
		// then call api.task() to hit the in-flight polling path.
		// After materialization, task.impl = object (not callable) → rejects.
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			dir: TEST_DIRS.API_TEST
		});

		const taskProxy = _api.task;
		const taskWrapper = resolveWrapper(taskProxy);
		expect(taskWrapper).not.toBeNull();
		expect(taskWrapper.____slothletInternal.mode).toBe("lazy");

		// Verify not yet materialized or in-flight
		expect(taskWrapper.____slothletInternal.state.materialized).toBe(false);
		expect(taskWrapper.____slothletInternal.state.inFlight).toBe(false);

		// Fire _materialize() — sets inFlight=true SYNCHRONOUSLY before any await
		taskWrapper._materialize();

		// Verify inFlight is now true (set synchronously inside the async IIFE)
		expect(taskWrapper.____slothletInternal.state.inFlight).toBe(true);
		expect(taskWrapper.____slothletInternal.state.materialized).toBe(false);

		// NOW call the lazy proxy while it is in-flight
		// → apply trap: mode=lazy, !materialized, inFlight=true → second check fires
		// → returns polling Promise that resolves once materialized
		// → but task impl is an object (not callable) → rejects with NOT_A_FUNCTION
		const callPromise = taskProxy("some-arg");
		expect(typeof callPromise.then).toBe("function"); // Verify it returned a promise

		// After materialization completes (task is namespace, not function), should reject
		await expect(callPromise).rejects.toMatchObject({
			code: "INVALID_CONFIG_NOT_A_FUNCTION"
		});
	});

	it("in-flight lazy wrapper: polling loop runs setImmediate until materialized", async () => {
		// This tests the setImmediate polling loop path (line ~2548-2629)
		// The polling runs checkMaterialized via setImmediate until state.materialized=true
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			dir: TEST_DIRS.API_TEST
		});

		const taskProxy = _api.task;
		const taskWrapper = resolveWrapper(taskProxy);

		// Trigger in-flight
		taskWrapper._materialize();

		// Call while in-flight — creates polling promise, attach handler immediately
		// to prevent unhandled rejection warning
		const callPromise = taskProxy();

		// Since task is a namespace (object impl), it rejects with NOT_A_FUNCTION
		// after materialization completes across multiple setImmediate cycles
		await expect(callPromise).rejects.toMatchObject({
			code: "INVALID_CONFIG_NOT_A_FUNCTION"
		});
	});

	it("second call to in-flight wrapper also hits polling path", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			dir: TEST_DIRS.API_TEST
		});

		const taskProxy = _api.task;
		const taskWrapper = resolveWrapper(taskProxy);

		// Trigger in-flight
		taskWrapper._materialize();

		// Make TWO calls while in-flight — both should return polling promises
		const call1 = taskProxy("arg1");
		const call2 = taskProxy("arg2");

		// Both should be promises
		expect(typeof call1.then).toBe("function");
		expect(typeof call2.then).toBe("function");

		// Both should reject (namespace not callable)
		await expect(call1).rejects.toBeDefined();
		await expect(call2).rejects.toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Group 2: In-flight CALLABLE lazy wrapper → function resolves (lines 2557-2586)
// Uses a manually created UnifiedWrapper with custom materializeFunc
// ---------------------------------------------------------------------------
describe("unified-wrapper: in-flight callable lazy wrapper → successful resolution (lines 2557-2586)", () => {
	it("polling promise resolves with function impl result", async () => {
		// Create a slothlet instance to borrow the slothlet reference
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			dir: TEST_DIRS.API_TEST
		});

		const slothletInst = getSlothletInstance(_api, "task");

		// Create a lazy wrapper with a callable materializeFunc
		const callableWrapper = new UnifiedWrapper(slothletInst, {
			mode: "lazy",
			apiPath: "test.lazyCallable",
			materializeFunc: async (setImpl) => {
				// Simulate async operation with setImmediate delay
				await new Promise((r) => setImmediate(r));
				setImpl((x) => x * 3);
			}
		});

		// Fire materialization (sets inFlight=true synchronously)
		callableWrapper._materialize();

		// Verify in-flight state
		expect(callableWrapper.____slothletInternal.state.inFlight).toBe(true);
		expect(callableWrapper.____slothletInternal.state.materialized).toBe(false);

		// Create proxy and call it while in-flight
		const proxy = callableWrapper.createProxy();
		const result = await proxy(7);

		// After materialization, (7 * 3) = 21
		expect(result).toBe(21);
	});

	it("polling promise resolves correctly with multiple calls while in-flight", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			dir: TEST_DIRS.API_TEST
		});

		const slothletInst = getSlothletInstance(_api, "task");

		const callableWrapper = new UnifiedWrapper(slothletInst, {
			mode: "lazy",
			apiPath: "test.multiCallInFlight",
			materializeFunc: async (setImpl) => {
				await new Promise((r) => setImmediate(r));
				setImpl((x, y) => x + y);
			}
		});

		callableWrapper._materialize();

		const proxy = callableWrapper.createProxy();

		// Call with different args
		const [r1, r2, r3] = await Promise.all([proxy(1, 2), proxy(10, 20), proxy(5, 5)]);

		expect(r1).toBe(3);
		expect(r2).toBe(30);
		expect(r3).toBe(10);
	});

	it("callable wrapper with object.default function - covers impl.default path (lines 2580-2586)", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			dir: TEST_DIRS.API_TEST
		});

		const slothletInst = getSlothletInstance(_api, "task");

		// materializeFunc returns an object with a `default` function property
		// This covers the `impl.default === "function"` path inside polling (line 2580+)
		const fnWithDefault = function doWork(x) {
			return x * 2;
		};
		const moduleObj = { default: fnWithDefault };

		const callableWrapper = new UnifiedWrapper(slothletInst, {
			mode: "lazy",
			apiPath: "test.defaultFnWrapper",
			materializeFunc: async () => {
				await new Promise((r) => setImmediate(r));
				return moduleObj;
			}
		});

		callableWrapper._materialize();
		const proxy = callableWrapper.createProxy();

		// impl is { default: fn } - should call impl.default(5)
		const result = await proxy(5);
		expect(result).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// Group 3: Materialization fails → polling detects inFlight=false (lines 2609-2619)
// Covers the INVALID_CONFIG_LAZY_MATERIALIZATION_FAILED error path
// ---------------------------------------------------------------------------
describe("unified-wrapper: in-flight wrapper materialization failure (lines 2609-2619)", () => {
	it("rejects with materialization-failed when materializeFunc throws", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			dir: TEST_DIRS.API_TEST
		});

		const slothletInst = getSlothletInstance(_api, "task");

		// materializeFunc that throws an error
		const failingWrapper = new UnifiedWrapper(slothletInst, {
			mode: "lazy",
			apiPath: "test.failingWrapper",
			materializeFunc: async () => {
				await new Promise((r) => setImmediate(r));
				throw new Error("Intentional materialization failure");
			}
		});

		// Fire materialization (sets inFlight=true, then will fail)
		failingWrapper._materialize().catch(() => {
			// Swallow the error from _materialize() - we're testing the apply trap's response
		});

		// Verify inFlight is true
		expect(failingWrapper.____slothletInternal.state.inFlight).toBe(true);

		const proxy = failingWrapper.createProxy();

		// Call while in-flight — polling promise detects inFlight=false after failure
		// → rejects with INVALID_CONFIG_LAZY_MATERIALIZATION_FAILED
		const callPromise = proxy();
		await expect(callPromise).rejects.toMatchObject({
			code: "INVALID_CONFIG_LAZY_MATERIALIZATION_FAILED"
		});
	});

	it("failing materialization with multiple queued calls all reject", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			dir: TEST_DIRS.API_TEST
		});

		const slothletInst = getSlothletInstance(_api, "task");

		const failingWrapper = new UnifiedWrapper(slothletInst, {
			mode: "lazy",
			apiPath: "test.failingMulti",
			materializeFunc: async () => {
				await new Promise((r) => setImmediate(r));
				throw new Error("Multi-call failure");
			}
		});

		failingWrapper._materialize().catch(() => {});

		const proxy = failingWrapper.createProxy();

		// Queue multiple calls
		const calls = [proxy(1), proxy(2), proxy(3)];

		// All should reject
		const results = await Promise.allSettled(calls);
		for (const result of results) {
			expect(result.status).toBe("rejected");
		}
	});
});

// ---------------------------------------------------------------------------
// Group 4: Invalid wrapper → TypeError before any lazy checks (line 2492)
// ---------------------------------------------------------------------------
describe("unified-wrapper: invalidated wrapper throws before lazy check", () => {
	it("invalidated wrapper throws TypeError immediately (not lazy path)", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			dir: TEST_DIRS.API_TEST
		});

		const taskProxy = _api.task;
		const taskWrapper = resolveWrapper(taskProxy);

		// Invalidate the wrapper
		taskWrapper.____slothletInternal.invalid = true;

		// Calling should throw TypeError immediately (before lazy checks)
		expect(() => taskProxy()).toThrow(TypeError);

		// Reset for cleanup
		taskWrapper.____slothletInternal.invalid = false;
	});
});

// ---------------------------------------------------------------------------
// Group 5: Lazy materialization starts from apply trap (not external trigger)
// Covers line 2524: `!materialized && !inFlight → wrapper._materialize()`
// ---------------------------------------------------------------------------
describe("unified-wrapper: lazy apply trap starts materialization itself (line 2524)", () => {
	it("calling unmaterialized non-inFlight lazy wrapper triggers _materialize and polls", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			dir: TEST_DIRS.API_TEST
		});

		const slothletInst = getSlothletInstance(_api, "task");

		// Create a lazy callable wrapper WITHOUT manually triggering _materialize first
		const lazyWrapper = new UnifiedWrapper(slothletInst, {
			mode: "lazy",
			apiPath: "test.selfMaterializeCallable",
			materializeFunc: async (setImpl) => {
				await new Promise((r) => setImmediate(r));
				setImpl((x) => `hello-${x}`);
			}
		});

		// Don't manually trigger _materialize - the apply trap should do it
		expect(lazyWrapper.____slothletInternal.state.inFlight).toBe(false);
		expect(lazyWrapper.____slothletInternal.state.materialized).toBe(false);

		const proxy = lazyWrapper.createProxy();

		// In the apply trap:
		// 1. mode=lazy && !materialized && !inFlight → calls _materialize() (line 2524)
		//    inFlight becomes true synchronously
		// 2. mode=lazy && inFlight → returns polling promise (line 2533)
		const result = await proxy("world");
		expect(result).toBe("hello-world");
	});

	it("lazy wrapper in apply trap: no hooks, self-materializes, returns correct result", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: true }, // hooks enabled - should not interfere since apiPath not registered
			dir: TEST_DIRS.API_TEST
		});

		const slothletInst = getSlothletInstance(_api, "task");
		const lazyWrapper = new UnifiedWrapper(slothletInst, {
			mode: "lazy",
			apiPath: "test.hookableCallable",
			materializeFunc: async (setImpl) => {
				await new Promise((r) => setImmediate(r));
				setImpl((a, b) => a + b);
			}
		});

		const proxy = lazyWrapper.createProxy();
		const result = await proxy(10, 32);
		expect(result).toBe(42);
	});
});
