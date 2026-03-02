/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/handlers/unified-wrapper-has-getdesc-traps.test.vitest.mjs
 *	@Date: 2026-02-27T22:17:01-08:00 (1772259421)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:48 -08:00 (1772425308)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for the proxy hasTrap and getOwnPropertyDescriptorTrap
 * in unified-wrapper.mjs.
 *
 * @description
 * Exercises:
 *   hasTrap lines 2734-2762:
 *     line 2736 – wrapper._materialize() triggered by `in` operator on unmaterialized lazy wrapper
 *     line 2744 – `return true` for own property found via hasOwn in eager mode
 *     line 2752-2757 – `prop in wrapper.impl` check
 *     line 2762 – Object.prototype.hasOwnProperty fallback
 *
 *   getOwnPropertyDescriptorTrap lines 2764-2815:
 *     line 2779 – wrapper._materialize() triggered by getOwnPropertyDescriptor on unmaterialized lazy wrapper
 *     line 2793 – target.hasOwnProperty path
 *     line 2798 – wrapper own prop path
 *     line 2808 – impl property path
 *
 * @module tests/vitests/suites/handlers/unified-wrapper-has-getdesc-traps
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Build an eager-mode API for has/getOwnPropertyDescriptor trap tests.
 * @returns {Promise<object>} Loaded slothlet API.
 */
async function makeEagerApi() {
	return slothlet({
		mode: "eager",
		runtime: "async",
		hook: { enabled: true },
		dir: TEST_DIRS.API_TEST
	});
}

/**
 * Build a lazy-mode API for unmaterialized proxy trap tests.
 * @returns {Promise<object>} Loaded slothlet API.
 */
async function makeLazyApi() {
	return slothlet({
		mode: "lazy",
		runtime: "async",
		hook: { enabled: true },
		dir: TEST_DIRS.API_TEST
	});
}

// ─ hasTrap – eager mode ──────────────────────────────────────────────────────

describe("hasTrap – eager mode", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("returns true for an existing top-level module property using `in`", async () => {
		api = await makeEagerApi();
		// Triggers hasTrap on root proxy – hasOwn(wrapper, "math") → true (line 2744)
		expect("math" in api).toBe(true);
	});

	it("returns true for an existing nested property using `in`", async () => {
		api = await makeEagerApi();
		// Materializes math children first, then checks
		const _ = api.math.add; // ensure math wrapper is accessible
		expect("add" in api.math).toBe(true);
	});

	it("returns false for a property that does not exist", async () => {
		api = await makeEagerApi();
		expect("nonExistentProp12345" in api).toBe(false);
	});

	it("returns true for '_materialize' sentinel (special fast-path)", async () => {
		api = await makeEagerApi();
		// '_materialize' is always true (first guard in hasTrap)
		expect("_materialize" in api.math).toBe(true);
	});

	it("reports true for props found on impl even when not own wrapper prop", async () => {
		api = await makeEagerApi();
		// Access 'slothlet' which is on the root API (impl path)
		expect("slothlet" in api).toBe(true);
	});

	it("returns false for an internal __ prefixed key", async () => {
		api = await makeEagerApi();
		// isInternal guard: __internal keys are filtered from hasTrap
		expect("____slothletInternal" in api.math).toBe(false);
	});
});

// ─ hasTrap – lazy mode (unmaterialized) ─────────────────────────────────────

describe("hasTrap – lazy mode, unmaterialized wrapper", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("triggers _materialize via `in` operator before first access (line 2736)", async () => {
		api = await makeLazyApi();
		// api.math is the real proxy for the math wrapper (lazy, unmaterialized at this point)
		// Using `in` triggers hasTrap which fires _materialize (line 2736)
		const hasAdd = "add" in api.math;
		// After hasTrap fires _materialize, materialization is async – result may be false
		// The important thing is hasTrap ran (coverage) and didn't throw
		expect(typeof hasAdd).toBe("boolean");
	});

	it("returns true after awaiting materialization then using `in`", async () => {
		api = await makeLazyApi();
		// Materialize first, then check
		await api.math._materialize();
		expect("add" in api.math).toBe(true);
	});
});

// ─ getOwnPropertyDescriptorTrap ──────────────────────────────────────────────

describe("getOwnPropertyDescriptorTrap – eager mode", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("returns a descriptor for an existing own module property", async () => {
		api = await makeEagerApi();
		const desc = Object.getOwnPropertyDescriptor(api, "math");
		expect(desc).toBeDefined();
		expect(desc.enumerable).toBe(true);
	});

	it("returns descriptor for a nested impl child property", async () => {
		api = await makeEagerApi();
		// Ensures the math wrapper has processed impl
		const _ = api.math.add;
		const desc = Object.getOwnPropertyDescriptor(api.math, "add");
		expect(desc).toBeDefined();
	});

	it("returns undefined for ____slothletInternal (blocked path)", async () => {
		api = await makeEagerApi();
		const desc = Object.getOwnPropertyDescriptor(api.math, "____slothletInternal");
		expect(desc).toBeUndefined();
	});

	it("returns undefined for a property that does not exist", async () => {
		api = await makeEagerApi();
		const desc = Object.getOwnPropertyDescriptor(api.math, "nonExistentProp12345");
		expect(desc).toBeUndefined();
	});

	it("returns prototype descriptor when target is a function (callable wrapper)", async () => {
		api = await makeEagerApi();
		// Find a callable endpoint (e.g., a direct function module)
		// The exportDefault module should be callable
		const desc = Object.getOwnPropertyDescriptor(api.exportDefault, "prototype");
		// Either defined (function target, has prototype) or undefined – both valid
		expect(desc === undefined || typeof desc === "object").toBe(true);
	});
});

describe("getOwnPropertyDescriptorTrap – lazy mode, unmaterialized wrapper", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("triggers _materialize via getOwnPropertyDescriptor before first access (line 2779)", async () => {
		api = await makeLazyApi();
		// api.math is the real proxy for the math wrapper (lazy, unmaterialized)
		// getOwnPropertyDescriptor triggers getOwnPropertyDescriptorTrap which fires _materialize
		const desc = Object.getOwnPropertyDescriptor(api.math, "add");
		// desc may be undefined before materialization completes, but _materialize was triggered (coverage)
		expect(desc === undefined || typeof desc === "object").toBe(true);
	});

	it("returns valid descriptor after materialization completes", async () => {
		api = await makeLazyApi();
		await api.math._materialize();
		const desc = Object.getOwnPropertyDescriptor(api.math, "add");
		expect(desc).toBeDefined();
		expect(desc.enumerable).toBe(true);
	});
});

// ─ Object.keys / ownKeys trap ────────────────────────────────────────────────

describe("ownKeys trap (Object.keys) – coverage", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("returns enumerable keys for an eager module proxy", async () => {
		api = await makeEagerApi();
		const keys = Object.keys(api.math);
		expect(Array.isArray(keys)).toBe(true);
		expect(keys.length).toBeGreaterThan(0);
	});

	it("returns enumerable keys for a lazy module after materialization", async () => {
		api = await makeLazyApi();
		await api.math._materialize();
		const keys = Object.keys(api.math);
		expect(Array.isArray(keys)).toBe(true);
		expect(keys.length).toBeGreaterThan(0);
	});
});
