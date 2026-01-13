/**
 * @Project: @cldmv/slothlet
 * @Filename: /tests/vitests/processed/rules/rule-12-comprehensive.test.vitest.mjs
 * @Date: 2025-01-11 (Migrated from node:test)
 * @Author: Nate Hyson <CLDMV>
 * @Email: <Shinrai@users.noreply.github.com>
 * -----
 * @Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Comprehensive Rule 12 test using matrix testing approach
 * Tests Rule 12 (Module Ownership and Selective API Overwriting) across all
 * meaningful slothlet configuration combinations to ensure consistent behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OWNERSHIP_MATRIX, getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Ownership-enabled configurations only (hotReload: true)
const OWNERSHIP_CONFIGS = OWNERSHIP_MATRIX;

// Basic configurations (hotReload: false) for validation testing
const BASIC_CONFIGS = getMatrixConfigs({ hotReload: false });

describe.each(OWNERSHIP_CONFIGS)("Rule 12 Ownership Tracking - $name", ({ name: ___name, config }) => {
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
	});

	it("should allow module to register and update its own APIs", async () => {
		// Register moduleA - use absolute paths relative to current test directory
		await api.addApi(
			"plugins.moduleA",
			TEST_DIRS.API_TEST_MIXED,
			{},
			{
				moduleId: "moduleA",
				forceOverwrite: true
			}
		);

		expect(api.plugins.moduleA).toBeDefined();

		// Update moduleA (hot-reload)
		await api.addApi(
			"plugins.moduleA",
			TEST_DIRS.API_TEST,
			{},
			{
				moduleId: "moduleA",
				forceOverwrite: true
			}
		);

		expect(api.plugins.moduleA).toBeDefined();
	});

	it("should allow registering different modules independently", async () => {
		await api.addApi(
			"plugins.moduleB",
			TEST_DIRS.API_TEST_COLLECTIONS,
			{},
			{
				moduleId: "moduleB",
				forceOverwrite: true
			}
		);

		expect(api.plugins.moduleB).toBeDefined();
	});

	it("should handle cross-module overwrite based on allowApiOverwrite setting", async () => {
		// Register moduleC first
		await api.addApi(
			"plugins.moduleC",
			TEST_DIRS.API_TEST,
			{},
			{
				moduleId: "moduleC",
				forceOverwrite: true
			}
		);

		// Default allowApiOverwrite is true, so cross-module should succeed
		// If allowApiOverwrite were false, this would throw
		await expect(
			api.addApi(
				"plugins.moduleC",
				TEST_DIRS.API_TEST_MIXED,
				{},
				{
					moduleId: "moduleD" // Different module trying to overwrite
				}
			)
		).resolves.not.toThrow();
	});
});

describe.each(BASIC_CONFIGS)("Rule 12 Configuration Validation - $name", ({ name: ___name, config }) => {
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
	});

	it("should require hotReload when using forceOverwrite", async () => {
		try {
			await api.addApi(
				"test.path",
				TEST_DIRS.API_TEST,
				{},
				{
					forceOverwrite: true,
					moduleId: "testModule"
				}
			);
			// If we reach here without hotReload, it should have thrown
			if (!config.hotReload) {
				throw new Error("Expected forceOverwrite to require hotReload");
			}
		} catch (error) {
			// Verify the error is about hotReload requirement
			expect(error.message).toContain("forceOverwrite requires hotReload");
		}
	});
});

describe("Rule 12 with allowApiOverwrite: false", () => {
	let apisToClean = [];

	afterEach(async () => {
		for (const api of apisToClean) {
			if (api) {
				await api.shutdown();
			}
		}
		apisToClean = [];
	});

	it("should block normal overwrites when allowApiOverwrite: false (eager mode)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		const slothlet = slothletModule.default;
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			eager: true,
			hotReload: true,
			allowApiOverwrite: false
		});
		apisToClean.push(api);

		// First addApi should work
		await api.addApi("normal.test", TEST_DIRS.API_TEST);
		const originalApi = api.normal.test;

		// Second addApi should be silently skipped (not throw)
		await api.addApi("normal.test", TEST_DIRS.API_TEST_MIXED);

		// Verify API was NOT overwritten
		expect(api.normal.test).toBe(originalApi);
	});

	it("should allow same module to update despite allowApiOverwrite: false (eager mode)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		const slothlet = slothletModule.default;
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			eager: true,
			hotReload: true,
			allowApiOverwrite: false
		});
		apisToClean.push(api);

		// Register with moduleId
		await api.addApi(
			"ownership.test",
			TEST_DIRS.API_TEST,
			{},
			{
				moduleId: "testModule",
				forceOverwrite: true
			}
		);

		// Same module should be able to update
		await api.addApi(
			"ownership.test",
			TEST_DIRS.API_TEST_MIXED,
			{},
			{
				moduleId: "testModule",
				forceOverwrite: true
			}
		);

		// Original test doesn't check reference identity - just verifies operation succeeds
		// Module ownership allows same module to update (slothlet preserves reference correctly)
		expect(api.ownership.test).toBeDefined();
	});

	it("should block cross-module overwrites when allowApiOverwrite: false (eager mode)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		const slothlet = slothletModule.default;
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			eager: true,
			hotReload: true,
			allowApiOverwrite: false
		});
		apisToClean.push(api);

		// Register with moduleId
		await api.addApi(
			"ownership.cross",
			TEST_DIRS.API_TEST,
			{},
			{
				moduleId: "testModule",
				forceOverwrite: true
			}
		);

		// Different module should be blocked
		try {
			await api.addApi(
				"ownership.cross",
				TEST_DIRS.API_TEST_COLLECTIONS,
				{},
				{
					moduleId: "differentModule"
				}
			);
			throw new Error("Expected cross-module overwrite to be blocked");
		} catch (error) {
			expect(error.message).toContain("owned by module");
			expect(error.message).toContain("testModule");
		}
	});

	it("should block normal overwrites when allowApiOverwrite: false (lazy mode)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		const slothlet = slothletModule.default;
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			eager: false,
			hotReload: true,
			allowApiOverwrite: false
		});
		apisToClean.push(api);

		await api.addApi("normal.test2", TEST_DIRS.API_TEST);
		const originalApi = api.normal.test2;

		await api.addApi("normal.test2", TEST_DIRS.API_TEST_MIXED);

		expect(api.normal.test2).toBe(originalApi);
	});

	it("should allow same module to update despite allowApiOverwrite: false (lazy mode)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		const slothlet = slothletModule.default;
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			eager: false,
			hotReload: true,
			allowApiOverwrite: false
		});
		apisToClean.push(api);

		await api.addApi(
			"ownership.test2",
			TEST_DIRS.API_TEST,
			{},
			{
				moduleId: "testModule2",
				forceOverwrite: true
			}
		);

		await api.addApi(
			"ownership.test2",
			TEST_DIRS.API_TEST_MIXED,
			{},
			{
				moduleId: "testModule2",
				forceOverwrite: true
			}
		);

		// Original test doesn't check reference identity - just verifies operation succeeds
		expect(api.ownership.test2).toBeDefined();
	});

	it("should block cross-module overwrites when allowApiOverwrite: false (lazy mode)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		const slothlet = slothletModule.default;
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			eager: false,
			hotReload: true,
			allowApiOverwrite: false
		});
		apisToClean.push(api);

		await api.addApi(
			"ownership.cross2",
			TEST_DIRS.API_TEST,
			{},
			{
				moduleId: "testModule2",
				forceOverwrite: true
			}
		);

		try {
			await api.addApi(
				"ownership.cross2",
				TEST_DIRS.API_TEST_COLLECTIONS,
				{},
				{
					moduleId: "differentModule2"
				}
			);
			throw new Error("Expected cross-module overwrite to be blocked");
		} catch (error) {
			expect(error.message).toContain("owned by module");
			expect(error.message).toContain("testModule2");
		}
	});
});
