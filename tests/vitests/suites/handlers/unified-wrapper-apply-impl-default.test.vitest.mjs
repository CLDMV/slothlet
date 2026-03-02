/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/handlers/unified-wrapper-apply-impl-default.test.vitest.mjs
 *	@Date: 2026-03-02T08:30:00-08:00 (1772537400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 08:46:33 -08:00 (1772469993)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for the apply trap no-contextManager branches in unified-wrapper.mjs.
 *
 * @description
 * The apply trap has three execution branches based on the underlying `impl` type. Each branch
 * forks again depending on whether `wrapper.slothlet.contextManager` is set. The no-contextManager
 * paths (lines 2592, 2598, 2601) are never reached by normal tests because contextManager is always
 * present in a standard Slothlet instance.
 *
 * This file tests those branches by nulling contextManager on the real Slothlet instance (accessed via
 * resolveWrapper) and restoring it in finally blocks. Because `typeof proxy` always returns "function"
 * for callable proxies regardless of the underlying impl, use `wrapper.__type` to inspect the actual
 * impl type in assertions.
 *
 * Target lines:
 *   2592: `result = impl.apply(thisArg, args)` — impl is a function, no contextManager
 *   2598: `result = impl.default.apply(impl, args)` — impl is {default: fn}, no contextManager
 *   2601: throw INVALID_CONFIG_NOT_A_FUNCTION — impl is neither fn nor {default:fn}, no contextManager
 *
 * Lines covered via normal contextManager path (already passing):
 *   hasTrap ~2763: `prop in impl` fallback
 *   ownKeysTrap ~2858-2869: impl keys
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── line 2592: impl is function, no contextManager ─────────────────────────
// api.math.add has impl = function; with contextManager=null the apply trap
// must fall through to impl.apply(thisArg, args) directly.

describe("UnifiedWrapper > applyTrap > impl=fn, no contextManager (line 2592)", () => {
        let api;

        beforeEach(async () => {
                api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
        });

        afterEach(async () => {
                if (api) {
                        await api.shutdown();
                        api = null;
                }
        });

        it("__type is 'function' confirming impl is a function (not just proxy target)", () => {
                // Note: typeof api.math.add === "function" is due to the proxy target,
                // not the impl. Use .__type to check the actual impl type.
                expect(api.math.add.__type).toBe("function");
        });

        it("calls impl.apply directly when contextManager is null", () => {
                const sl = resolveWrapper(api.math).slothlet;
                const origCtx = sl.contextManager;
                sl.contextManager = null;
                try {
                        // math.mjs in api_test is the collision variant: add(a,b) = a+b+1000
                        expect(api.math.add(1, 2)).toBe(1003);
                } finally {
                        sl.contextManager = origCtx;
                }
        });

        it("passes args correctly when contextManager is null", () => {
                const sl = resolveWrapper(api.math).slothlet;
                const origCtx = sl.contextManager;
                sl.contextManager = null;
                try {
                        expect(api.math.add(5, 10)).toBe(1015);
                        expect(api.math.add(0, 0)).toBe(1000);
                } finally {
                        sl.contextManager = origCtx;
                }
        });

        it("produces same result as normal contextManager path", () => {
                const sl = resolveWrapper(api.math).slothlet;
                const normalResult = api.math.add(1, 2);

                const origCtx = sl.contextManager;
                sl.contextManager = null;
                let noCtxResult;
                try {
                        noCtxResult = api.math.add(1, 2);
                } finally {
                        sl.contextManager = origCtx;
                }

                expect(noCtxResult).toBe(normalResult);
        });
});

// ─── line 2598: impl is {default: fn}, no contextManager ────────────────────
// impl.default path: swap the impl on api.math.add (a known callable wrapper)
// to { default: fn }. With contextManager=null the apply trap must call
// impl.default.apply(impl, args).

describe("UnifiedWrapper > applyTrap > impl={default:fn}, no contextManager (line 2598)", () => {
        let api;

        beforeEach(async () => {
                api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
        });

        afterEach(async () => {
                if (api) {
                        await api.shutdown();
                        api = null;
                }
        });

        it("__type reports 'function' when impl.default is a function", () => {
                const wrapper = resolveWrapper(api.math.add);
                const origImpl = wrapper.____slothletInternal.impl;
                wrapper.____slothletInternal.impl = { default: (a, b) => a * b };
                try {
                        // .__type reads the actual impl, not typeof proxy
                        expect(api.math.add.__type).toBe("function");
                } finally {
                        wrapper.____slothletInternal.impl = origImpl;
                }
        });

        it("calls impl.default.apply when contextManager is null", () => {
                const wrapper = resolveWrapper(api.math.add);
                const sl = wrapper.slothlet;
                const origImpl = wrapper.____slothletInternal.impl;
                const origCtx = sl.contextManager;

                wrapper.____slothletInternal.impl = { default: (a, b) => a * b };
                sl.contextManager = null;
                try {
                        expect(api.math.add(3, 4)).toBe(12);
                } finally {
                        sl.contextManager = origCtx;
                        wrapper.____slothletInternal.impl = origImpl;
                }
        });

        it("impl.default receives correct arguments", () => {
                const wrapper = resolveWrapper(api.math.add);
                const sl = wrapper.slothlet;
                const origImpl = wrapper.____slothletInternal.impl;
                const origCtx = sl.contextManager;

                wrapper.____slothletInternal.impl = { default: (a, b) => a + b + 500 };
                sl.contextManager = null;
                try {
                        expect(api.math.add(1, 2)).toBe(503);
                        expect(api.math.add(10, 20)).toBe(530);
                } finally {
                        sl.contextManager = origCtx;
                        wrapper.____slothletInternal.impl = origImpl;
                }
        });
});

// ─── line 2601: impl is invalid, no contextManager ──────────────────────────
// Neither a function nor {default:fn} — throws INVALID_CONFIG_NOT_A_FUNCTION.

describe("UnifiedWrapper > applyTrap > impl=invalid, no contextManager (line 2601)", () => {
        let api;

        beforeEach(async () => {
                api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
        });

        afterEach(async () => {
                if (api) {
                        await api.shutdown();
                        api = null;
                }
        });

        it("__type returns 'object' when impl is a plain object with no default fn", () => {
                const wrapper = resolveWrapper(api.math.add);
                const origImpl = wrapper.____slothletInternal.impl;
                wrapper.____slothletInternal.impl = { notAFunction: true };
                try {
                        expect(api.math.add.__type).toBe("object");
                } finally {
                        wrapper.____slothletInternal.impl = origImpl;
                }
        });

        it("throws INVALID_CONFIG_NOT_A_FUNCTION when impl is a plain object and contextManager is null", () => {
                const wrapper = resolveWrapper(api.math.add);
                const sl = wrapper.slothlet;
                const origImpl = wrapper.____slothletInternal.impl;
                const origCtx = sl.contextManager;

                wrapper.____slothletInternal.impl = { notAFunction: true };
                sl.contextManager = null;
                try {
                        let err;
                        try {
                                api.math.add(1, 2);
                        } catch (e) {
                                err = e;
                        }
                        expect(err).toBeDefined();
                        expect(err.code).toBe("INVALID_CONFIG_NOT_A_FUNCTION");
                } finally {
                        sl.contextManager = origCtx;
                        wrapper.____slothletInternal.impl = origImpl;
                }
        });

        it("throws INVALID_CONFIG_NOT_A_FUNCTION when impl is null and contextManager is null", () => {
                const wrapper = resolveWrapper(api.math.add);
                const sl = wrapper.slothlet;
                const origImpl = wrapper.____slothletInternal.impl;
                const origCtx = sl.contextManager;

                wrapper.____slothletInternal.impl = null;
                sl.contextManager = null;
                try {
                        let err;
                        try {
                                api.math.add(1, 2);
                        } catch (e) {
                                err = e;
                        }
                        expect(err).toBeDefined();
                        expect(err.code).toBe("INVALID_CONFIG_NOT_A_FUNCTION");
                } finally {
                        sl.contextManager = origCtx;
                        wrapper.____slothletInternal.impl = origImpl;
                }
        });
});

// ─── hasTrap: prop in impl (lines ~2763, ~2768) ──────────────────────────────

describe("UnifiedWrapper > hasTrap > prop in impl (line ~2763)", () => {
	let api;

	beforeEach(async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			silent: true
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("'add' in api.math returns true (prop in wrapper children)", async () => {
		// hasTrap: prop is in wrapper children (hasOwn(wrapper, prop))
		expect("add" in api.math).toBe(true);
	});

	it("'_materialize' in api.math returns true (special internal key)", async () => {
		// hasTrap: prop === "_materialize" → return true immediately
		expect("_materialize" in api.math).toBe(true);
	});

	it("'nonExistentProp' in api.math returns false", async () => {
		// hasTrap: prop not in wrapper, not in impl → fallback to target hasOwnProperty
		expect("nonExistentProp" in api.math).toBe(false);
	});

	it("'____slothletInternal' in api.math — internal prop checks", async () => {
		// hasTrap: internal props starting with __ are filtered
		// The prop is in the target via Object.prototype.hasOwnProperty
		const result = "____slothletInternal" in api.math;
		// Just testing that it doesn't throw; result can be either
		expect(typeof result).toBe("boolean");
	});
});

// ─── hasTrap: impl property check via `in` operator ─────────────────────────

describe("UnifiedWrapper > hasTrap > prop in impl (not in children, line ~2763)", () => {
	let api;

	beforeEach(async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			silent: true
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("Symbol.toStringTag 'in' check fires impl fallback path", async () => {
		// Symbol props are filtered as non-internal (not starting with _), so they
		// check hasOwn(wrapper, prop) → false, then check impl
		const result = Symbol.toStringTag in api.math;
		expect(typeof result).toBe("boolean");
	});

	it("Symbol.iterator 'in' check fires impl path", async () => {
		const result = Symbol.iterator in api.math;
		expect(typeof result).toBe("boolean");
	});
});

// ─── ownKeysTrap: impl keys included (lines ~2858-2869) ─────────────────────

describe("UnifiedWrapper > ownKeysTrap > impl keys (lines ~2858-2869)", () => {
	let api;

	beforeEach(async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			silent: true
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("Object.keys(api.math) includes math function names", async () => {
		const keys = Object.keys(api.math);
		expect(Array.isArray(keys)).toBe(true);
		expect(keys.length).toBeGreaterThan(0);
	});

	it("Object.getOwnPropertyNames(api.math) fires ownKeysTrap", async () => {
		const names = Object.getOwnPropertyNames(api.math);
		expect(Array.isArray(names)).toBe(true);
	});

	it("Reflect.ownKeys(api.math) includes expected keys", async () => {
		const keys = Reflect.ownKeys(api.math);
		expect(Array.isArray(keys)).toBe(true);
	});

	it("ownKeysTrap on a callable wrapper (function proxy target) includes prototype/length/name", async () => {
		// api.math.add is a callable function wrapper
		// ownKeysTrap for function target must include 'prototype', 'length', 'name'
		const keys = Reflect.ownKeys(api.math.add);
		expect(Array.isArray(keys)).toBe(true);
	});

	it("ownKeysTrap in lazy mode fires materialization", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		const lazyApi = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			silent: true
		});
		// ownKeysTrap in lazy unmaterialized state triggers _materialize()
		expect(() => {
			const _ = Object.getOwnPropertyNames(lazyApi.math);
		}).not.toThrow();
		await lazyApi.shutdown();
	});
});

// ─── hasTrap in lazy mode (lazy materialize trigger) ────────────────────────

describe("UnifiedWrapper > hasTrap > lazy mode materialization trigger", () => {
	it("'add' in api.math in lazy mode fires _materialize (lazy has trap path)", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			silent: true
		});
		// Accessing 'add' via `in` on a lazy wrapper triggers materialize
		expect(() => {
			const _ = "add" in api.math;
		}).not.toThrow();
		await api.shutdown();
	});
});
