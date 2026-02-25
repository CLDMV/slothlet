/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/runtime-test.mjs
 *	@Date: 2025-11-10T09:52:57-08:00 (1762797177)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-22 13:12:22 -08:00 (1771794742)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self, context, instanceID } from "@cldmv/slothlet/runtime";
import { context as asyncContext, instanceID as asyncInstanceID } from "@cldmv/slothlet/runtime/async";

/**
 * Comprehensive runtime verification that tests all aspects of the runtime system.
 * @function verifyRuntime
 * @returns {object} Complete runtime verification results
 */
export function verifyRuntime() {
	const results = {
		timestamp: new Date().toISOString(),
		runtimeType: null,
		selfTest: { available: false, keys: [], keyCount: 0, hasApi: false },
		contextTest: { available: false, data: null, hasUserData: false, userData: null },
		referenceTest: { available: false, data: null, hasData: false },
		isolationTest: { contextUnique: false, contextId: null },
		liveBindingTest: { selfAccess: false, contextAccess: false, referenceAccess: false }
	};

	// Test 1: Self availability and API detection (don't rely on Object.keys for proxies)
	try {
		results.selfTest.available = !!(self && self.math);
		results.selfTest.hasApi = !!(self && (self.math || self.advanced || self.tcp));
		results.selfTest.keys = results.selfTest.available ? ["math", "advanced", "tcp"] : [];
		results.selfTest.keyCount = results.selfTest.keys.length;

		// Try to detect runtime type from self behavior
		if (results.selfTest.available) {
			results.liveBindingTest.selfAccess = true;
		}
	} catch (error) {
		results.selfTest.error = error.message;
	}

	// Test 2: Context availability and data access
	try {
		const contextData = context || {};
		// CRITICAL: Extract actual values from proxy, don't store proxy reference!
		// Storing the proxy causes issues when reading results outside the execution context
		results.contextTest.data = { ...contextData };
		// Context can be an object OR a function (live binding proxy) - check if it has data
		// Check if context has any keys (not just specifically 'user')
		const contextKeys = Object.keys(contextData);
		results.contextTest.available =
			((typeof contextData === "object" && contextData !== null) || typeof contextData === "function") && contextKeys.length > 0;
		results.contextTest.hasUserData = !!contextData.user;
		results.contextTest.userData = contextData.user;

		// Check for isolation testing data
		if (contextData.runtimeTestId) {
			results.isolationTest.contextId = contextData.runtimeTestId;
			results.isolationTest.contextUnique = true;
		}

		if (results.contextTest.available) {
			results.liveBindingTest.contextAccess = true;
		}
	} catch (error) {
		results.contextTest.error = error.message;
	}

	// Test 3: Reference availability (accessed via self.slothlet.diag.reference)
	try {
		const referenceData = self?.slothlet?.diag?.reference || {};
		results.referenceTest.data = referenceData;
		results.referenceTest.available = typeof referenceData === "object" && referenceData !== null;
		results.referenceTest.hasData = Object.keys(referenceData).length > 0;

		if (results.referenceTest.available) {
			results.liveBindingTest.referenceAccess = true;
		}
	} catch (error) {
		results.referenceTest.error = error.message;
	}

	// Test 4: Runtime type detection using instanceId availability (accessed via self.slothlet.diag.inspect().instanceID)
	try {
		// Try to access instanceId and detect if it's really available
		let instanceIdValue = "undefined";
		let hasInstanceId = false;

		try {
			// Try to coerce instanceId to string to see if it exists
			const diagData = self?.slothlet?.diag?.inspect ? self.slothlet.diag.inspect() : null;
			instanceIdValue = diagData?.instanceID ? String(diagData.instanceID) : "undefined";
			// Check if it's actually available (not "undefined" or empty proxy)
			hasInstanceId = instanceIdValue && instanceIdValue !== "undefined" && instanceIdValue !== "" && instanceIdValue !== "null";
		} catch (_) {
			hasInstanceId = false;
		}

		results.instanceIdTest = {
			available: hasInstanceId,
			value: instanceIdValue
		};

		// Detect runtime type from context.expectedRuntime (set by test harness)
		// or fall back to heuristics
		try {
			if (context && context.expectedRuntime) {
				results.runtimeType = context.expectedRuntime;
			} else {
				// Use heuristics: active instance ID means live bindings runtime
				const hasActiveInstance = hasInstanceId && instanceIdValue !== "dispatcher-runtime" && !instanceIdValue.includes("unknown");

				if (hasActiveInstance) {
					results.runtimeType = "live";
				} else {
					// No active instance = AsyncLocalStorage runtime (default)
					results.runtimeType = "async";
				}
			}
		} catch (error) {
			results.runtimeType = "unknown";
		}
	} catch (error) {
		results.instanceIdTest = { available: false, error: error.message };
		results.runtimeType = "unknown";
	}

	return results;
}

