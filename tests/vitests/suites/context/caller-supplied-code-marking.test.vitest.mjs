/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/caller-supplied-code-marking.test.vitest.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #597 — which calls are checked for code their caller supplied, and what that costs.
 *
 * @description
 * A call is checked only when it is handed a receiver or an argument that can carry its caller's code: an
 * object or a function that is not one of slothlet's own api nodes. Deciding that must never run the value's
 * code, and a call that is not checked never reads the stack. The stack reads are counted through the
 * `prepareStackTrace` hook every capture sets and restores.
 *
 * @module tests/vitests/suites/context/caller-supplied-code-marking
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { carriesCallerCode, resolveSupplier } from "#handlers/frame-placement";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Freeze a value and everything it holds.
 * @template T
 * @param {T} value - The value.
 * @returns {T} The same value, frozen all the way down.
 */
function deepFreeze(value) {
	if (value === null || typeof value !== "object") return value;
	for (const key of Reflect.ownKeys(value)) deepFreeze(value[key]);
	return Object.freeze(value);
}

/**
 * Count stack captures made while `fn` runs: every capture installs its own `prepareStackTrace` for its
 * duration, so the setter sees each one.
 * @param {function(): Promise<*>} fn - Work to measure.
 * @returns {Promise<{captures: number, result: *}>} The count and the work's result.
 */
async function countCaptures(fn) {
	const original = Object.getOwnPropertyDescriptor(Error, "prepareStackTrace");
	let current = original?.value;
	let captures = 0;
	Object.defineProperty(Error, "prepareStackTrace", {
		configurable: true,
		get: () => current,
		set: (value) => {
			if (typeof value === "function" && value.name === "runtime_structuredFrames") captures++;
			current = value;
		}
	});
	try {
		const result = await fn();
		return { captures, result };
	} finally {
		if (original) Object.defineProperty(Error, "prepareStackTrace", original);
		else delete Error.prepareStackTrace;
	}
}

describe("Caller-supplied code (#597) > marking a call", () => {
	it("primitives, null and undefined carry no code", () => {
		expect(carriesCallerCode(undefined, [1, "a", true, null, undefined, 2n, Symbol("s")])).toBe(false);
		expect(carriesCallerCode(null, [])).toBe(false);
		expect(carriesCallerCode(undefined, undefined)).toBe(false);
	});

	it("a function argument marks the call", () => {
		expect(carriesCallerCode(undefined, [() => {}])).toBe(true);
		expect(carriesCallerCode(undefined, [1, function named() {}])).toBe(true);
	});

	it("frozen plain data — objects and arrays of primitives, nested — does not mark the call", () => {
		expect(carriesCallerCode(undefined, [deepFreeze({})])).toBe(false);
		expect(carriesCallerCode(undefined, [1, deepFreeze([])])).toBe(false);
		expect(carriesCallerCode(undefined, [deepFreeze({ a: 1, b: "x", c: [true, null, { d: 2n }] })])).toBe(false);
		expect(carriesCallerCode(undefined, [deepFreeze(Object.assign(Object.create(null), { a: 1 }))])).toBe(false);
		expect(carriesCallerCode(deepFreeze({ plain: true }), [])).toBe(false);
	});

	it("plain data that can still be changed marks the call: its caller can give it code after the check", () => {
		expect(carriesCallerCode(undefined, [{}])).toBe(true);
		expect(carriesCallerCode(undefined, [1, []])).toBe(true);
		expect(carriesCallerCode({ plain: true }, [])).toBe(true);
		// Frozen at the top only: a nested object can still be changed.
		expect(carriesCallerCode(undefined, [Object.freeze({ nested: {} })])).toBe(true);
		expect(carriesCallerCode(undefined, [Object.freeze([[]])])).toBe(true);
		// Sealed or non-extensible is not enough: a property's value can still be replaced.
		expect(carriesCallerCode(undefined, [Object.seal({ a: 1 })])).toBe(true);
		expect(carriesCallerCode(undefined, [Object.preventExtensions({ a: 1 })])).toBe(true);
	});

	it("data that can run code still marks the call", () => {
		const getter = {};
		Object.defineProperty(getter, "value", { get: () => 1, enumerable: true });
		expect(carriesCallerCode(undefined, [getter])).toBe(true);
		expect(carriesCallerCode(undefined, [{ toString: () => "x" }])).toBe(true);
		expect(carriesCallerCode(undefined, [{ options: { nested: { onDone() {} } } }])).toBe(true);
		expect(carriesCallerCode(undefined, [{ [Symbol.toPrimitive]: () => 1 }])).toBe(true);
		expect(carriesCallerCode(undefined, [[1, [2, [() => {}]]]])).toBe(true);
		expect(carriesCallerCode(undefined, [new Proxy({}, {})])).toBe(true);
		expect(carriesCallerCode(undefined, [new Date(0)])).toBe(true);
		expect(carriesCallerCode(undefined, [new (class Options {})()])).toBe(true);
		expect(carriesCallerCode({ run() {} }, [])).toBe(true);
	});

	it("data nested deeper than the bound, or wider than it, marks the call", () => {
		let deep = 1;
		for (let level = 0; level < 10; level++) deep = { deep };
		expect(carriesCallerCode(undefined, [deepFreeze(deep)])).toBe(true);
		expect(carriesCallerCode(undefined, [Object.freeze(Array.from({ length: 10_000 }, (_, index) => index))])).toBe(true);
	});

	it("a frozen array longer than the budget is refused before its keys are listed", () => {
		const listed = [];
		const wide = Object.freeze(Array.from({ length: 300 }, (_, index) => index));
		const ownKeys = Reflect.ownKeys;
		Reflect.ownKeys = (target) => {
			listed.push(target);
			return ownKeys(target);
		};
		try {
			expect(carriesCallerCode(undefined, [wide])).toBe(true);
		} finally {
			Reflect.ownKeys = ownKeys;
		}
		expect(listed).not.toContain(wide);
	});

	it("deciding never runs the value's code", () => {
		const trap = () => {
			throw new Error("the value's code ran");
		};
		const hostile = new Proxy({}, { get: trap, has: trap, getPrototypeOf: trap, ownKeys: trap, getOwnPropertyDescriptor: trap });
		expect(carriesCallerCode(hostile, [hostile])).toBe(true);
		// Nested inside plain data, and behind a getter, it is never reached either.
		expect(carriesCallerCode(undefined, [{ a: { b: [hostile] } }])).toBe(true);
		const behindGetter = {};
		Object.defineProperty(behindGetter, "x", { get: trap, enumerable: true });
		expect(carriesCallerCode(undefined, [behindGetter])).toBe(true);
	});

	it("an unmarked call, or one with no module above it, resolves no supplier", () => {
		expect(resolveSupplier(null)).toBeNull();
		expect(resolveSupplier({ wrapper: {}, parent: { wrapper: {} }, flagged: false })).toBeNull();
		expect(resolveSupplier({ wrapper: {}, parent: null, flagged: true })).toBeNull();
		expect(resolveSupplier({ wrapper: {}, parent: { wrapper: null }, flagged: true })).toBeNull();
	});

	it("a chain of objects that are not genuine wrappers resolves no supplier", () => {
		expect(resolveSupplier({ wrapper: {}, parent: { wrapper: {}, parent: null }, flagged: true })).toBeNull();
	});
});

