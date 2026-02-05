/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/isolation/multi-instance-isolation.test.vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:56 -08:00 (1770266396)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Multi-instance isolation tests - verifies different instances operate independently
 * @module tests/vitests/processed/isolation/multi-instance-isolation.test.vitest
 * @memberof tests.vitests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Test all possible combinations to ensure true isolation
const ALL_CONFIGS = getMatrixConfigs({});

describe.each(ALL_CONFIGS)("Multi-Instance Isolation > Config: '$name'", ({ config }) => {
	let slothlet;
	let instances = [];

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
		instances = [];
	});

	afterEach(async () => {
		// Cleanup all instances
		for (const instance of instances) {
			if (instance) {
				await instance.shutdown();
			}
		}
		instances = [];
	});

	it("should create multiple instances with different instance IDs", async () => {
		const api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
		instances.push(api1);

		const api2 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
		instances.push(api2);

		expect(api1.slothlet.instanceID).toBeDefined();
		expect(api2.slothlet.instanceID).toBeDefined();
		expect(api1.slothlet.instanceID).not.toBe(api2.slothlet.instanceID);
	});

	it("should isolate instance context between multiple instances", async () => {
		const api1 = await slothlet({
			...config,
			diagnostics: true,
			dir: TEST_DIRS.API_TEST,
			context: { name: "instance1", value: 100 }
		});
		instances.push(api1);

		const api2 = await slothlet({
			...config,
			diagnostics: true,
			dir: TEST_DIRS.API_TEST,
			context: { name: "instance2", value: 200 }
		});
		instances.push(api2);

		// Verify contexts are isolated
		expect(api1.slothlet.diag.context.name).toBe("instance1");
		expect(api1.slothlet.diag.context.value).toBe(100);

		expect(api2.slothlet.diag.context.name).toBe("instance2");
		expect(api2.slothlet.diag.context.value).toBe(200);
	});

	it("should allow each instance to operate independently", async () => {
		const api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
		instances.push(api1);

		const api2 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
		instances.push(api2);

		// Both instances should be able to call functions
		const result1 = config.mode === "lazy" ? await api1.math.add(2, 3) : api1.math.add(2, 3);
		const result2 = config.mode === "lazy" ? await api2.math.add(5, 7) : api2.math.add(5, 7);

		expect(result1).toBe(5);
		expect(result2).toBe(12);
	});

	it("should maintain separate API structures for each instance", async () => {
		const api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
		instances.push(api1);

		const api2 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
		instances.push(api2);

		// Both should have the same API structure
		expect(api1.math).toBeDefined();
		expect(api2.math).toBeDefined();

		// But they should be separate objects
		expect(api1).not.toBe(api2);
		expect(api1.math).not.toBe(api2.math);
	});

	it("should allow shutdown of one instance without affecting others", async () => {
		const api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
		instances.push(api1);

		const api2 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
		instances.push(api2);

		// Shutdown api1
		await api1.shutdown();

		// api2 should still work
		const result = config.mode === "lazy" ? await api2.math.add(1, 1) : api2.math.add(1, 1);
		expect(result).toBe(2);

		// Remove api1 from cleanup list since we already shut it down
		instances = instances.filter((i) => i !== api1);
	});
});

// Test mixing different modes in separate instances
describe("Multi-Instance Mode Mixing", () => {
	let slothlet;
	let instances = [];

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
		instances = [];
	});

	afterEach(async () => {
		for (const instance of instances) {
			if (instance) {
				await instance.shutdown();
			}
		}
		instances = [];
	});

	it("should allow eager and lazy instances to coexist", async () => {
		const eagerApi = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			hooks: false
		});
		instances.push(eagerApi);

		const lazyApi = await slothlet({
			hooks: false
		});
		instances.push(lazyApi);

		// Eager returns result directly
		const eagerResult = eagerApi.math.add(2, 3);
		expect(eagerResult).toBe(5);

		// Lazy requires await
		const lazyResult = await lazyApi.math.add(2, 3);
		expect(lazyResult).toBe(5);

		// Verify they're different instances
		expect(eagerApi.slothlet.instanceID).not.toBe(lazyApi.slothlet.instanceID);
	});

	it("should allow async and live runtime instances to coexist", async () => {
		const asyncApi = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			hooks: false
		});
		instances.push(asyncApi);

		const liveApi = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "live",
			hooks: false
		});
		instances.push(liveApi);

		// Both should work
		const asyncResult = asyncApi.math.add(2, 3);
		const liveResult = liveApi.math.add(2, 3);

		expect(asyncResult).toBe(5);
		expect(liveResult).toBe(5);

		// Verify they're different instances
		expect(asyncApi.slothlet.instanceID).not.toBe(liveApi.slothlet.instanceID);
	});
});
