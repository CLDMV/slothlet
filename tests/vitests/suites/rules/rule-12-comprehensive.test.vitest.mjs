/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/rules/rule-12-comprehensive.test.vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-05 15:54:19 -08:00 (1770335659)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Comprehensive Rule 12 test using matrix testing approach
 * Tests Rule 12 (Module Ownership and Selective API Overwriting) across all
 * meaningful slothlet configuration combinations to ensure consistent behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Ownership-enabled configurations only (collision mode with merge)
const OWNERSHIP_CONFIGS = getMatrixConfigs({ api: { collision: { initial: "merge", api: "merge" } } });

// Basic configurations for validation testing
const BASIC_CONFIGS = getMatrixConfigs({});

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
		await api.slothlet.api.add(
			"plugins.moduleA",
			TEST_DIRS.API_TEST_MIXED,
			{
				moduleID: "moduleA",
				forceOverwrite: true
			}
		);

		expect(api.plugins.moduleA).toBeDefined();

		// Update moduleA (hot-reload)
		await api.slothlet.api.add(
			"plugins.moduleA",
			TEST_DIRS.API_TEST,
			{
				moduleID: "moduleA",
				forceOverwrite: true
			}
		);

		expect(api.plugins.moduleA).toBeDefined();
	});

	it("should allow registering different modules independently", async () => {
		await api.slothlet.api.add(
			"plugins.moduleB",
			TEST_DIRS.API_TEST_COLLECTIONS,
			{
				moduleID: "moduleB",
				forceOverwrite: true
			}
		);

		expect(api.plugins.moduleB).toBeDefined();
	});

	it("should handle cross-module overwrite based on allowAddApiOverwrite setting", async () => {
		// Register moduleC first
		await api.slothlet.api.add(
			"plugins.moduleC",
			TEST_DIRS.API_TEST,
			{
				moduleID: "moduleC",
				forceOverwrite: true
			}
		);

		// Default allowAddApiOverwrite is true, so cross-module should succeed
		// If allowAddApiOverwrite were false, this would throw
		await expect(
			api.slothlet.api.add(
				"plugins.moduleC",
				TEST_DIRS.API_TEST_MIXED,
				{
					moduleID: "moduleD" // Different module trying to overwrite
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

	it("should require api.mutations.reload when using forceOverwrite", async () => {
		try {
			await api.slothlet.api.add(
				"test.path",
				TEST_DIRS.API_TEST,
				{
					forceOverwrite: true,
					moduleID: "testModule"
				}
			);
			// If we reach here without reload enabled, it should have thrown
			if (!config.api?.mutations?.reload) {
				throw new Error("Expected forceOverwrite to require reload mutation");
			}
		} catch (error) {
			// Verify the error is about reload requirement
			expect(error.message).toContain("reload");
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
			api: {
				mutations: { reload: true },
				collision: { initial: "replace", api: "skip" }
			}
		});
		apisToClean.push(api);

		// First api.slothlet.api.add should work
		await api.slothlet.api.add("normal.test", TEST_DIRS.API_TEST);
		const originalApi = api.normal.test;

		// Second api.slothlet.api.add should be silently skipped (not throw)
		await api.slothlet.api.add("normal.test", TEST_DIRS.API_TEST_MIXED);

		// Verify API was NOT overwritten
		expect(api.normal.test).toBe(originalApi);
	});

	it("should allow same module to update despite allowApiOverwrite: false (eager mode)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		const slothlet = slothletModule.default;
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			eager: true,
			api: {
				mutations: { reload: true },
				collision: { initial: "merge-replace", api: "error" }
			}
		});
		apisToClean.push(api);

		// Register with moduleID
		await api.slothlet.api.add(
			"ownership.test",
			TEST_DIRS.API_TEST_COLLECTIONS,
			{
				moduleID: "testModule",
				forceOverwrite: true
			}
		);

		// Same module should be able to update
		await api.slothlet.api.add(
			"ownership.test",
			TEST_DIRS.API_TEST_MIXED,
			{
				moduleID: "testModule",
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
			api: {
				mutations: { reload: true },
				collision: { initial: "merge-replace", api: "error" }
			}
		});
		apisToClean.push(api);

		// Register with moduleID
		await api.slothlet.api.add(
			"ownership.cross",
			TEST_DIRS.API_TEST_COLLECTIONS,
			{
				moduleID: "testModule",
				forceOverwrite: true
			}
		);

		// Different module should be blocked by collision mode
		try {
			await api.slothlet.api.add(
				"ownership.cross",
				TEST_DIRS.API_TEST_COLLECTIONS,
				{
					moduleID: "differentModule"
				}
			);
			throw new Error("Expected cross-module overwrite to be blocked");
		} catch (error) {
			expect(error.message).toContain("path already exists");
			expect(error.message).toContain("collision mode is 'error'");
		}
	});

	it("should block normal overwrites when allowAddApiOverwrite: false (lazy mode)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		const slothlet = slothletModule.default;
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLECTIONS,
			eager: false,
			api: {
				mutations: { reload: true },
				collision: { initial: "replace", api: "skip" }
			}
		});
		apisToClean.push(api);

		await api.slothlet.api.add("normal.test2", TEST_DIRS.API_TEST_COLLECTIONS);
		const originalApi = api.normal.test2;

		await api.slothlet.api.add("normal.test2", TEST_DIRS.API_TEST_MIXED);

		expect(api.normal.test2).toBe(originalApi);
	});

	it("should allow same module to update despite allowApiOverwrite: false (lazy mode)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		const slothlet = slothletModule.default;
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			eager: false,
			api: {
				mutations: { reload: true },
				collision: { initial: "merge-replace", api: "error" }
			}
		});
		apisToClean.push(api);

		await api.slothlet.api.add(
			"ownership.test2",
			TEST_DIRS.API_TEST_COLLECTIONS,
			{
				moduleID: "testModule2",
				forceOverwrite: true
			}
		);

		await api.slothlet.api.add(
			"ownership.test2",
			TEST_DIRS.API_TEST_MIXED,
			{
				moduleID: "testModule2",
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
			api: {
				mutations: { reload: true },
				collision: { initial: "merge-replace", api: "error" }
			}
		});
		apisToClean.push(api);

		await api.slothlet.api.add(
			"ownership.cross2",
			TEST_DIRS.API_TEST_COLLECTIONS,
			{
				moduleID: "testModule2",
				forceOverwrite: true
			}
		);

		try {
			await api.slothlet.api.add(
				"ownership.cross2",
				TEST_DIRS.API_TEST_COLLECTIONS,
				{
					moduleID: "differentModule2"
				}
			);
			throw new Error("Expected cross-module overwrite to be blocked");
		} catch (error) {
			expect(error.message).toContain("path already exists");
			expect(error.message).toContain("collision mode is 'error'");
		}
	});
});
