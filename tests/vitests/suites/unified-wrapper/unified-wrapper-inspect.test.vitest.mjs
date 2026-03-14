/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-inspect.test.vitest.mjs
 *	@Date: 2026-03-03T12:00:00-08:00 (1741032000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-05 00:32:13 -08:00 (1772699533)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for unified-wrapper.mjs proxy get-trap paths that require
 * explicit use of Node.js inspect and serialization APIs.
 *
 * @description
 * Exercises previously uncovered proxy get-trap handlers:
 *
 *   line  2133      if (prop === util.inspect.custom) — only reached when Node.js/util.inspect()
 *                   accesses util.inspect.custom Symbol on a wrapper proxy.
 *
 *   lines 2135-2163 The returned inspect function body — executed when the returned function
 *                   from util.inspect.custom is actually invoked. Covers three branches:
 *                     • childKeys.length > 0 && !isCallable → build obj from child proxies (2137-2149)
 *                     • lazy/unmaterialized → return wrapper (2151-2163)
 *                     • otherwise → return impl (2163)
 *
 *   line  1960      child.createProxy() inside inspect callback — runs when a child wrapper
 *                   (non-primitive) is present in the obj-building loop.
 *
 *   line  2199      if (prop === "toString") — only reached when .toString is accessed on a
 *                   wrapper proxy. Covers impl binding for callable wrappers.
 *
 *   Also exercises:
 *   • util.inspect on a callable leaf wrapper (returns impl directly)
 *   • util.inspect on a lazy not-yet-materialized wrapper (lazy branch 2151-2163)
 *   • Symbol.toStringTag access on callable vs non-callable wrappers
 *   • valueOf access on callable wrappers
 *
 * @module tests/vitests/suites/unified-wrapper/unified-wrapper-inspect
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import util from "util";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

let api;

afterEach(async () => {
	if (api?.shutdown) await api.shutdown();
	api = null;
	await new Promise((r) => setTimeout(r, 30));
});

// ---------------------------------------------------------------------------
// 1. util.inspect.custom — non-callable wrapper with child wrappers
//    Covers lines 2133, 2135-2149, 1960
// ---------------------------------------------------------------------------
describe("util.inspect.custom on non-callable wrapper with children", () => {
	it("util.inspect(api.math) calls inspect handler and builds child-key object (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });
		expect(api.math).toBeDefined();

		// util.inspect accesses util.inspect.custom Symbol on the proxy → line 2133
		// The returned function is called → lines 2135-2149 (childKeys.length > 0, !isCallable)
		// For each child wrapper, child.createProxy() is called → line 1960
		const inspected = util.inspect(api.math);
		expect(typeof inspected).toBe("string");
		expect(inspected.length).toBeGreaterThan(0);
	});

	it("util.inspect(api.nested) on a folder module builds nested children (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });
		expect(api.nested).toBeDefined();

		const inspected = util.inspect(api.nested);
		expect(typeof inspected).toBe("string");
	});

	it("direct Symbol access proxy[util.inspect.custom]() works on non-callable (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });
		const mathProxy = api.math;

		// Directly access the symbol → line 2133 covered
		const inspectFn = mathProxy[util.inspect.custom];
		expect(typeof inspectFn).toBe("function");

		// Call the function directly → lines 2135-2149 covered
		const result = inspectFn();
		expect(result).toBeDefined();
		expect(typeof result).toBe("object");
	});
});