describe("Caller-supplied code (#597) > stack reads", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	const RULES = [
		{ caller: "**", target: "vault.secret.whoami", effect: "allow" },
		{ caller: "supplier.**", target: "callee.**", effect: "allow" }
	];

	it("a host call with primitives, and the module calls it makes with primitives, never read the stack", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST_CALLER_SUPPLIED_CODE, permissions: { defaultPolicy: "deny", rules: RULES } });
		// Load everything first, so the count below sees only the calls.
		await api.supplier.probe.direct("whoami");
		const { captures, result } = await countCaptures(() => api.supplier.probe.direct("whoami"));
		expect(result).toEqual({ ok: true, value: "supplier.probe.direct" });
		expect(captures).toBe(0);
	});

	it("a call handed a frozen plain options object never reads the stack", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST_CALLER_SUPPLIED_CODE, permissions: { defaultPolicy: "deny", rules: RULES } });
		await api.supplier.probe.withPlainOptions();
		const { captures, result } = await countCaptures(() => api.supplier.probe.withPlainOptions());
		expect(result).toEqual({ ok: true, value: "callee.ops.whoamiWith" });
		expect(captures).toBe(0);
	});

	it("a call handed a plain options object that can still change reads the stack, and the leaf is still itself", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST_CALLER_SUPPLIED_CODE, permissions: { defaultPolicy: "deny", rules: RULES } });
		await api.supplier.probe.withUnfrozenOptions();
		const { captures, result } = await countCaptures(() => api.supplier.probe.withUnfrozenOptions());
		expect(result).toEqual({ ok: true, value: "callee.ops.whoamiWith" });
		expect(captures).toBeGreaterThan(0);
	});

	it("a call handed a callback reads the stack when the callback makes a call", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST_CALLER_SUPPLIED_CODE, permissions: { defaultPolicy: "deny", rules: RULES } });
		await api.supplier.probe.viaCallback("whoami");
		const { captures, result } = await countCaptures(() => api.supplier.probe.viaCallback("whoami"));
		expect(result).toEqual({ ok: true, value: "supplier.probe.viaCallback" });
		expect(captures).toBeGreaterThan(0);
	});

	it("a call handed code reads the stack when that code makes a call", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST_CALLER_SUPPLIED_CODE, permissions: { defaultPolicy: "deny", rules: RULES } });
		await api.supplier.probe.viaToString("whoami");
		const { captures, result } = await countCaptures(() => api.supplier.probe.viaToString("whoami"));
		expect(result).toEqual({ ok: true, value: "supplier.probe.viaToString" });
		expect(captures).toBeGreaterThan(0);
	});
});
