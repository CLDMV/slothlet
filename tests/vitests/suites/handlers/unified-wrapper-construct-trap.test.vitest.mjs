/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/handlers/unified-wrapper-construct-trap.test.vitest.mjs
 *	@Date: 2026-04-26 00:00:00 -07:00 (1745654400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-28 19:38:46 -07:00 (1777430326)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for the `construct` proxy trap added to UnifiedWrapper.
 *
 * @description
 * Before the fix, `new api.classes.Counter(0)` fell back to constructing the
 * empty stub proxyTarget function, returning `{}` with no prototype chain and a
 * silently skipped constructor body.
 *
 * These tests verify that:
 *   1. The constructor body runs and own properties are set.
 *   2. The prototype chain is preserved (methods are reachable).
 *   3. Private class fields work correctly (raw instance returned, not re-proxied).
 *   4. Constructing a non-function impl throws INVALID_CONFIG_NOT_A_FUNCTION.
 * @module tests.vitests.suites.handlers.unified-wrapper-construct-trap
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── Eager mode: construct trap routes `new` to real impl constructor ─────────

describe.each(getMatrixConfigs({ mode: "eager" }))("UnifiedWrapper > constructTrap > eager > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST, collision: { initial: "replace", api: "replace" } });
	});

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	test("constructor body runs — own property is set on the instance", () => {
		// Before the fix: new fell back to the stub fn, value was never set.
		const counter = new api.classes.Counter(42);
		expect(counter.value).toBe(42);
	});

	test("prototype chain is preserved — methods are callable", () => {
		// Before the fix: no prototype chain, methods were undefined.
		const counter = new api.classes.Counter(10);
		expect(typeof counter.increment).toBe("function");
		expect(counter.increment()).toBe(11);
		expect(counter.get()).toBe(11);
	});

	test("instance is not a plain empty object", () => {
		// Before the fix: Object.keys({}) → [] and value was undefined.
		const counter = new api.classes.Counter(7);
		expect(counter).not.toEqual({});
		expect(counter.value).toBe(7);
	});

	test("private class fields work — raw instance returned, not re-proxied", () => {
		// Private fields are stored in per-instance WeakMaps keyed on the real instance.
		// Re-proxying would break WeakMap lookup. The construct trap must return the
		// raw instance so private field access doesn't throw TypeError.
		const secrets = new api.classes.Secrets("hunter2");
		expect(secrets.reveal()).toBe("hunter2");
	});

	test("instanceof check passes against the real class", () => {
		// The new.target forwarded via Reflect.construct preserves the prototype chain.
		// Dynamic import the real class to verify instanceof.
		const counter = new api.classes.Counter(0);
		// The instance should have the prototype methods, which means the chain is intact.
		expect(Object.getPrototypeOf(counter)).toBe(Object.getPrototypeOf(new api.classes.Counter(0)));
	});
});

// ─── Lazy mode: construct trap routes `new` to real impl constructor ──────────

// ─── Lazy mode: constructTrap returns a Promise when called before materialization
//     so callers can simply `await new api.classes.Foo(args)` — no pre-warm needed.

describe.each(getMatrixConfigs({ mode: "lazy" }))("UnifiedWrapper > constructTrap > lazy (await new) > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST, collision: { initial: "replace", api: "replace" } });
	});

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	test("constructor body runs — own property is set on the instance", async () => {
		// The construct trap triggers materialization and returns a Promise.
		// Awaiting `new` resolves to the real instance with the constructor applied.
		const counter = await new api.classes.Counter(99);
		expect(counter.value).toBe(99);
	});

	test("prototype chain is preserved — methods are callable", async () => {
		const counter = await new api.classes.Counter(5);
		expect(typeof counter.increment).toBe("function");
		expect(counter.increment()).toBe(6);
		expect(counter.get()).toBe(6);
	});

	test("instance is not a plain empty object", async () => {
		const counter = await new api.classes.Counter(3);
		expect(counter).not.toEqual({});
		expect(counter.value).toBe(3);
	});

	test("private class fields work — raw instance returned, not re-proxied", async () => {
		// Private fields are stored in per-instance WeakMaps keyed on the real instance.
		// Re-proxying would break WeakMap lookup. The construct trap must return the
		// raw instance so private field access doesn't throw TypeError.
		const secrets = await new api.classes.Secrets("lazy-secret");
		expect(secrets.reveal()).toBe("lazy-secret");
	});

	test("prototype chain is consistent between two instances", async () => {
		const a = await new api.classes.Counter(0);
		const b = await new api.classes.Counter(0);
		expect(Object.getPrototypeOf(a)).toBe(Object.getPrototypeOf(b));
	});
});

