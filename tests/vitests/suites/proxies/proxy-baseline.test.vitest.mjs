/**
 * @Project: @cldmv/slothlet
 * @Filename: /tests/vitests/processed/proxies/proxy-baseline.test.vitest.mjs
 * @Date: 2025-01-11 (Migrated from node:test)
 * @Author: Nate Hyson <CLDMV>
 * @Email: <Shinrai@users.noreply.github.com>
 * -----
 * @Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Baseline Test: Proxy Behavior Validation
 *
 * This test validates that custom proxy objects work identically in both
 * lazy and eager modes after the proxy handling fixes.
 *
 * Test Case: LGTVControllers proxy with array-style access and named exports
 * - lg[0] should work (array-style access via proxy get handler)
 * - lg.getStatus should work (named export function)
 * - Both should work identically in lazy and eager modes
 * - Null values are treated as test failures
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS, materialize } from "../../setup/vitest-helper.mjs";
import util from "node:util";

describe.each(getMatrixConfigs())("Proxy Baseline Behavior > Config: '$name'", ({ config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should have api.devices.lg proxy object", () => {
		expect(api.devices).toBeDefined();
		expect(api.devices.lg).toBeDefined();
		expect(api.devices.lg).not.toBeNull();
	});

	it("should have api.devices.lg defined", () => {
		// Original test records type but doesn't assert - lazy=function, eager=object by design
		expect(api.devices.lg).toBeDefined();
		expect(api.devices.lg).not.toBeNull();
	});

	it("should have proxy properties", () => {
		const properties = Object.getOwnPropertyNames(api.devices.lg);
		expect(properties.length).toBeGreaterThan(0);
	});

	it("should support array-style access: lg[0]", () => {
		const controller0 = api.devices.lg[0];
		// Original test just checks not null, doesn't assert on type
		expect(controller0).toBeDefined();
		expect(controller0).not.toBeNull();
	});

	it("should support named export function: lg.getStatus()", async () => {
		expect(api.devices.lg.getStatus).toBeDefined();
		expect(typeof api.devices.lg.getStatus).toBe("function");

		const statusResult = await api.devices.lg.getStatus("tv1");
		expect(statusResult).toBeDefined();
		expect(statusResult).not.toBeNull();
		expect(typeof statusResult).toBe("object");
	});

	it("should have consistent behavior between array access and method calls", async () => {
		const controller0 = api.devices.lg[0];
		const statusResult = await api.devices.lg.getStatus("tv1");

		// Original test just checks not null, doesn't assert on types
		expect(controller0).toBeDefined();
		expect(controller0).not.toBeNull();
		expect(statusResult).toBeDefined();
		expect(statusResult).not.toBeNull();
	});
});

describe("Proxy Behavior Comparison: Lazy vs Eager", () => {
	let slothlet;
	let lazyApi, eagerApi;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
		lazyApi = await slothlet({ dir: TEST_DIRS.API_TV_TEST, mode: "lazy" });
		eagerApi = await slothlet({ dir: TEST_DIRS.API_TV_TEST, mode: "eager" });
	});

	afterEach(async () => {
		if (lazyApi) {
			await lazyApi.shutdown();
			lazyApi = null;
		}
		if (eagerApi) {
			await eagerApi.shutdown();
			eagerApi = null;
		}
	});

	it("should have identical proxy existence in both modes", () => {
		expect(lazyApi.devices.lg).toBeDefined();
		expect(eagerApi.devices.lg).toBeDefined();
		expect(lazyApi.devices.lg).not.toBeNull();
		expect(eagerApi.devices.lg).not.toBeNull();
	});

	it("should have proxy in both modes", () => {
		// Original test records types but doesn't assert they match
		// Lazy=function (wrapper), Eager=object (by design)
		expect(lazyApi.devices.lg).toBeDefined();
		expect(eagerApi.devices.lg).toBeDefined();
	});

	it("should have identical array access results", async () => {
		// Trigger access to start materialization
		const lazyLg = lazyApi.devices.lg;
		const eagerLg = eagerApi.devices.lg;

		// V3 note: lazy mode's materialization is async - _impl is set via callback
		// during async execution. Small delay allows lazy_setImpl to execute and populate _childCache.
		// This matches v2's behavior where state.materialized was set synchronously during async function execution.
		await new Promise((resolve) => setTimeout(resolve, 10));
		// const lazyLg = lazyApi.devices.lg;
		// const eagerLg = eagerApi.devices.lg;

		// NOW access the properties after materialization completes
		const lazyController0 = lazyLg[0];
		const eagerController0 = eagerLg[0];

		expect(lazyController0).toBeDefined();
		expect(eagerController0).toBeDefined();
		expect(lazyController0).not.toBeNull();
		expect(eagerController0).not.toBeNull();

		// In lazy mode, the lg custom proxy should work the same as eager mode
		// Both should return TVController objects with tvId and power properties
		expect(lazyController0.tvId).toBe(eagerController0.tvId);
		expect(typeof lazyController0.power).toBe("object");
		expect(typeof eagerController0.power).toBe("object");
	});

	it("should have identical named export results in both modes", async () => {
		const lazyStatus = await lazyApi.devices.lg.getStatus("tv1");
		const eagerStatus = await eagerApi.devices.lg.getStatus("tv1");

		expect(lazyStatus).toBeDefined();
		expect(eagerStatus).toBeDefined();
		expect(lazyStatus).not.toBeNull();
		expect(eagerStatus).not.toBeNull();

		// Both should return equivalent objects
		expect(JSON.stringify(lazyStatus)).toBe(JSON.stringify(eagerStatus));
	});

	it("should have overall identical proxy behavior", async () => {
		// Trigger access to start materialization
		const lazyLg = lazyApi.devices.lg;
		const eagerLg = eagerApi.devices.lg;

		// V3 note: lazy mode's materialization is async - _impl is set via callback
		// during async execution. Small delay allows lazy_setImpl to execute and populate _childCache.
		await new Promise((resolve) => setTimeout(resolve, 20));

		// NOW access the properties after materialization completes
		const lazyController0 = lazyLg[0];
		const eagerController0 = eagerLg[0];

		const arrayAccessMatch = lazyController0.tvId === eagerController0.tvId;

		// Test named export
		const lazyStatus = await lazyApi.devices.lg.getStatus("tv1");
		const eagerStatus = await eagerApi.devices.lg.getStatus("tv1");
		const namedExportMatch = JSON.stringify(lazyStatus) === JSON.stringify(eagerStatus);

		// Both should match after materialization
		expect(arrayAccessMatch).toBe(true);
		expect(namedExportMatch).toBe(true);
	});
});