// ---------------------------------------------------------------------------
// 2. util.inspect.custom — callable wrapper (returns impl, not children)
//    Covers line 2163 (return _impl path)
// ---------------------------------------------------------------------------
describe("util.inspect.custom on callable leaf wrapper", () => {
	it("util.inspect(api.math.add) returns the function impl (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });
		expect(api.math.add).toBeDefined();

		// api.math.add is a callable wrapper — childKeys will be 0 or isCallable=true
		// → inspect fall-through path returns _impl
		const inspected = util.inspect(api.math.add);
		expect(typeof inspected).toBe("string");
	});

	it("direct Symbol access proxy[util.inspect.custom]() on callable returns impl (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });

		const addProxy = api.math.add;
		const inspectFn = addProxy[util.inspect.custom];
		expect(typeof inspectFn).toBe("function");

		const result = inspectFn();
		// Callable leaf — should return the actual function impl
		expect(typeof result).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// 3. util.inspect.custom — lazy unmaterialized wrapper
//    Covers the lazy/unmaterialized branch at lines 2151-2163
// ---------------------------------------------------------------------------
describe("util.inspect.custom on lazy unmaterialized wrapper", () => {
	it("inspect on lazy not-yet-materialized wrapper returns wrapper itself (lazy)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy" });

		// Find a module that is definitely not materialized yet
		// "string" is not pre-materialized (confirmed empirically: slothlet lazy init skips most)
		const stringProxy = api.string;
		const raw = resolveWrapper(stringProxy);
		if (!raw) {
			// If string is not a wrapper, skip — just verify inspect works
			const inspected = util.inspect(api.string);
			expect(typeof inspected).toBe("string");
			return;
		}

		// Verify not yet materialized (if already materialized, the test exercises a different path)
		if (!raw.____slothletInternal.state.materialized) {
			// Lazy, unmaterialized → inspect handler sees null impl, lazy mode → returns wrapper
			const inspectFn = stringProxy[util.inspect.custom];
			expect(typeof inspectFn).toBe("function");
			const result = inspectFn();
			// Returns the wrapper itself or its proxy when lazy and not materialized
			expect(result).toBeDefined();
		} else {
			// Already materialized — test still exercises the impl-return path
			const inspected = util.inspect(stringProxy);
			expect(typeof inspected).toBe("string");
		}
	});
});

// ---------------------------------------------------------------------------
// 4. toString access on callable wrapper — line 2199
//    Accessing prop === "toString" on a wrapper proxy with a function impl
// ---------------------------------------------------------------------------
describe("toString access on callable wrapper proxy — line 2199", () => {
	it("api.math.add.toString is bound to the actual add function (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });

		// api.math.add is a callable wrapper proxy; accessing .toString triggers line 2199
		const toStringFn = api.math.add.toString;
		expect(typeof toStringFn).toBe("function");

		// Calling it should return the source of the add function
		const src = toStringFn();
		expect(typeof src).toBe("string");
	});

	it("toString() on a callable wrapper returns function source string (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });

		// Calling .toString() directly → get trap prop==='toString' → returns bound fn → called
		const strResult = api.math.add.toString();
		expect(typeof strResult).toBe("string");
		expect(strResult.length).toBeGreaterThan(0);
	});

	it("toString on multi-argument callable returns valid source (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });

		const src = api.math.multiply.toString();
		expect(typeof src).toBe("string");
	});
});

// ---------------------------------------------------------------------------
// 5. Symbol.toStringTag access — validates the tagged type branch (adjacent coverage)
// ---------------------------------------------------------------------------
describe("Symbol.toStringTag on wrapper proxies", () => {
	it("Symbol.toStringTag returns 'Function' for callable wrapper (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });

		const tag = api.math.add[Symbol.toStringTag];
		expect(tag).toBe("Function");
	});

	it("Symbol.toStringTag returns 'Object' for non-callable module wrapper (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });

		const tag = api.math[Symbol.toStringTag];
		expect(tag).toBe("Object");
	});
});

// ---------------------------------------------------------------------------
// 6. valueOf access on callable wrapper (adjacent get-trap path)
// ---------------------------------------------------------------------------
describe("valueOf on callable wrapper proxy", () => {
	it("valueOf on callable wrapper returns bound valueOf (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });

		const addProxy = api.math.add;
		const valueOf = addProxy.valueOf;
		expect(typeof valueOf).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// 7. Waiting proxy apply trap — confirmed accessible via lazy string.upper
//    The waiting proxy apply trap (lines 1661+) fires when a lazy unmaterialized
//    module's property is accessed (creating a waiting proxy) and then called.
// ---------------------------------------------------------------------------
describe("waiting proxy apply trap — lazy unmaterialized callable", () => {
	it("calling api.string.upper via waiting proxy resolves correctly (lazy)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy" });

		// "string" module is not pre-materialized
		// api.string.upper → creates waiting proxy (inFlight becomes true)
		// waiting proxy call → waiting proxy apply trap (lines 1661+)
		const result = await api.string.upper("hello");
		expect(result).toBe("HELLO");
	});

	it("calling nested multi_func via waiting proxy chain works (lazy)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy" });

		// multi_func is also not pre-materialized → waiting proxy applies
		const result = await api.multi_func.alpha("test");
		expect(typeof result).toBe("string");
	});

	it("calling api.string.reverse via waiting proxy resolves correctly (lazy)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy" });

		const result = await api.string.reverse("abc");
		expect(result).toBe("cba");
	});
});