// ─── Lazy in-flight construct trap — Promise path ─────────────────────────────
//
// These tests cover lines 3424-3472: the polling-promise path in the construct
// trap when `new proxy()` is called on a lazy, unmaterialized wrapper. The first
// lazy guard fires `_materialize()` (setting inFlight=true synchronously), then
// the second guard detects `inFlight===true` and returns a Promise that polls via
// `setImmediate` until materialization completes.
//
// Three sub-paths are exercised:
//   - Line 3432: impl is a function  → resolve(Reflect.construct(impl, …))
//   - Line 3434: impl.default is fn  → resolve(Reflect.construct(impl.default, …))
//   - Line 3436: impl is an object   → reject(INVALID_CONFIG_NOT_A_FUNCTION)

describe("UnifiedWrapper > constructTrap > lazy in-flight Promise path (lines 3424-3472)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	test("resolves with constructed function instance when lazy impl is a function (line 3432)", async () => {
		// logger/logger.mjs auto-flattens: api.logger wrapper impl becomes the `log` function.
		// Calling `new api.logger()` before materialization enters the in-flight Promise path
		// and, after materialization, resolves via Reflect.construct(impl, args, impl).
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ mode: "lazy", runtime: "async", hook: { enabled: false }, dir: TEST_DIRS.API_TEST });
		const loggerProxy = api.logger;
		expect(loggerProxy.__mode).toBe("lazy");
		expect(loggerProxy.__materialized).toBe(false);
		// new on unmaterialized lazy wrapper → Promise (lines 3424-3472)
		const inst = await new loggerProxy();
		// impl is the log function → Reflect.construct resolves to a log instance
		expect(typeof inst).toBe("object");
	});

	test("resolves with impl.default instance when lazy impl is {default: fn} (line 3434)", async () => {
		// default-fn.cjs exports { default: multiply } (no named exports → CJS unwrap skipped).
		// After materialization impl = { default: multiply }.
		// The in-flight Promise resolves via Reflect.construct(impl.default, args, impl.default).
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ mode: "lazy", runtime: "async", hook: { enabled: false }, dir: TEST_DIRS.API_TEST_CJS });
		const dfProxy = api.defaultFn;
		expect(dfProxy.__mode).toBe("lazy");
		expect(dfProxy.__materialized).toBe(false);
		const inst = await new dfProxy();
		// Reflect.construct(multiply, [], multiply) → instance of multiply
		expect(inst?.constructor?.name).toBe("multiply");
	});

	test("rejects with INVALID_CONFIG_NOT_A_FUNCTION when lazy impl is a namespace object (line 3436)", async () => {
		// api.database is a lazy folder namespace — impl materialises to a plain object.
		// The in-flight Promise rejects because impl is neither function nor has .default fn.
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ mode: "lazy", runtime: "async", hook: { enabled: false }, dir: TEST_DIRS.API_TEST });
		const dbProxy = api.database;
		expect(dbProxy.__mode).toBe("lazy");
		expect(dbProxy.__materialized).toBe(false);
		await expect(new dbProxy()).rejects.toMatchObject({ code: "INVALID_CONFIG_NOT_A_FUNCTION" });
	});
});

// ─── Materialized lazy wrapper — eager section of construct trap ──────────────
//
// These tests cover lines 3486-3498: when the lazy wrapper has ALREADY been
// materialised (mode=lazy, materialized=true, inFlight=false) the two lazy
// guards are skipped and the code falls into the "Eager or already-materialised"
// section that has its own impl-type checks.
//
//   - Line 3487: impl.default is fn → Reflect.construct(impl.default, …)
//   - Line 3490: neither           → throw INVALID_CONFIG_NOT_A_FUNCTION

describe("UnifiedWrapper > constructTrap > materialized lazy wrapper — eager fallback (lines 3486-3498)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	test("constructs via impl.default when materialised impl is {default: fn} (line 3487)", async () => {
		// Materialise defaultFn explicitly so the Promise path is NOT taken.
		// With impl = {default: multiply} the eager guard `typeof impl.default === "function"`
		// triggers Reflect.construct(impl.default, args, impl.default).
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ mode: "lazy", runtime: "async", hook: { enabled: false }, dir: TEST_DIRS.API_TEST_CJS });
		const dfProxy = api.defaultFn;
		await dfProxy._materialize();
		expect(dfProxy.__materialized).toBe(true);
		// Eager path: impl.default is the multiply function
		const inst = new dfProxy(3, 4);
		expect(inst?.constructor?.name).toBe("multiply");
	});

	test("throws INVALID_CONFIG_NOT_A_FUNCTION when materialised impl is a plain object (line 3490)", async () => {
		// Materialise database explicitly — impl becomes a plain namespace object.
		// The eager fallback finds no function (neither impl nor impl.default) and throws.
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ mode: "lazy", runtime: "async", hook: { enabled: false }, dir: TEST_DIRS.API_TEST });
		const dbProxy = api.database;
		await dbProxy._materialize();
		expect(dbProxy.__materialized).toBe(true);
		let caught = null;
		try {
			new dbProxy();
		} catch (e) {
			caught = e;
		}
		expect(caught).not.toBeNull();
		expect(caught.code).toBe("INVALID_CONFIG_NOT_A_FUNCTION");
	});
});

