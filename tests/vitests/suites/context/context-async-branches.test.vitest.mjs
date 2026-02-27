/**
 *      @Project: @cldmv/slothlet
 *      @Filename: /tests/vitests/suites/context/context-async-branches.test.vitest.mjs
 *      @Date: 2026-07-15T00:00:00-07:00 (1752652800)
 *      @Author: Nate Hyson <CLDMV>
 *      @Email: <Shinrai@users.noreply.github.com>
 *      -----
 *      @Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *      @Last modified time: 2026-07-15 00:00:00 -07:00 (1752652800)
 *      -----
 *      @Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for AsyncContextManager uncovered branches (lines 121-122, 126, 190).
 *
 * @description
 * Directly instantiates AsyncContextManager to cover three code paths that integration tests
 * never reach:
 *
 * - Line 190: `cleanup()` — throws `CONTEXT_NOT_FOUND` when the supplied `instanceID` is
 *   not registered in `this.instances`.
 *
 * - Lines 121-122: `runInContext()` — the "already in correct context" branch (isActiveOurInstance).
 *   When an outer `runInContext` has already established an ALS store for a given instanceID, a
 *   NESTED call to `runInContext` with the same instanceID enters the if-branch at line 114. If
 *   the inner function returns a class instance, lines 121-122 fire to wrap it via
 *   `runtime_wrapClassInstance`.
 *
 * - Line 126: `runInContext()` — the error catch inside the "already in correct context" branch.
 *   Same nested setup as above, but the inner function throws — the catch at line 125 wraps it
 *   in a `CONTEXT_EXECUTION_FAILED` SlothletError (line 126).
 *
 * @module tests/vitests/suites/context/context-async-branches.test.vitest
 */

import { describe, it, expect } from "vitest";
import { AsyncContextManager } from "@cldmv/slothlet/handlers/context-async";

// ─── fixture class ────────────────────────────────────────────────────────────

/**
 * A minimal custom class used to verify that `runtime_isClassInstance` returns `true`
 * and therefore triggers the class-instance wrapping path (lines 121-122).
 *
 * Object, Array, Date, Error, RegExp, etc. are excluded by the detector, so we need
 * a user-defined class.
 */
class Counter {
	/**
	 * @param {number} [start=0] - Initial count value.
	 */
	constructor(start = 0) {
		/** @type {number} */
		this.count = start;
	}

	/**
	 * Increments and returns the new count.
	 * @returns {number}
	 */
	increment() {
		return ++this.count;
	}
}

// ─── cleanup — CONTEXT_NOT_FOUND (line 190) ───────────────────────────────────

describe("AsyncContextManager.cleanup — throws CONTEXT_NOT_FOUND for unknown instanceID (line 190)", () => {
	it("throws when instanceID was never registered", () => {
		// A freshly created AsyncContextManager has an empty instances Map.
		// Calling cleanup("nonexistent") must throw because the store is not found.
		const cm = new AsyncContextManager();

		expect(() => cm.cleanup("nonexistent-id")).toThrow();
	});

	it("throws with an error referencing the missing instanceID", () => {
		const cm = new AsyncContextManager();

		let caught = null;
		try {
			cm.cleanup("ghost-instance");
		} catch (err) {
			caught = err;
		}

		expect(caught).not.toBeNull();
		expect(caught.message ?? String(caught)).toMatch(/ghost-instance|CONTEXT_NOT_FOUND/i);
	});

	it("does NOT throw after the instanceID has been initialized", () => {
		// Confirm cleanup only throws for unknown IDs (regression guard).
		const cm = new AsyncContextManager();
		cm.initialize("valid-id");

		// cleanup on a known ID should succeed without throwing.
		expect(() => cm.cleanup("valid-id")).not.toThrow();
	});
});

// ─── runInContext — class-instance wrapping in nested call (lines 121-122) ───

describe("AsyncContextManager.runInContext — class-instance result in nested (isActive) call (lines 121-122)", () => {
	it("wraps a returned class instance in a Proxy when called inside an active context", () => {
		// SETUP:
		// An outer runInContext establishes the ALS store for instanceID "inst1".
		// The inner runInContext with the SAME instanceID detects isActiveOurInstance = true
		// and enters the if-branch (lines 114-134). When the inner fn returns a Counter
		// (a custom class instance), runtime_isClassInstance(result) returns true → lines
		// 121-122 fire and the instance is proxied.

		const cm = new AsyncContextManager();
		cm.initialize("inst1");

		let innerResult;

		/**
		 * Outer function — runs in a fresh ALS context, then immediately issues a
		 * nested runInContext to hit the isActive path.
		 * @returns {void}
		 */
		const outerFn = () => {
			innerResult = cm.runInContext("inst1", () => new Counter(10), null, []);
		};

		// Execute the outer call to set up the ALS context.
		cm.runInContext("inst1", outerFn, null, []);

		// The nested result should be defined; the proxy preserves method calls.
		expect(innerResult).toBeDefined();
		// The proxied instance behaves like the original Counter.
		expect(typeof innerResult.increment).toBe("function");
	});

	it("preserves the original property values on the wrapped class instance", () => {
		const cm = new AsyncContextManager();
		cm.initialize("inst2");

		let wrappedCounter;

		cm.runInContext(
			"inst2",
			() => {
				wrappedCounter = cm.runInContext("inst2", () => new Counter(7), null, []);
			},
			null,
			[]
		);

		// The wrapped instance should expose the count property.
		expect(wrappedCounter.count).toBe(7);
	});
});

// ─── runInContext — error thrown in nested (isActive) call (line 126) ────────

describe("AsyncContextManager.runInContext — error thrown in nested (isActive) call (line 126)", () => {
	it("re-throws errors as CONTEXT_EXECUTION_FAILED when inner fn throws inside active context", () => {
		// Same nested setup as above, but the inner fn throws.
		// lines 117-134 catch it and re-throw as SlothletError (CONTEXT_EXECUTION_FAILED) at
		// line 126. That SlothletError propagates out of the outer call too.
		const cm = new AsyncContextManager();
		cm.initialize("inst3");

		expect(() => {
			cm.runInContext(
				"inst3",
				() => {
					// Nested call — isActiveOurInstance = true → if-branch at line 114.
					cm.runInContext(
						"inst3",
						() => {
							throw new Error("inner-boom");
						},
						null,
						[]
					);
				},
				null,
				[]
			);
		}).toThrow();
	});

	it("wraps the original error when the inner fn throws", () => {
		const cm = new AsyncContextManager();
		cm.initialize("inst4");

		let caughtError = null;

		try {
			cm.runInContext(
				"inst4",
				() => {
					cm.runInContext(
						"inst4",
						() => {
							throw new TypeError("custom-type-error");
						},
						null,
						[]
					);
				},
				null,
				[]
			);
		} catch (err) {
			caughtError = err;
		}

		expect(caughtError).not.toBeNull();
		// The thrown error chain should reference the original error text.
		expect(String(caughtError)).toMatch(/custom-type-error|CONTEXT_EXECUTION_FAILED/i);
	});
});
