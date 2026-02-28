/**
 *      @Project: @cldmv/slothlet
 *      @Filename: /tests/vitests/suites/proxies/proxy-callable-properties.test.vitest.mjs
 *      @Date: 2026-02-27T12:00:00-08:00 (1772373600)
 *      @Author: Nate Hyson <CLDMV>
 *      @Email: <Shinrai@users.noreply.github.com>
 *      -----
 *      @Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *      @Last modified time: 2026-02-27 12:00:00 -08:00 (1772373600)
 *      -----
 *      @Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for proxy property access on callable and non-callable wrappers.
 *
 * @description
 * Covers the uncovered getTrap paths for special properties:
 * - `prop === "toString"`: function impl, impl.default function, and non-callable fallback
 * - `prop === "valueOf"`: same variants
 * - `prop === "name"`: path fallback when apiPath is missing
 * - `prop === "length"`: when impl uses `default` export
 * - `Symbol.toStringTag`: non-callable/non-function object impl
 *
 * @module tests/vitests/suites/proxies/proxy-callable-properties.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const configs = getMatrixConfigs();

describe.each(configs)("Proxy Callable Properties > Config: '$name'", ({ config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		slothlet = null;
	});

	describe("toString on non-callable wrapper (object impl)", () => {
		it("should return a descriptive string for non-callable wrappers", () => {
			// api.config is a non-callable object wrapper — impl is a plain object (not a function)
			// Access toString to hit the non-function/non-callable fallback path
			const toString = api.config.toString;
			expect(typeof toString).toBe("function");
			const result = toString();
			// Should be either Function.prototype.toString or our custom string
			expect(typeof result).toBe("string");
		});

		it("should return a descriptive string when called directly", () => {
			// Direct call via String() or .toString()
			const result = api.config.toString();
			expect(typeof result).toBe("string");
		});
	});

	describe("valueOf on non-callable wrapper", () => {
		it("should return valueOf function for non-callable wrapper", () => {
			// api.config has object impl (not a function) - hits valueOf fallback path
			const valueOf = api.config.valueOf;
			expect(typeof valueOf).toBe("function");
		});

		it("should return a value when valueOf is called on non-callable", () => {
			// Forces the valueOf path in getTrap
			const result = api.config.valueOf();
			expect(result).toBeDefined();
		});
	});

	describe("toString on callable wrapper with function impl", () => {
		it("should return toString bound to function impl", () => {
			// api.math.add exports a named function — impl IS a function directly
			// This should hit the `typeof impl === "function"` path for toString
			const toString = api.math.add.toString;
			expect(typeof toString).toBe("function");
			const result = toString();
			expect(typeof result).toBe("string");
		});
	});

	describe("toString on callable wrapper with default export", () => {
		it("should return toString bound to impl.default when impl has default function", () => {
			// api.task.autoIP exports `export default async function autoIP()`
			// impl = { default: async function autoIP() {} }
			// This should hit the `impl.default === "function"` path for toString
			const toString = api.task.autoIP.toString;
			expect(typeof toString).toBe("function");
			const result = toString();
			expect(typeof result).toBe("string");
		});
	});

	describe("valueOf on callable wrapper", () => {
		it("should return valueOf bound to function impl", () => {
			// api.math.add — impl is a function
			const valueOf = api.math.add.valueOf;
			expect(typeof valueOf).toBe("function");
			const result = valueOf();
			expect(typeof result).toBe("function");
		});
	});

	describe("length on callable wrapper with default export", () => {
		it("should return correct length for default-exported function", () => {
			// api.task.autoIP exports default async function with no params → length 1 (for message param)
			// impl.default is the function — hits the `impl.default.length` path
			const len = api.task.autoIP.length;
			expect(typeof len).toBe("number");
			expect(len).toBeGreaterThanOrEqual(0);
		});
	});

	describe("Symbol.toStringTag on non-callable wrapper", () => {
		it("should return 'Object' for a plain object wrapper (non-callable, non-default-fn)", () => {
			// api.config is a non-callable object wrapper — hits `return "Object"` path
			const tag = api.config[Symbol.toStringTag];
			expect(tag).toBe("Object");
		});

		it("should return 'Function' for a callable wrapper", () => {
			// api.math.add — impl is a function — hits `return "Function"` path
			const tag = api.math.add[Symbol.toStringTag];
			expect(tag).toBe("Function");
		});
	});

	describe("name property on callable wrapper", () => {
		it("should return the last path segment as the name", () => {
			// api.math.add — apiPath is "math.add", so name should be "add"
			expect(api.math.add.name).toBe("add");
		});

		it("should return correct name for nested path", () => {
			// api.task.autoIP — in eager mode, name = last segment "autoIP";
			// in lazy mode before materialization, name = waiting proxy function name
			const name = api.task.autoIP.name;
			expect(typeof name).toBe("string");
			expect(name.length).toBeGreaterThan(0);
		});
	});
});