// ─── Derived-class construction: newTarget !== proxy (false branch, lines 3477 & 3482) ───────

// Line 3477 — impl is a function, newTarget is a derived class (not the proxy):
//   `const effectiveNewTarget = newTarget === proxy ? impl : newTarget;`
//   The FALSE branch fires when a user subclasses the proxy via `class Derived extends api.Foo {}`.
//   In that case newTarget is `Derived`, not the proxy, so effectiveNewTarget = newTarget = Derived.

describe.each(getMatrixConfigs({ mode: "eager" }))(
	"UnifiedWrapper > constructTrap > derived-class subclassing (line 3477 false branch) > Config: '$name'",
	({ config }) => {
		let api;

		beforeEach(async () => {
			const { default: slothlet } = await import("@cldmv/slothlet");
			api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST, collision: { initial: "replace", api: "replace" } });
		});

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		test("derived class instance has correct prototype and own properties (line 3477 false branch)", () => {
			// class Derived extends api.classes.Counter triggers construct trap with
			// newTarget = Derived (not the proxy), so effectiveNewTarget = newTarget = Derived.
			// Reflect.construct(impl, args, Derived) produces an instance whose
			// [[Prototype]] is Derived.prototype — the derived constructor body runs correctly.
			class DerivedCounter extends api.classes.Counter {
				constructor(start) {
					super(start);
					this.doubled = start * 2;
				}
			}

			const inst = new DerivedCounter(10);
			expect(inst.value).toBe(10);
			expect(inst.doubled).toBe(20);
			expect(Object.getPrototypeOf(inst)).toBe(DerivedCounter.prototype);
		});
	}
);

// Line 3482 — impl is {default: fn}, newTarget is a derived class (not the proxy):
//   `const effectiveNewTarget = newTarget === proxy ? impl.default : newTarget;`
//   Same derived-class scenario but for CJS modules loaded as { default: fn }.

describe("UnifiedWrapper > constructTrap > derived-class subclassing CJS impl.default (line 3482 false branch)", () => {
	let api;

	beforeEach(async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		// Eager mode: CJS default-fn loads as impl = { default: multiply }
		api = await slothlet({ mode: "eager", runtime: "async", hook: { enabled: false }, dir: TEST_DIRS.API_TEST_CJS });
	});

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	test("derived class instance from CJS impl.default has correct prototype (line 3482 false branch)", () => {
		// api.defaultFn: impl = { default: multiply } (CJS module, no named exports).
		// class Derived extends api.defaultFn triggers construct trap with newTarget = Derived.
		// effectiveNewTarget = newTarget = Derived → Reflect.construct(impl.default, args, Derived).
		// The resulting instance has [[Prototype]] = Derived.prototype.
		class DerivedMultiplier extends api.defaultFn {
			constructor() {
				super();
				this.isDerived = true;
			}
		}

		const inst = new DerivedMultiplier();
		expect(Object.getPrototypeOf(inst)).toBe(DerivedMultiplier.prototype);
		expect(inst.isDerived).toBe(true);
	});
});

// ─── Invalid wrapper: construct on invalidated proxy throws TypeError ─────────

describe("UnifiedWrapper > constructTrap > invalid wrapper throws TypeError (line 3403)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	test("new on invalidated wrapper throws TypeError (line 3403 true branch)", async () => {
		// Strategy: lazy mode — materialise math to get real child wrapper proxies,
		// then reload math which triggers ___resetLazy → ___invalidate() on each child.
		// The saved add proxy now has invalid = true; new addProxy() fires the construct
		// trap's invalid guard at line 3403 and throws TypeError.
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ mode: "lazy", runtime: "async", hook: { enabled: false }, dir: TEST_DIRS.API_TEST });

		// Materialise math so api.math.add is a real callable UnifiedWrapper proxy.
		await api.math._materialize();
		const addProxy = api.math.add;
		expect(addProxy.__isCallable).toBe(true);

		// Reload math — ___resetLazy is called on the math wrapper, which calls
		// ___invalidate() on every child wrapper including add.
		await api.slothlet.api.reload("math");

		// addProxy.____slothletInternal.invalid is now true — construct trap must throw.
		expect(() => new addProxy()).toThrow(TypeError);
		expect(() => new addProxy()).toThrow(/invalidated/);
	});
});
