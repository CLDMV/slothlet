/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-inspect-misc.test.vitest.mjs
 *	@Date: 2026-03-02T00:00:00-08:00 (1772496000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 00:00:00 -08:00 (1772496000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for miscellaneous uncovered code paths in unified-wrapper.mjs.
 *
 * @description
 * Targets the following uncovered line clusters:
 *
 *  Line 85: getSafeFunctionName fallback — null apiPath on callable createProxy()
 *  Lines 310-316: prototype [util.inspect.custom] on raw UnifiedWrapper instances
 *  Lines 2133-2163: getTrap closure for util.inspect.custom on proxy objects
 *  Line 352: background materialization via tracking.materialization = true
 *  Line 2122: __metadata fallback when handlers.metadata is null
 *  Line 1179: ___createChildWrapper returns undefined for undefined value
 *
 * @module tests/vitests/suites/unified-wrapper/unified-wrapper-inspect-misc
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import util from "node:util";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper, UnifiedWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ---------------------------------------------------------------------------
// Shared lifecycle helpers
// ---------------------------------------------------------------------------

let _api = null;

afterEach(async () => {
	if (_api && typeof _api.shutdown === "function") {
		await _api.shutdown().catch(() => {});
	}
	_api = null;
});

/**
 * Creates a new eager slothlet instance pointing at api_test.
 * @returns {Promise<object>} The slothlet API proxy.
 */
async function makeEager() {
	_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
	return _api;
}

/**
 * Creates a new lazy slothlet instance pointing at api_test.
 * @returns {Promise<object>} The slothlet API proxy.
 */
async function makeLazy() {
	_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
	return _api;
}

// ---------------------------------------------------------------------------
// TEST GROUP 1 — Line 85: getSafeFunctionName fallback path
// ---------------------------------------------------------------------------

describe("getSafeFunctionName fallback (line 85) — callable createProxy with null apiPath", () => {
	it("createProxy with null apiPath on callable wrapper uses fallback function name", async () => {
		const api = await makeEager();
		const sl = resolveWrapper(api.math).slothlet;
		const w = new UnifiedWrapper(sl, {
			mode: "eager",
			apiPath: null,
			initialImpl: () => "callable",
			isCallable: true
		});
		const proxy = w.createProxy();
		expect(typeof proxy).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// TEST GROUP 2 — Lines 310-316: prototype [util.inspect.custom] on raw wrapper
// ---------------------------------------------------------------------------

describe("prototype [util.inspect.custom] on raw wrapper (lines 310-316)", () => {
	it("util.inspect on a raw eager wrapper with children returns string (hits childKeys branch)", async () => {
		const api = await makeEager();
		const rawMath = resolveWrapper(api.math);
		const result = util.inspect(rawMath);
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	it("util.inspect on raw lazy wrapper returns string (hits lazy branch in prototype inspect)", async () => {
		const api = await makeLazy();
		// resolveWrapper(api.math) accesses the raw UnifiedWrapper; in lazy mode the
		// prototype [util.inspect.custom] takes an alternate path compared to eager.
		const rawMath = resolveWrapper(api.math);
		const result = util.inspect(rawMath);
		// Whether or not materialized, util.inspect must return a string
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// TEST GROUP 3 — Lines 2133-2163: getTrap closure for util.inspect.custom
// ---------------------------------------------------------------------------

describe("getTrap util.inspect.custom closure (lines 2133-2163)", () => {
	it("util.inspect on eager wrapper proxy with children returns string (lines 2133-2143)", async () => {
		const api = await makeEager();
		const result = util.inspect(api.math);
		expect(typeof result).toBe("string");
	});

	it("util.inspect on lazy wrapper proxy returns string (lines 2146-2160)", async () => {
		const api = await makeLazy();
		// api.math in lazy mode exercises the lazy branch of the inspect closure
		const result = util.inspect(api.math);
		expect(typeof result).toBe("string");
	});

	it("util.inspect on wrapper proxy with no children (callable leaf) returns string (line 2163)", async () => {
		// api.math.add is a leaf wrapper with no children (impl is a function)
		// After materialization, childKeys is empty for a leaf function
		const api = await makeEager();
		const mathAdd = api.math.add;
		const result = util.inspect(mathAdd);
		expect(typeof result).toBe("string");
	});
});

// ---------------------------------------------------------------------------
// TEST GROUP 4 — Line 352: background materialization via tracking.materialization: true
// ---------------------------------------------------------------------------

describe("background materialization via tracking.materialization (line 352)", () => {
	it("lazy mode with tracking.materialization starts background materialization via setImmediate", async () => {
		const api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true, tracking: { materialization: true } });
		_api = api;
		// Wrappers are created with mode=lazy and background materialization triggered.
		// Wait multiple ticks to let setImmediate and async materialization complete.
		await new Promise((r) => setImmediate(r));
		await new Promise((r) => setTimeout(r, 50));
		// api should still work normally
		expect(api.math).toBeDefined();
		// Clean up
		await api.shutdown();
		_api = null;
	});
});

// ---------------------------------------------------------------------------
// TEST GROUP 5 — Line 2122: __metadata fallback when metadata handler is null
// ---------------------------------------------------------------------------

describe("__metadata fallback when metadata handler is null (line 2122)", () => {
	it("accessing __metadata on a proxy when handlers.metadata is null returns empty object", async () => {
		const api = await makeEager();
		const sl = resolveWrapper(api.math).slothlet;
		const originalMetadata = sl.handlers.metadata;
		sl.handlers.metadata = null;
		try {
			const meta = api.math.__metadata;
			expect(meta).toEqual({});
		} finally {
			sl.handlers.metadata = originalMetadata;
		}
	});
});

// ---------------------------------------------------------------------------
// TEST GROUP 6 — Line 1179: ___createChildWrapper returns undefined for undefined value
// ---------------------------------------------------------------------------

describe("___createChildWrapper returns undefined for undefined value (line 1179)", () => {
	it("___setImpl with an undefined-valued property hits return undefined in ___createChildWrapper", async () => {
		const api = await makeEager();
		const sl = resolveWrapper(api.math).slothlet;
		const w = new UnifiedWrapper(sl, {
			mode: "eager",
			apiPath: "test.undefined.value",
			initialImpl: null
		});
		// Call ___setImpl with an impl that has an explicitly-undefined property.
		// Object.defineProperty creates an own property descriptor with value=undefined.
		const implWithUndefined = {};
		Object.defineProperty(implWithUndefined, "undefinedValueKey", {
			value: undefined,
			enumerable: true,
			configurable: true
		});
		implWithUndefined.validKey = () => "valid";

		// ___setImpl calls ___adoptImplChildren which calls ___createChildWrapper("undefinedValueKey", undefined)
		// → hits `if (value === undefined) { return undefined; }` at line 1179
		// The call must not throw
		expect(() => w.___setImpl(implWithUndefined)).not.toThrow();

		// validKey should be accessible via the wrapper's proxy
		expect(typeof w.validKey).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// TEST GROUP 7 — Additional util.inspect variants for coverage
// ---------------------------------------------------------------------------

describe("complete util.inspect proxy coverage", () => {
	it("util.inspect on callable wrapper (api.createTestService) exercises callable branch in closure", async () => {
		// createTestService is a callable module in api_test
		const api = await makeEager();
		if (api.createTestService && typeof api.createTestService === "function") {
			const result = util.inspect(api.createTestService);
			expect(typeof result).toBe("string");
		}
	});
});
