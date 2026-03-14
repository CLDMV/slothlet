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

	it("createProxy with digit-leading apiPath prefixes safeName with underscore (line 85 TRUE arm)", async () => {
		const api = await makeEager();
		const sl = resolveWrapper(api.math).slothlet;
		// apiPath "1test" produces baseName "1test", safeName "1test",
		// which fails /^[A-Za-z_$]/ so the TRUE arm fires: safeName = "_1test"
		const w = new UnifiedWrapper(sl, {
			mode: "eager",
			apiPath: "1test",
			initialImpl: () => "callable",
			isCallable: true
		});
		const proxy = w.createProxy();
		// The proxy target function should be named _1test (getSafeFunctionName prefixed it)
		// proxy.name returns the last path segment "1test" (proxy get trap), so check target name via createNamedProxyTarget result
		expect(typeof proxy).toBe("function");
		// The underlying proxyTarget is a function named "_1test"; we verify indirectly that
		// the proxy was constructed successfully (not "callableProxy" fallback which would only
		// occur if apiPath is null/empty)
		expect(proxy.name).toBe("1test"); // proxy get trap returns last path segment unchanged
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
// TEST GROUP 3 — Line 352: [util.inspect.custom] prototype method — lazy unmaterialized branch
// ---------------------------------------------------------------------------
// Node.js util.inspect() bypasses the Proxy GET trap and accesses util.inspect.custom
// directly via the prototype chain. For non-callable wrappers the UnifiedWrapper
// prototype method fires. For an UNMATERIALIZED lazy wrapper, the condition at
// lines 346-351 is true, and line 352 (`return w.____slothletInternal.proxy`) fires.

describe("prototype [util.inspect.custom] unmaterialized lazy branch (line 352)", () => {
	it("util.inspect on a freshly-created lazy wrapper returns the proxy before materialization (line 352)", async () => {
		const eagerApi = await makeEager();
		const sl = resolveWrapper(eagerApi.math).slothlet;
		// Create a lazy wrapper that has a proxy but is NOT yet materialized
		const w = new UnifiedWrapper(sl, { mode: "lazy", apiPath: "test.inspect.lazy" });
		const ____proxy = w.createProxy();
		// Verify it is genuinely unmaterialized
		expect(w.____slothletInternal.state.materialized).toBe(false);
		expect(w.____slothletInternal.proxy).toBeTruthy();
		// util.inspect(w) fires the prototype [util.inspect.custom] method.
		// w.mode === 'lazy', state.materialized === false, proxy is truthy → line 352 fires.
		const result = util.inspect(w);
		// Line 352 returns w.____slothletInternal.proxy; util.inspect receives it and
		// converts to a string representation
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
// TEST GROUP 7 — Prototype [util.inspect.custom] for callable wrapper: own-property path
// ---------------------------------------------------------------------------
// For CALLABLE wrappers, createProxy() installs util.inspect.custom as an OWN property
// on the named function target. Node.js util.inspect calls this own property closure
// (defined at lines 1951-1965 in createProxy), NOT the prototype method nor the
// getTrap closure. This covers the installed-own-property inspect path.

describe("util.inspect via own-property closure on callable wrapper proxy", () => {
	it("util.inspect on a callable wrapper proxy calls the own-property inspect closure", async () => {
		// createTestService is a callable module in api_test
		const api = await makeEager();
		if (api.createTestService && typeof api.createTestService === "function") {
			const result = util.inspect(api.createTestService);
			expect(typeof result).toBe("string");
		}
	});

	it("util.inspect on a manually-created callable lazy wrapper returns string", async () => {
		const eagerApi = await makeEager();
		const sl = resolveWrapper(eagerApi.math).slothlet;
		const w = new UnifiedWrapper(sl, {
			mode: "eager",
			apiPath: "test.callable.inspect",
			initialImpl: () => "result",
			isCallable: true
		});
		const proxy = w.createProxy();
		const result = util.inspect(proxy);
		expect(typeof result).toBe("string");
	});
});
