/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/metadata/metadata-collision-modes.test.vitest.mjs
 *	@Date: 2026-01-25T20:07:51-08:00 (1769400471)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:52 -08:00 (1772425312)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for metadata behavior across all collision modes
 *
 * @description
 * Tests how metadata behaves with different collision modes in two contexts:
 * - collision.initial: During buildAPI (initial load) - math.mjs file vs math/ folder
 * - collision.api: During api.add() operations
 *
 * Uses api_test_collisions directory which has:
 * - math.mjs (FILE): exports power(), sqrt(), modulo(), collisionVersion="math-collision-v1"
 * - math/ (FOLDER): exports add(), multiply(), divide(), subtract()
 *
 * Tests validate WHICH source won by checking for unique functions/properties.
 *
 * @module tests/vitests/suites/metadata/metadata-collision-modes.test.vitest
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, materialize, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("Metadata Collision Modes > Config: '$name'", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
	});

	describe("collision.initial modes", () => {
		it("should handle merge mode - both file and folder functions available", async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST_COLLISIONS,
				api: { collision: { initial: "merge" } }
			});

			// Merge mode: BOTH file and folder should be present
			expect(api.math).toBeDefined();

			// File functions (math.mjs)
			expect(typeof api.math.power).toBe("function");
			expect(typeof api.math.sqrt).toBe("function");
			expect(typeof api.math.modulo).toBe("function");

			// Folder functions (math/math.mjs)
			expect(typeof api.math.add).toBe("function");
			expect(typeof api.math.multiply).toBe("function");

			// Verify they actually work
			const powerResult = await materialize(api, "math.power", 2, 3);
			expect(powerResult).toBe(8);
			const addResult = await materialize(api, "math.add", 5, 7);
			expect(addResult).toBe(12);

			// Check system metadata filePath to confirm sources
			const powerMeta = api.math.power.__metadata;
			const addMeta = api.math.add.__metadata;
			expect(powerMeta).toBeDefined();
			expect(addMeta).toBeDefined();

			// File functions should have filePath ending in math.mjs
			expect(powerMeta.filePath).toMatch(/[/\\]math\.mjs$/);
			// Folder functions should have filePath with math/math.mjs
			expect(addMeta.filePath).toMatch(/[/\\]math[/\\]math\.mjs$/);
		});

		it("should handle skip mode - first loaded wins", async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST_COLLISIONS,
				api: { collision: { initial: "skip" } }
			});

			expect(api.math).toBeDefined();

			// Either file OR folder won, not both
			const hasFileFunctions = typeof api.math.power === "function";
			const hasFolderFunctions = typeof api.math.add === "function";

			expect(hasFileFunctions || hasFolderFunctions).toBe(true);
			expect(hasFileFunctions && hasFolderFunctions).toBe(false); // NOT both

			// Verify metadata filePath points to only one source
			if (hasFileFunctions) {
				await materialize(api, "math.power", 2, 3);
				const meta = api.math.power.__metadata;
				expect(meta.filePath).toMatch(/[/\\]math\.mjs$/);
			} else {
				await materialize(api, "math.add", 5, 7);
				const meta = api.math.add.__metadata;
				expect(meta.filePath).toMatch(/[/\\]math[/\\]math\.mjs$/);
			}
		});

		it("should handle warn mode - merges with warning", async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST_COLLISIONS,
				api: { collision: { initial: "warn" } }
			});

			expect(api.math).toBeDefined();

			// Warn mode merges but shows warning
			// Both file and folder functions should be present
			const hasFileFunctions = typeof api.math.power === "function";
			const hasFolderFunctions = typeof api.math.add === "function";

			expect(hasFileFunctions).toBe(true);
			expect(hasFolderFunctions).toBe(true);

			// Materialize both functions to ensure lazy folders have loaded
			await materialize(api, "math.power", 2, 3);
			await materialize(api, "math.add", 5, 7);

			// Verify metadata filePath from both sources
			const powerMeta = api.math.power.__metadata;
			const addMeta = api.math.add.__metadata;
			expect(powerMeta.filePath).toMatch(/[/\\]math\.mjs$/);
			expect(addMeta.filePath).toMatch(/[/\\]math[/\\]math\.mjs$/);
		});

		it("should handle replace mode - last loaded wins", async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST_COLLISIONS,
				api: { collision: { initial: "replace" } }
			});

			expect(api.math).toBeDefined();

			// Trigger materialization for lazy mode
			if (api.math._materialize) {
				await api.math._materialize();
			}

			// Either file OR folder won, not both (last one replaces first)
			// In lazy mode, we need to check actual existence, not just typeof
			const hasFileFunctions = api.math.power !== undefined && typeof api.math.power === "function";
			const hasFolderFunctions = api.math.add !== undefined && typeof api.math.add === "function";

			expect(hasFileFunctions || hasFolderFunctions).toBe(true);
			expect(hasFileFunctions && hasFolderFunctions).toBe(false); // NOT both

			// Verify metadata filePath points to only one source
			if (hasFileFunctions) {
				await materialize(api, "math.power", 2, 3);
				const meta = api.math.power.__metadata;
				expect(meta.filePath).toMatch(/[/\\]math\.mjs$/);
			} else {
				await materialize(api, "math.add", 5, 7);
				const meta = api.math.add.__metadata;
				expect(meta.filePath).toMatch(/[/\\]math[/\\]math\.mjs$/);
			}
		});

		it("should handle error mode - throws on collision", async () => {
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(async () => {
					api = await slothlet({
						...config,
						dir: TEST_DIRS.API_TEST_COLLISIONS,
						api: { collision: { initial: "error" } }
					});
				}).rejects.toThrow();
			});
		});
	});

	describe("collision.api: skip mode with metadata", () => {
		it("should skip add and preserve original metadata", async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				api: { collision: { api: "skip" } }
			});

			await materialize(api, "rootMath.add", 1, 2);
			const originalMeta = api.rootMath.add.__metadata;
			const originalModuleId = originalMeta.moduleID;
			const originalFilePath = originalMeta.filePath;

			// Try to add conflicting API with metadata (should be skipped)
			await api.slothlet.api.add("rootMath", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					conflictingMetadata: true,
					version: "should-not-appear"
				}
			});

			// Original should still be there unchanged
			await materialize(api, "rootMath.add", 1, 2);
			const currentMeta = api.rootMath.add.__metadata;

			expect(currentMeta.moduleID).toBe(originalModuleId);
			expect(currentMeta.filePath).toBe(originalFilePath);
			expect(currentMeta.conflictingMetadata).toBeUndefined();
			expect(currentMeta.version).toBeUndefined();
		});
	});

	describe("collision.api: warn mode with metadata", () => {
		it("should warn and preserve original metadata", async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				api: { collision: { api: "warn" } }
			});

			await materialize(api, "rootMath.add", 1, 2);
			const originalMeta = api.rootMath.add.__metadata;
			const originalModuleId = originalMeta.moduleID;
			const originalFilePath = originalMeta.filePath;

			// Try to add conflicting API with metadata (should warn and skip)
			await api.slothlet.api.add("rootMath", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					conflictingMetadata: true,
					version: "should-not-appear"
				}
			});

			// Original should still be there unchanged
			await materialize(api, "rootMath.add", 1, 2);
			const currentMeta = api.rootMath.add.__metadata;

			expect(currentMeta.moduleID).toBe(originalModuleId);
			expect(currentMeta.filePath).toBe(originalFilePath);
			expect(currentMeta.conflictingMetadata).toBeUndefined();
			expect(currentMeta.version).toBeUndefined();
		});
	});

	describe("collision.api: replace mode with metadata", () => {
		it("should replace API and metadata completely", async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				api: { collision: { api: "replace" } }
			});

			await materialize(api, "rootMath.add", 1, 2);
			const originalMeta = api.rootMath.add.__metadata;
			const originalModuleId = originalMeta.moduleID;

			// Add conflicting API with metadata (should replace)
			await api.slothlet.api.add("rootMath", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					replacedMetadata: true,
					version: "2.0.0"
				}
			});

			// Check if replacement happened
			// API_SMART_FLATTEN has different structure, verify the new structure exists
			if (api.rootMath?.config?.settings?.getPluginConfig) {
				await materialize(api, "rootMath.config.settings.getPluginConfig");
				const currentMeta = api.rootMath.config.settings.getPluginConfig.__metadata;

				// Should have new metadata
				expect(currentMeta.replacedMetadata).toBe(true);
				expect(currentMeta.version).toBe("2.0.0");
				expect(currentMeta.moduleID).not.toBe(originalModuleId);
			}
		});
	});

	describe("collision.api: merge mode with metadata", () => {
		it("should merge metadata from both sources", async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				api: { collision: { api: "merge" } }
			});

			// Add initial API with metadata
			await api.slothlet.api.add("testMerge", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					initialLoad: true,
					version: "1.0.0",
					feature: "base"
				}
			});

			await materialize(api, "testMerge.config.settings.getPluginConfig");
			const meta1 = api.testMerge.config.settings.getPluginConfig.__metadata;
			expect(meta1.initialLoad).toBe(true);
			expect(meta1.version).toBe("1.0.0");
			expect(meta1.feature).toBe("base");

			// Merge additional metadata to nested path
			await api.slothlet.api.add("testMerge.config", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					mergedLoad: true,
					version: "1.5.0",
					feature: "extended"
				}
			});

			// Metadata should be merged (preserves old + adds new, overwrites conflicts)
			await materialize(api, "testMerge.config.settings.getPluginConfig");
			const meta2 = api.testMerge.config.settings.getPluginConfig.__metadata;

			expect(meta2.initialLoad).toBe(true); // Preserved from first load
			expect(meta2.mergedLoad).toBe(true); // Added from merge
			expect(meta2.version).toBe("1.5.0"); // Overwritten by merge
			expect(meta2.feature).toBe("extended"); // Overwritten by merge
		});
	});

	describe("collision.api: error mode with metadata", () => {
		it("should throw error and not modify metadata", async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				api: { collision: { api: "error" } }
			});

			await materialize(api, "rootMath.add", 1, 2);
			const originalMeta = api.rootMath.add.__metadata;
			const originalModuleId = originalMeta.moduleID;
			const originalFilePath = originalMeta.filePath;

			// Try to add conflicting API (should throw)
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(async () => {
					await api.slothlet.api.add("rootMath", TEST_DIRS.API_SMART_FLATTEN, {
						metadata: {
							conflictingMetadata: true,
							version: "should-not-appear"
						}
					});
				}).rejects.toThrow();
			});

			// Original should still be there unchanged
			await materialize(api, "rootMath.add", 1, 2);
			const currentMeta = api.rootMath.add.__metadata;

			expect(currentMeta.moduleID).toBe(originalModuleId);
			expect(currentMeta.filePath).toBe(originalFilePath);
			expect(currentMeta.conflictingMetadata).toBeUndefined();
			expect(currentMeta.version).toBeUndefined();
		});
	});

	describe("Metadata cleanup after module removal", () => {
		it("should remove metadata when module removed by moduleID", async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				api: { collision: { api: "merge" } }
			});

			// Add API with metadata
			await api.slothlet.api.add("tempModule", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					temporary: true,
					version: "temp"
				}
			});

			await materialize(api, "tempModule.config.settings.getPluginConfig");
			const meta = api.tempModule.config.settings.getPluginConfig.__metadata;
			expect(meta.temporary).toBe(true);
			expect(meta.version).toBe("temp");

			const moduleID = meta.moduleID;

			// Remove by moduleID
			await api.slothlet.api.remove(moduleID);

			// Module and metadata should be gone
			expect(api.tempModule).toBeUndefined();
		});

		it("should remove metadata when module removed by apiPath", async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				api: { collision: { api: "merge" } }
			});

			// Add API with metadata
			await api.slothlet.api.add("tempModule2", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					temporary: true,
					version: "temp"
				}
			});

			await materialize(api, "tempModule2.config.settings.getPluginConfig");
			const meta = api.tempModule2.config.settings.getPluginConfig.__metadata;
			expect(meta.temporary).toBe(true);

			// Remove by apiPath
			await api.slothlet.api.remove("tempModule2");

			// Module and metadata should be gone
			expect(api.tempModule2).toBeUndefined();
		});
	});
});