/**
 * Test self cross-calls using math operations.
 * @function testSelfCrossCall
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {object} Cross-call test results
 */
export function testSelfCrossCall(a = 5, b = 3) {
	const results = {
		timestamp: new Date().toISOString(),
		input: { a, b },
		expected: a + b,
		actual: null,
		success: false,
		error: null,
		selfAvailable: false,
		mathAvailable: false
	};

	try {
		// Check if self.rootMath.add is directly available (use rootMath to avoid the
		// math.mjs / math/ folder collision which adds +1000 to results)
		if (self && self.rootMath && typeof self.rootMath.add === "function") {
			results.selfAvailable = true;
			results.mathAvailable = true;
			results.actual = self.rootMath.add(a, b);
			results.success = results.actual === results.expected;
		} else {
			results.error = "self.rootMath.add not available";
			results.selfAvailable = !!self;
			results.mathAvailable = !!(self && self.rootMath);
		}
	} catch (error) {
		results.error = error.message;
	}

	return results;
}

/**
 * Test context isolation by checking for unique context data.
 * @function testContextIsolation
 * @returns {object} Context isolation test results
 */
export function testContextIsolation() {
	const results = {
		timestamp: new Date().toISOString(),
		contextAvailable: false,
		hasIsolationId: false,
		isolationId: null,
		contextData: null,
		runtimeType: null
	};

	try {
		if (context && typeof context === "object") {
			results.contextAvailable = true;
			results.contextData = { ...context };

			if (context.runtimeTestId) {
				results.hasIsolationId = true;
				results.isolationId = context.runtimeTestId;
			}

			if (context.expectedRuntime) {
				results.runtimeType = context.expectedRuntime;
			}
		}
	} catch (error) {
		results.error = error.message;
	}

	return results;
}

/**
 * Performance test to help distinguish between runtime types.
 * @function testPerformance
 * @returns {object} Performance test results
 */
export function testPerformance() {
	const results = {
		timestamp: new Date().toISOString(),
		contextAccess: { time: 0, iterations: 5 },
		selfAccess: { time: 0, iterations: 5 },
		totalTime: 0
	};

	const startTime = performance.now();

	try {
		// Test context access speed
		const contextStart = performance.now();
		for (let i = 0; i < results.contextAccess.iterations; i++) {
			const _ = context?.user; // Access context property repeatedly
		}
		results.contextAccess.time = performance.now() - contextStart;

		// Test self access speed
		const selfStart = performance.now();
		for (let i = 0; i < results.selfAccess.iterations; i++) {
			const _ = self?.math; // Access self property repeatedly
		}
		results.selfAccess.time = performance.now() - selfStart;
	} catch (error) {
		results.error = error.message;
	}

	results.totalTime = performance.now() - startTime;
	return results;
}

/**
 * Comprehensive runtime test that combines all verification methods.
 * @function comprehensiveRuntimeTest
 * @returns {object} Complete runtime test results
 */
export function comprehensiveRuntimeTest() {
	return {
		verification: verifyRuntime(),
		crossCall: testSelfCrossCall(),
		isolation: testContextIsolation(),
		performance: testPerformance()
	};
}

/**
 * Test self and reference propagation through API function calls.
 * @function testSelfAndReference
 * @returns {object} Self and reference test results
 */
export function testSelfAndReference() {
	const results = {
		hasSelfAccess: false,
		canCallOtherModules: false,
		referenceValues: {},
		context: {}
	};

	try {
		// Test self access - check if self is defined and has properties
		results.hasSelfAccess = !!(self && typeof self === "object");

		// Test calling other modules through self
		// Use rootMath as it's a simpler module that should always be available
		if (self && self.rootMath) {
			const sum = self.rootMath(1, 2);
			results.canCallOtherModules = sum === 3;
		} else if (self && self.math && typeof self.math === "object" && self.math.add) {
			const sum = self.math.add(1, 2);
			results.canCallOtherModules = sum === 3;
		}

		// Test reference access (reference values are attached directly to self)
		if (self) {
			// Reference values are attached to self directly
			results.referenceValues.testValue = self.testValue;
			results.referenceValues.testFunc = self.testFunc;
			results.referenceValues.nested = self.nested;
		}

		// Test context access
		if (context) {
			results.context = {
				userId: context.userId,
				appName: context.appName,
				requestId: context.requestId,
				version: context.version
			};
		}
	} catch (error) {
		results.error = error.message;
		results.stack = error.stack;
	}

	return results;
}

/**
 * Exercise all proxy traps on the `instanceID` export from the async runtime.
 * Must be called within an active slothlet async-runtime context so the in-context
 * branches of the get/has traps are reached.
 * @function getAsyncInstanceID
 * @returns {{ id: string, coerced: string, length: number, hasProp: boolean }} Proxy trap results
 * @example
 * const result = api.runtimeTest.getAsyncInstanceID();
 * // result.id === api.slothlet.instanceID
 */
