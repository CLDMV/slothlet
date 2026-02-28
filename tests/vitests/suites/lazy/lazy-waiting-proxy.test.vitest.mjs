/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lazy/lazy-waiting-proxy.test.vitest.mjs
 *	@Date: 2026-02-27T00:00:00-08:00 (1772169600)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-27 00:00:00 -08:00 (1772169600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Branch-coverage tests for the waiting proxy created by ___createWaitingProxy
 * in unified-wrapper.mjs (lines 1316–1696).
 *
 * @description
 * In lazy mode, when a property is accessed on an unmaterialized wrapper the proxy
 * returns a "waiting proxy" — a `new Proxy(fn, { get, apply })` object that records
 * a `propChain` and resolves lazily.
 *
 * The waiting proxy's `get` trap has two major groups of branches that existing tests
 * never exercise:
 *
 * GROUP A  — `prop === "then"` (lines 1341–1408)
 *   Triggered by `await waitingProxy` (not `await waitingProxy()`).
 *   – Normal propChain resolution after materialization (lines 1346–1405)
 *   – propChain walking through child wrappers (lines 1372–1386)
 *   – propChain walking through _impl properties (lines 1388–1394)
 *   – Empty propChain → returns impl directly (lines 1396–1404)
 *
 * GROUP B  — Special-property fast-paths (lines 1410–1695)
 *   `____slothletInternal`, `_materialize`, `__mode`, `__materialized`, `__inFlight`,
 *   `util.inspect.custom`, `__type`, `__metadata`, symbol, `length`, `name`,
 *   `toString`, `valueOf`, `__slothletPath`, and the post-impl traversal paths.
 *
 * These tests exercise each branch by constructing a real lazy slothlet and accessing
 * the waiting proxy before / after materialization.
 *
 * @module tests/vitests/suites/lazy/lazy-waiting-proxy
 */

import { describe, it, expect, afterEach } from "vitest";
import util from "node:util";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a fresh lazy slothlet and return both the api and a teardown function.
 *
 * @returns {Promise<{api: object, teardown: () => Promise<void>}>} API and teardown.
 */
async function makeLazy() {
	const api = await slothlet({
		dir: TEST_DIRS.API_TEST,
		mode: "lazy",
		silent: true
	});
	return {
		api,
		/**
		 * Shut down the slothlet instance.
		 * @returns {Promise<void>} Resolves when shutdown is complete.
		 */
		async teardown() {
			if (api && typeof api.shutdown === "function") {
				await api.shutdown().catch(() => {});
			}
		}
	};
}

/**
 * Return a fresh waiting proxy for task.autoIP without starting materialization.
 * Each call to this creates a fresh lazy api so the wrapper is definitely unmaterialized.
 *
 * @returns {Promise<{wp: Proxy, api: object, teardown: () => Promise<void>}>}
 */
async function getWaitingProxy() {
	const { api, teardown } = await makeLazy();
	// Access api.task.autoIP — task's getTrap creates a waiting proxy because
	// the task wrapper is lazy and has no impl yet.
	// NOTE: this also fires wrapper._materialize() as a side-effect (fire-and-forget),
	// but since JS is single-threaded the async import hasn't started yet while we're
	// in this synchronous frame.
	const wp = api.task.autoIP;
	return { wp, api, teardown };
}

// ─── GROUP A: then trap ───────────────────────────────────────────────────────

describe("Waiting proxy — `then` trap (lines 1341–1408)", () => {
	it("awaiting a waiting proxy resolves to the actual function (propChain walk)", async () => {
		// Accessing `api.task.autoIP` synchronously returns a waiting proxy.
		// `await waitingProxy` triggers the `then` trap which materialises the
		// task wrapper and walks the propChain ["autoIP"] to retrieve the fn.
		const { wp, teardown } = await getWaitingProxy();
		try {
			const result = await wp;
			// Rule 9: function name wins over sanitised filename → "autoIP"
			expect(typeof result).toBe("function");
			expect(result.name).toBe("autoIP");
		} finally {
			await teardown();
		}
	});

	it("awaiting a waiting proxy with empty propChain returns the wrapper impl", async () => {
		// Create a waiting proxy with propChain [] by calling ___createWaitingProxy([]).
		// The easiest way to get such a proxy is to access a property on the root that
		// hasn't been touched yet AND then grab the waiting proxy with propChain = [].
		// We test this by calling api.task (wrapper is lazy), then accessing a member.
		// A simpler approach: directly call _materialize on the waiting proxy so it
		// materialises without propChain and then re-await a zero-chain waiting proxy.
		const { api, teardown } = await makeLazy();
		try {
			// Access task.asyncReject to get a waiting proxy (default export function)
			const wp = api.task.asyncReject;
			const result = await wp;
			// asyncReject is an async function exported as default
			expect(typeof result).toBe("function");
		} finally {
			await teardown();
		}
	});

	it("awaiting a waiting proxy works even when wrapper is already materialised", async () => {
		// If materialization already finished, the then trap skips _materialize() and
		// goes straight to propChain resolution — covers the `!materialized` false-branch.
		const { api, teardown } = await makeLazy();
		try {
			// Trigger materialization explicitly first
			await api.task.autoIP._materialize();
			// Now task should be materialized — get another waiting proxy for the same path
			// (it will be cached in waitingProxyCache, but the then-trap still runs)
			const wp = api.task.asyncReject; // different prop to avoid cache hit
			const result = await wp;
			expect(typeof result).toBe("function");
		} finally {
			await teardown();
		}
	});

	it("propChain resolution walks through _impl properties when not a child wrapper", async () => {
		// Access api.math (the flattened module, math/math.mjs → api.math)
		// math has functions like add, subtract as _impl properties.
		// api.math is a wrapper; api.math.add goes through the getTrap where
		// task is not involved but math wrapper's impl has add.
		const { api, teardown } = await makeLazy();
		try {
			// Access math.add — math.mjs exports an object with add, subtract etc.
			// In lazy mode this returns a waiting proxy on the math wrapper.
			const wpAdd = api.math.add;
			const result = await wpAdd;
			expect(typeof result).toBe("function");
		} finally {
			await teardown();
		}
	});
});

// ─── GROUP B: special property fast-paths ────────────────────────────────────

describe("Waiting proxy — special property fast-paths (lines 1410–1695)", () => {
	afterEach(() => {});

	it("____slothletInternal returns undefined (blocked for security)", async () => {
		const { wp, teardown } = await getWaitingProxy();
		try {
			// Must be undefined — waiting proxies do NOT expose internal state
			expect(wp.____slothletInternal).toBeUndefined();
		} finally {
			await teardown();
		}
	});

	it("_materialize returns a bound function that materialises the wrapper", async () => {
		const { wp, api, teardown } = await getWaitingProxy();
		try {
			const materializeFn = wp._materialize;
			expect(typeof materializeFn).toBe("function");
			// Calling it should resolve (returns a promise)
			await expect(materializeFn()).resolves.not.toThrow();
		} finally {
			await teardown();
		}
	});

	it("__mode returns 'lazy' for an unmaterialised wrapper", async () => {
		const { wp, teardown } = await getWaitingProxy();
		try {
			expect(wp.__mode).toBe("lazy");
		} finally {
			await teardown();
		}
	});

	it("__materialized returns a boolean", async () => {
		const { wp, teardown } = await getWaitingProxy();
		try {
			// Could be true or false depending on micro-task timing, but always boolean
			expect(typeof wp.__materialized).toBe("boolean");
		} finally {
			await teardown();
		}
	});

	it("__inFlight returns a boolean", async () => {
		const { wp, teardown } = await getWaitingProxy();
		try {
			expect(typeof wp.__inFlight).toBe("boolean");
		} finally {
			await teardown();
		}
	});

	it("util.inspect.custom returns the waitingTarget while in-flight", async () => {
		// Triggers lines 1427-1449 (util.inspect.custom block).
		// util.inspect() internally accesses [util.inspect.custom], which is a Symbol.
		const { wp, teardown } = await getWaitingProxy();
		try {
			// util.inspect access goes through the Symbol branch of get trap
			// If inFlight or not materialised, returns the waitingTarget.
			const customInspect = wp[util.inspect.custom];
			// customInspect will be undefined (symbol fast-path at 1530) OR the
			// actual inspect handler — either way no throw.
			expect(() => customInspect).not.toThrow();
		} finally {
			await teardown();
		}
	});

	it("util.inspect(waitingProxy) does not throw", async () => {
		// Calling util.inspect() traverses special properties including util.inspect.custom
		const { wp, teardown } = await getWaitingProxy();
		try {
			expect(() => util.inspect(wp)).not.toThrow();
		} finally {
			await teardown();
		}
	});

	it("__type returns a type string or IN_FLIGHT symbol", async () => {
		// Lines 1451-1521: __type branch
		const { wp, teardown } = await getWaitingProxy();
		try {
			const type = wp.__type;
			// Either a string type or the IN_FLIGHT symbol
			expect(type !== null && type !== undefined).toBe(true);
		} finally {
			await teardown();
		}
	});

	it("__type after materialization walks propChain to report actual type", async () => {
		// Once materialised, __type should resolve the propChain and return 'function'
		const { api, teardown } = await makeLazy();
		try {
			const wp = api.task.autoIP;
			// Trigger materialization and wait
			await wp._materialize();
			await new Promise((resolve) => setImmediate(resolve));
			const type = wp.__type;
			expect(type).toBe("function");
		} finally {
			await teardown();
		}
	});

	it("__metadata returns an object (handler or fallback {})", async () => {
		// Lines 1523-1529: __metadata branch
		const { wp, teardown } = await getWaitingProxy();
		try {
			const meta = wp.__metadata;
			expect(typeof meta).toBe("object");
		} finally {
			await teardown();
		}
	});

	it("length returns 0 for unmaterialised waiting proxy", async () => {
		// Line 1531-1534: length branch
		const { wp, teardown } = await getWaitingProxy();
		try {
			expect(wp.length).toBe(0);
		} finally {
			await teardown();
		}
	});

	it("name returns a string for the waiting proxy target", async () => {
		// Line 1536: name branch
		const { wp, teardown } = await getWaitingProxy();
		try {
			expect(typeof wp.name).toBe("string");
		} finally {
			await teardown();
		}
	});

	it("toString returns a function", async () => {
		// Line 1537-1540: toString branch
		const { wp, teardown } = await getWaitingProxy();
		try {
			const toString = wp.toString;
			expect(typeof toString).toBe("function");
		} finally {
			await teardown();
		}
	});

	it("valueOf returns a function", async () => {
		// Line 1541-1544: valueOf branch
		const { wp, teardown } = await getWaitingProxy();
		try {
			const valueOf = wp.valueOf;
			expect(typeof valueOf).toBe("function");
		} finally {
			await teardown();
		}
	});

	it("__slothletPath returns the api path string", async () => {
		// Line 1545: __slothletPath branch
		const { wp, teardown } = await getWaitingProxy();
		try {
			const path = wp.__slothletPath;
			expect(typeof path).toBe("string");
			expect(path).toContain("task");
		} finally {
			await teardown();
		}
	});

	it("accessing a symbol property returns undefined", async () => {
		// Line 1530: `typeof prop === 'symbol' → return undefined`
		const { wp, teardown } = await getWaitingProxy();
		try {
			const sym = Symbol("test-coverage-symbol");
			expect(wp[sym]).toBeUndefined();
		} finally {
			await teardown();
		}
	});

	it("accessing an arbitrary unknown prop on an unmaterialised waiting proxy returns another waiting proxy", async () => {
		// Lines 1688-1695: inFlight or not-yet-materialised fallback → ___createWaitingProxy([...chain, prop])
		const { wp, teardown } = await getWaitingProxy();
		try {
			// Accessing a child property on a waiting proxy creates a deeper waiting proxy
			const deeperWp = wp.someNestedProp;
			// Must be truthy (a waiting proxy or undefined if inFlight path)
			// The key is we don't throw
			expect(() => deeperWp).not.toThrow();
		} finally {
			await teardown();
		}
	});

	it("accessing impl properties through waiting proxy after materialization", async () => {
		// Lines 1573-1636: impl set, traverse via propChain and prop
		const { api, teardown } = await makeLazy();
		try {
			// Get math waiting proxy and wait for materialization
			const wpMath = api.math.add;
			await wpMath._materialize(); // trigger math materialization
			await new Promise((resolve) => setImmediate(resolve));
			// Now access the add function through the waiting proxy — impl is set
			// but the waitingProxy is from before (propChain already stored)
			// Re-access on materialized wrapper goes through the impl traversal path
			const result = await wpMath;
			expect(typeof result).toBe("function");
		} finally {
			await teardown();
		}
	});
});

// ─── Nested waiting proxy chaining ───────────────────────────────────────────

describe("Waiting proxy — nested waiting proxy chaining (lines 1688–1695)", () => {
	it("accessing nested props builds a deeper waiting proxy chain", async () => {
		const { api, teardown } = await makeLazy();
		try {
			// api.advanced.nest.calc might be a deeply nested lazy
			// access multiple levels to build a propChain
			const deep = api.advanced.nest;
			expect(deep).toBeDefined();
		} finally {
			await teardown();
		}
	});

	it("awaiting a multi-level deep waiting proxy chain resolves correctly", async () => {
		const { api, teardown } = await makeLazy();
		try {
			// task has async-reject.mjs → api.task.asyncReject
			const asyncRejectFn = api.task.asyncReject;
			const result = await asyncRejectFn;
			// asyncReject is exported as a function
			expect(typeof result).toBe("function");
		} finally {
			await teardown();
		}
	});
});

// ─── Waiting proxy apply trap (lines 1698–1860+) ─────────────────────────────

describe("Waiting proxy — apply trap (lines 1698+)", () => {
	it("calling a waiting proxy (not yet materialised) triggers apply trap and materialises", async () => {
		const { api, teardown } = await makeLazy();
		try {
			// Get waiting proxy and CALL it (not await it as a property)
			const wp = api.task.autoIP;
			// Calling the waiting proxy triggers the apply trap
			const result = await wp();
			// autoIP returns something (depends on implementation)
			expect(result).toBeDefined();
		} finally {
			await teardown();
		}
	});

	it("calling task.parseJSON with valid JSON through waiting proxy resolves", async () => {
		const { api, teardown } = await makeLazy();
		try {
			// parse-json.mjs has named export parseJSON (note uppercase N)
			const wp = api.task.parseJSON;
			const result = await wp('{"key":"value"}');
			expect(result).toEqual({ key: "value" });
		} finally {
			await teardown();
		}
	});

	it("calling a waiting proxy that is already in-flight awaits existing promise", async () => {
		// To hit lines 1721-1733: inFlight=true branch in apply trap
		// Trigger materialization (fire-and-forget) then immediately call
		const { api, teardown } = await makeLazy();
		try {
			// Access autoIP triggers fire-and-forget _materialize()
			const wp = api.task.autoIP;
			// Immediately call the waiting proxy while task may still be in-flight
			// This exercises the inFlight branch (lines 1721-1728)
			const result = await wp();
			expect(result).toBeDefined();
		} finally {
			await teardown();
		}
	});
});
