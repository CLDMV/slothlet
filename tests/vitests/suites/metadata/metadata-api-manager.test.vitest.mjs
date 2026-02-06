/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/metadata/metadata-api-manager.test.vitest.mjs
 *	@Date: 2026-01-25T13:23:08-08:00 (1769376188)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:57 -08:00 (1770266397)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for metadata behavior with API Manager (add/remove).
 *
 * Tests how metadata behaves when using:
 * - api.slothlet.api.add() - Add new API modules
 * - api.slothlet.api.remove() - Remove API modules
 *
 * Note: This is NOT hot reload - these are API manager operations.
 * Hot reload is api.slothlet.reload() and api.slothlet.api.reload().
 *
 * @module tests/vitests/suites/metadata/metadata-api-manager.test.vitest
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, materialize } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("Metadata API Manager > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
	});

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
	});

	describe("api.add() Metadata Behavior", () => {
		it("should attach metadata to newly added API", async () => {
			await api.slothlet.api.add("newApi", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					added: true,
					timestamp: Date.now()
				}
			});

			await materialize(api, "newApi.config.settings.getPluginConfig");
			const meta = api.newApi.config.settings.getPluginConfig.__metadata;

			expect(meta.added).toBe(true);
			expect(meta.timestamp).toBeDefined();
			expect(meta.moduleID).toContain("newApi");
		});

		it("should support multiple add() calls with different metadata", async () => {
			await api.slothlet.api.add("api1", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					name: "api1",
					order: 1
				}
			});

			await api.slothlet.api.add("api2", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					name: "api2",
					order: 2
				}
			});

			await materialize(api, "api1.config.settings.getPluginConfig");
			await materialize(api, "api2.config.settings.getPluginConfig");

			const meta1 = api.api1.config.settings.getPluginConfig.__metadata;
			const meta2 = api.api2.config.settings.getPluginConfig.__metadata;

			expect(meta1.name).toBe("api1");
			expect(meta1.order).toBe(1);
			expect(meta2.name).toBe("api2");
			expect(meta2.order).toBe(2);
		});
	});

	describe("api.remove() Metadata Cleanup", () => {
		it("should clean up metadata when API is removed", async () => {
			await api.slothlet.api.add("removable", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					temporary: true
				}
			});

			await materialize(api, "removable.config.settings.getPluginConfig");
			expect(api.removable).toBeDefined();

			await api.slothlet.api.remove("removable");
			expect(api.removable).toBeUndefined();
		});

		it("should not affect metadata of unrelated APIs", async () => {
			await api.slothlet.api.add("keep", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					permanent: true
				}
			});

			await api.slothlet.api.add("remove", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					temporary: true
				}
			});

			await materialize(api, "keep.config.settings.getPluginConfig");
			const metaBefore = api.keep.config.settings.getPluginConfig.__metadata;

			await api.slothlet.api.remove("remove");

			await materialize(api, "keep.config.settings.getPluginConfig");
			const metaAfter = api.keep.config.settings.getPluginConfig.__metadata;
		});
	});

	describe("Replace Behavior (remove + add)", () => {
		it("should replace metadata when re-adding to same path", async () => {
			await api.slothlet.api.add("replaceable", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					version: "1.0.0",
					iteration: 1
				}
			});

			await materialize(api, "replaceable.config.settings.getPluginConfig");
			const meta1 = api.replaceable.config.settings.getPluginConfig.__metadata;
			expect(meta1.version).toBe("1.0.0");

			await api.slothlet.api.remove("replaceable");
			await api.slothlet.api.add("replaceable", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					version: "2.0.0",
					iteration: 2
				}
			});

			await materialize(api, "replaceable.config.settings.getPluginConfig");
			const meta2 = api.replaceable.config.settings.getPluginConfig.__metadata;

			expect(meta2.version).toBe("2.0.0");
			expect(meta2.iteration).toBe(2);
			expect(meta2.moduleID).not.toBe(meta1.moduleID); // New moduleID
		});
	});

	describe("Multiple Add/Remove Cycles", () => {
		it("should handle multiple add/remove/add cycles", async () => {
			const cycles = 3;

			for (let i = 1; i <= cycles; i++) {
				await api.slothlet.api.add("cycled", TEST_DIRS.API_SMART_FLATTEN, {
					metadata: {
						cycle: i,
						timestamp: Date.now()
					}
				});

				await materialize(api, "cycled.config.settings.getPluginConfig");
				const meta = api.cycled.config.settings.getPluginConfig.__metadata;
				expect(meta.cycle).toBe(i);

				if (i < cycles) {
					await api.slothlet.api.remove("cycled");
					expect(api.cycled).toBeUndefined();
				}
			}

			// Final state
			const finalMeta = api.cycled.config.settings.getPluginConfig.__metadata;
			expect(finalMeta.cycle).toBe(cycles);
		});
	});

	describe("Partial Path Removal", () => {
		it("should remove metadata for partial paths", async () => {
			await api.slothlet.api.add("partial", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					partial: true
				}
			});

			await materialize(api, "partial.config.settings.getPluginConfig");
			expect(api.partial.config).toBeDefined();

			// Remove just config subtree
			await api.slothlet.api.remove("partial.config");

			expect(api.partial).toBeDefined(); // Parent still exists
			expect(api.partial.config).toBeUndefined(); // Child removed
		});
	});

	describe("Internal API Access During api.add()/remove() (self.slothlet.metadata.*)", () => {
		it("should access newly added API via internal metadata.get()", async () => {
			await api.slothlet.api.add("internalAdd", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					addedViaInternal: true,
					timestamp: Date.now()
				}
			});

			await materialize(api, "internalAdd.config.settings.getPluginConfig");

			// Access via internal API
			const metadata = await api.metadataTestHelper.getMetadata("internalAdd.config.settings.getPluginConfig");

			expect(metadata).toBeDefined();
			expect(metadata.addedViaInternal).toBe(true);
			expect(metadata.timestamp).toBeDefined();
			expect(metadata.apiPath).toBe("internalAdd.config.settings.getPluginConfig");
		});

		it("should reflect user metadata set via external API in internal API", async () => {
			await api.slothlet.api.add("crossCheck", TEST_DIRS.API_SMART_FLATTEN);
			await materialize(api, "crossCheck.config.settings.getPluginConfig");

			// Set via external API
			api.slothlet.metadata.set(api.crossCheck.config.settings.getPluginConfig, "externalValue", "test123");

			// Read via internal API
			const metadata = await api.metadataTestHelper.getMetadata("crossCheck.config.settings.getPluginConfig");
			expect(metadata.externalValue).toBe("test123");
		});

		it("should return undefined after api.remove() via internal API", async () => {
			await api.slothlet.api.add("removableInternal", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					temporary: true
				}
			});

			await materialize(api, "removableInternal.config.settings.getPluginConfig");

			// Verify exists via internal API
			let metadata = await api.metadataTestHelper.getMetadata("removableInternal.config.settings.getPluginConfig");
			expect(metadata).toBeDefined();
			expect(metadata.temporary).toBe(true);

			// Remove
			await api.slothlet.api.remove("removableInternal");

			// Should be undefined via internal API
			metadata = await api.metadataTestHelper.getMetadata("removableInternal.config.settings.getPluginConfig");
			expect(metadata).toBeUndefined();
		});

		it("should handle multiple add/remove cycles via internal API", async () => {
			for (let cycle = 1; cycle <= 3; cycle++) {
				// Add with cycle metadata
				await api.slothlet.api.add("cycleInternal", TEST_DIRS.API_SMART_FLATTEN, {
					metadata: {
						cycle,
						iteration: `cycle_${cycle}`
					}
				});

				await materialize(api, "cycleInternal.config.settings.getPluginConfig");

				// Verify via internal API
				const metadata = await api.metadataTestHelper.getMetadata("cycleInternal.config.settings.getPluginConfig");
				expect(metadata.cycle).toBe(cycle);
				expect(metadata.iteration).toBe(`cycle_${cycle}`);

				// Remove
				await api.slothlet.api.remove("cycleInternal");

				// Verify removed via internal API
				const afterRemove = await api.metadataTestHelper.getMetadata("cycleInternal.config.settings.getPluginConfig");
				expect(afterRemove).toBeUndefined();
			}
		});

		it("should track partial removal via internal API", async () => {
			await api.slothlet.api.add("partialInternal", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					hasConfig: true
				}
			});

			await materialize(api, "partialInternal.config.settings.getPluginConfig");

			// Verify parent exists
			const beforeRemove = await api.metadataTestHelper.getMetadata("partialInternal.config.settings.getPluginConfig");
			expect(beforeRemove).toBeDefined();

			// Remove subtree
			await api.slothlet.api.remove("partialInternal.config");

			// Child should be gone
			const afterRemove = await api.metadataTestHelper.getMetadata("partialInternal.config.settings.getPluginConfig");
			expect(afterRemove).toBeUndefined();
		});
	});
});
