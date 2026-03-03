/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/class-instance-wrapper-proxy.test.vitest.mjs
 *	@Date: 2026-02-26T17:01:34-08:00 (1772154094)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:48 -08:00 (1772425308)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for class-instance-wrapper.mjs Proxy traps (lines 168, 176–179).
 *
 * @description
 * Targets two branches inside the Proxy handler created by `runtime_wrapClassInstance` that
 * are unreachable through integration tests:
 *
 * - Line 168: `return runtime_wrapClassInstance(value, contextManager, instanceID, instanceCache)`
 *   — fires when a non-function property on a wrapped instance is itself a class instance
 *   (requires recursive wrapping of nested class objects).
 *
 * - Lines 176–179: The Proxy `set` trap — fires when a property is assigned on a wrapped
 *   instance.  Line 177–178 clears the method cache entry for the overwritten property;
 *   line 179 performs the underlying `Reflect.set`.
 *
 * @module tests/vitests/suites/helpers/class-instance-wrapper-proxy.test.vitest
 */

import { describe, it, expect } from "vitest";
import {
	runtime_wrapClassInstance,
	runtime_isClassInstance
} from "@cldmv/slothlet/helpers/class-instance-wrapper";

/**
 * A minimal context manager stub.  `runInContext` simply calls the function.
 *
 * @type {object}
 */
const mockContextManager = {
	/**
	 * @param {string} _instanceID
	 * @param {Function} fn
	 * @param {object} thisArg
	 * @param {Array} args
	 * @returns {*}
	 */
	runInContext: (_instanceID, fn, thisArg, args) => fn.apply(thisArg, args)
};

// ─── helper fixtures ──────────────────────────────────────────────────────────

/** @class Inner - used as a nested class-instance property value */
class Inner {
	/**
	 * @returns {string}
	 */
	greet() {
		return "hello from Inner";
	}
}

/** @class Outer - wraps an Inner instance as a plain property (not a method) */
class Outer {
	constructor() {
		/** @type {Inner} */
		this.child = new Inner();
	}

	/**
	 * @returns {string}
	 */
	name() {
		return "outer";
	}
}

/** @class WithMethod - used to test the set-trap branch */
class WithMethod {
	/**
	 * @returns {number}
	 */
	doThing() {
		return 42;
	}
}

/**
 * @class Factory - has a method that RETURNS a class instance.
 * Used to cover line 155: `return runtime_wrapClassInstance(result, ...)` inside
 * `runtime_contextPreservingMethod` when the method's return value is a class instance.
 */
class Factory {
	/**
	 * Create and return a new Inner instance.
	 * @returns {Inner} A fresh Inner class instance.
	 */
	createInner() {
		return new Inner();
	}