export function getAsyncInstanceID() {
	// get trap — prop === "toString" branch: inside context returns () => ctx.instanceID
	const toStringFn = asyncInstanceID.toString;
	const id = typeof toStringFn === "function" ? toStringFn() : "";

	// get trap — Symbol.toPrimitive branch: String() coercion
	const coerced = String(asyncInstanceID);

	// get trap — ctx.instanceID[prop] fallback: normal string property
	const length = asyncInstanceID.length;

	// has trap — "length" exists on any string (via Object wrapping in the proxy)
	const hasProp = "length" in asyncInstanceID;

	// has trap — undefined prop should be false
	const missingProp = "__nonexistent__" in asyncInstanceID;

	return { id, coerced, length, hasProp, missingProp };
}

/**
 * Exercise the context proxy traps on the dispatcher (runtime.mjs) that are only
 * hit via the live runtime path: ownKeys, has, getOwnPropertyDescriptor, and set.
 * Must be called while a live-runtime context is active (runtime: "live" instance,
 * called directly — no async scope wrapping).
 * @function exerciseContextDispatcherTraps
 * @returns {{ keys: string[], hasUserId: boolean, hasMissing: boolean, descriptor: object|undefined, setWorked: boolean }} Results of each trap
 * @example
 * const result = api.runtimeTest.exerciseContextDispatcherTraps();
 * expect(result.hasUserId).toBe(true);
 */
export function exerciseContextDispatcherTraps() {
	// ownKeys trap (lines 99-101 in runtime.mjs)
	const keys = Reflect.ownKeys(context);

	// has trap (lines 102-104)
	const hasUserId = "userId" in context;
	const hasMissing = "__definitely_absent__" in context;

	// getOwnPropertyDescriptor trap (lines 105-108)
	const descriptor = Object.getOwnPropertyDescriptor(context, "userId");

	// set trap (lines 109-112)
	context.__dispatcherTestKey = "dispatcher-set-trap";
	const setWorked = context.__dispatcherTestKey === "dispatcher-set-trap";

	return { keys, hasUserId, hasMissing, descriptor, setWorked };
}

/**
 * Exercise the instanceID proxy traps on the dispatcher (runtime.mjs).
 * Must be called while a live-runtime context is active so getCurrentRuntime()
 * resolves to liveRuntimeModule and instanceID is a non-null string.
 * @function exerciseInstanceIDDispatcherTraps
 * @returns {{ id: string|undefined, hasProp: boolean, hasMissing: boolean }} Trap results
 * @example
 * const result = api.runtimeTest.exerciseInstanceIDDispatcherTraps();
 * expect(result.id).toBeTruthy();
 */
export function exerciseInstanceIDDispatcherTraps() {
	// get trap (lines 128-130 in runtime.mjs): instanceID[prop]
	// When live runtime is active, liveRuntimeModule.instanceID is undefined,
	// so the trap returns undefined for any prop access.
	const id = instanceID.toString;

	// has trap (lines 131-133): prop in instanceID
	// When liveRuntimeModule.instanceID is undefined, the trap returns false.
	const hasProp = "length" in instanceID;
	const hasMissing = "__nonexistent__" in instanceID;

	return { id, hasProp, hasMissing };
}

/**
 * Exercise the async runtime context proxy traps that require an active ALS context:
 * `set` (write to context) and `getOwnPropertyDescriptor`.
 * MUST be called within `api.slothlet.context.run()` so ALS is active — otherwise
 * the set trap throws RUNTIME_NO_ACTIVE_CONTEXT_CONTEXT.
 * @function exerciseAsyncContextWriteTraps
 * @returns {{ setWorked: boolean, setError: string|null, descriptor: PropertyDescriptor|null }} Trap exercise results
 * @example
 * await api.slothlet.context.run({ userId: 99 }, async () => {
 *   return api.runtimeTest.exerciseAsyncContextWriteTraps();
 * });
 */
export function exerciseAsyncContextWriteTraps() {
	// set trap — asyncContext.prop = value within active ALS context
	// Covers runtime-asynclocalstorage.mjs lines 141-146
	let setWorked = false;
	let setError = null;
	try {
		asyncContext.__asyncWriteTest = "set-trap-covered";
		setWorked = true;
	} catch (err) {
		setError = err.message;
	}

	// getOwnPropertyDescriptor trap — Object.getOwnPropertyDescriptor(asyncContext, prop) within ALS
	// Covers runtime-asynclocalstorage.mjs lines 154-156
	let descriptor = null;
	try {
		descriptor = Object.getOwnPropertyDescriptor(asyncContext, "userId");
	} catch (_) {
		// trap returned undefined which is fine
	}

	return { setWorked, setError, descriptor };
}