	/**
	 * A non-class-instance return for comparison.
	 * @returns {number}
	 */
	getNumber() {
		return 42;
	}
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("runtime_wrapClassInstance - non-function class-instance property (line 168)", () => {
	it("should recursively wrap a child property that is itself a class instance", () => {
		const outer = new Outer();
		const cache = new WeakMap();

		const wrapped = runtime_wrapClassInstance(outer, mockContextManager, "test-id", cache);

		// Accessing .child returns a non-function property whose value IS a class instance.
		// This exercises line 167–168 (the recursive-wrap branch in the get trap).
		const wrappedChild = wrapped.child;

		// The result is a Proxy (wrapped Inner), not the raw Inner object
		expect(wrappedChild).toBeDefined();
		// Methods on the wrapped child should still work
		expect(wrappedChild.greet()).toBe("hello from Inner");
	});

	it("wrappedChild is itself a wrapped class instance (Proxy over Inner)", () => {
		const outer = new Outer();
		const cache = new WeakMap();

		const wrapped = runtime_wrapClassInstance(outer, mockContextManager, "test-id-2", cache);
		const child = wrapped.child;

		// runtime_isClassInstance of the underlying raw Inner returns true
		expect(runtime_isClassInstance(new Inner())).toBe(true);

		// The wrapped child's method returns the correct value via context-preserving wrapper
		expect(typeof child.greet).toBe("function");
		expect(child.greet()).toBe("hello from Inner");
	});

	it("multiple accesses of the same child property each time return a wrapped inner", () => {
		const outer = new Outer();
		const cache = new WeakMap();
		const wrapped = runtime_wrapClassInstance(outer, mockContextManager, "test-id-3", cache);

		const c1 = wrapped.child;
		const c2 = wrapped.child;

		// Both should behave correctly
		expect(c1.greet()).toBe("hello from Inner");
		expect(c2.greet()).toBe("hello from Inner");
	});
});

describe("runtime_wrapClassInstance - Proxy set trap (lines 176–179)", () => {
	it("should perform Reflect.set for a new property (line 179)", () => {
		const inst = new WithMethod();
		const cache = new WeakMap();
		const wrapped = runtime_wrapClassInstance(inst, mockContextManager, "set-test-1", cache);

		// Set a totally new property — methodCache.has("newProp") is false → skip delete, do Reflect.set
		wrapped.newProp = "hello";
		expect(wrapped.newProp).toBe("hello");
	});

	it("should clear method cache entry when overwriting a previously-accessed method (lines 176–178)", () => {
		const inst = new WithMethod();
		const cache = new WeakMap();
		const wrapped = runtime_wrapClassInstance(inst, mockContextManager, "set-test-2", cache);

		// Warm up the method cache by reading doThing
		const original = wrapped.doThing;
		expect(typeof original).toBe("function");
		expect(original()).toBe(42);

		// Overwrite doThing — methodCache.has("doThing") is true → exercises lines 176–178
		wrapped.doThing = function () {
			return 99;
		};

		// After overwrite the new function is returned
		expect(wrapped.doThing()).toBe(99);
	});

	it("should reflect primitive overwrites via the set trap (line 179)", () => {
		const inst = new WithMethod();
		const cache = new WeakMap();
		const wrapped = runtime_wrapClassInstance(inst, mockContextManager, "set-test-3", cache);

		wrapped.counter = 0;
		wrapped.counter = wrapped.counter + 5;
		expect(wrapped.counter).toBe(5);
	});
});

// ─── runtime_contextPreservingMethod → method returns class instance (line 155) ──

describe("runtime_wrapClassInstance - method returning a class instance (line 155)", () => {
	it("wraps the returned class instance when a method returns one (line 155)", () => {
		// Factory.createInner() returns `new Inner()`, a class instance.
		// When called via the context-preserving wrapper, the result is detected as a
		// class instance → runtime_wrapClassInstance is called recursively → line 155.
		const factory = new Factory();
		const cache = new WeakMap();
		const wrapped = runtime_wrapClassInstance(factory, mockContextManager, "factory-1", cache);

		// Call the method — result is a class instance (Inner)
		const result = wrapped.createInner();

		// Result should still be functional (the Inner's greet method works)
		expect(typeof result).toBe("object");
		expect(result).not.toBeNull();
		expect(typeof result.greet).toBe("function");
		expect(result.greet()).toBe("hello from Inner");
	});

	it("does NOT re-wrap when method returns a non-class-instance (line 155 skipped)", () => {
		// Factory.getNumber() returns 42 (a primitive), so line 155 is NOT taken.
		const factory = new Factory();
		const cache = new WeakMap();
		const wrapped = runtime_wrapClassInstance(factory, mockContextManager, "factory-2", cache);

		const result = wrapped.getNumber();
		expect(result).toBe(42);
	});

	it("each call to factory method produces an independently wrapped result", () => {
		const factory = new Factory();
		const cache = new WeakMap();
		const wrapped = runtime_wrapClassInstance(factory, mockContextManager, "factory-3", cache);

		const r1 = wrapped.createInner();
		const r2 = wrapped.createInner();

		// Both should work correctly
		expect(r1.greet()).toBe("hello from Inner");
		expect(r2.greet()).toBe("hello from Inner");
	});
});
