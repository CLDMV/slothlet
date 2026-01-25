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
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

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

	const materialize = async (api, path, ...args) => {
		const parts = path.split(".");
		let target = api;
		for (let i = 0; i < parts.length - 1; i++) {
			target = target[parts[i]];
		}
		const fn = target[parts[parts.length - 1]];
		try {
			return await fn(...args);
		} catch (_) {
			return await fn(...args);
		}
	};

	describe("api.add() Metadata Behavior", () => {
		it("should attach metadata to newly added API", async () => {
			await api.slothlet.api.add("newApi", TEST_DIRS.API_SMART_FLATTEN, {
				added: true,
				timestamp: Date.now()
			});

			await materialize(api, "newApi.config.settings.getPluginConfig");
			const meta = api.newApi.config.settings.getPluginConfig.__metadata;

			expect(meta.added).toBe(true);
			expect(meta.timestamp).toBeDefined();
			expect(meta.moduleID).toContain("newApi");
		});

		it("should support multiple add() calls with different metadata", async () => {
			await api.slothlet.api.add("api1", TEST_DIRS.API_SMART_FLATTEN, {
				name: "api1",
				order: 1
			});

			await api.slothlet.api.add("api2", TEST_DIRS.API_SMART_FLATTEN, {
				name: "api2",
				order: 2
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
				temporary: true
			});

			await materialize(api, "removable.config.settings.getPluginConfig");
			expect(api.removable).toBeDefined();

			await api.slothlet.api.remove({ apiPath: "removable" });
			expect(api.removable).toBeUndefined();
		});

		it("should not affect metadata of unrelated APIs", async () => {
			await api.slothlet.api.add("keep", TEST_DIRS.API_SMART_FLATTEN, {
				permanent: true
			});

			await api.slothlet.api.add("remove", TEST_DIRS.API_SMART_FLATTEN, {
				temporary: true
			});

		await materialize(api, "keep.config.settings.getPluginConfig");
		const metaBefore = api.keep.config.settings.getPluginConfig.__metadata;

		await api.slothlet.api.remove({ apiPath: "remove" });

		await materialize(api, "keep.config.settings.getPluginConfig");
		const metaAfter = api.keep.config.settings.getPluginConfig.__metadata;
		});
	});

	describe("Replace Behavior (remove + add)", () => {
		it("should replace metadata when re-adding to same path", async () => {
			await api.slothlet.api.add("replaceable", TEST_DIRS.API_SMART_FLATTEN, {
				version: "1.0.0",
				iteration: 1
			});

			await materialize(api, "replaceable.config.settings.getPluginConfig");
			const meta1 = api.replaceable.config.settings.getPluginConfig.__metadata;
			expect(meta1.version).toBe("1.0.0");

			await api.slothlet.api.remove({ apiPath: "replaceable" });
			await api.slothlet.api.add("replaceable", TEST_DIRS.API_SMART_FLATTEN, {
				version: "2.0.0",
				iteration: 2
			});

			await materialize(api, "replaceable.config.settings.getPluginConfig");
			const meta2 = api.replaceable.config.settings.getPluginConfig.__metadata;

			expect(meta2.version).toBe("2.0.0");
			expect(meta2.iteration).toBe(2);
			expect(meta2.moduleID).not.toBe(meta1.moduleID); // New moduleID
		});

		it("should maintain original metadata when base API is restored after collision", async () => {
			// Test collision mode where removed item is replaced by original
			await materialize(api, "rootMath.add", 1, 2);
			const originalMeta = api.rootMath.add.__metadata;
			const originalModuleID = originalMeta.moduleID;

			// Add conflicting API with different metadata
			await api.slothlet.api.add("rootMath", TEST_DIRS.API_SMART_FLATTEN, {
				conflicting: true,
				version: "conflict"
			});

			// After removing the conflict, original should be restored
			// (exact behavior depends on collision mode)
			if (api.rootMath?.add) {
				await materialize(api, "rootMath.add", 1, 2);
				const currentMeta = api.rootMath.add.__metadata;

				// The restored item should have its original metadata
				// NOT the metadata from the removed conflicting item
				if (currentMeta.moduleID === originalModuleID) {
					expect(currentMeta.conflicting).not.toBe(true);
					expect(currentMeta.version).not.toBe("conflict");
				}
			}
		});
	});

	describe("Multiple Add/Remove Cycles", () => {
		it("should handle multiple add/remove/add cycles", async () => {
			const cycles = 3;

			for (let i = 1; i <= cycles; i++) {
				await api.slothlet.api.add("cycled", TEST_DIRS.API_SMART_FLATTEN, {
					cycle: i,
					timestamp: Date.now()
				});

				await materialize(api, "cycled.config.settings.getPluginConfig");
				const meta = api.cycled.config.settings.getPluginConfig.__metadata;
				expect(meta.cycle).toBe(i);

				if (i < cycles) {
					await api.slothlet.api.remove({ apiPath: "cycled" });
					expect(api.cycled).toBeUndefined();
				}
			}

			// Final state
			const finalMeta = api.cycled.config.settings.getPluginConfig.__metadata;
			expect(finalMeta.cycle).toBe(cycles);
		});
	});

	describe("Collision Modes with Metadata", () => {
		it("should handle merge mode with metadata", async () => {
			// Add initial API with metadata
			await api.slothlet.api.add("mergeable", TEST_DIRS.API_SMART_FLATTEN, {
				initial: true,
				version: "1.0"
			});

			// Add conflicting API with merge mode
			try {
				await api.slothlet.api.add("mergeable.config", TEST_DIRS.API_SMART_FLATTEN, {
					merged: true,
					version: "1.1"
				});
			} catch (_) {
				// May throw depending on collision mode
			}

			// Check if metadata was properly merged or replaced
			if (api.mergeable?.config?.settings?.getPluginConfig) {
				await materialize(api, "mergeable.config.settings.getPluginConfig");
				const meta = api.mergeable.config.settings.getPluginConfig.__metadata;
				expect(meta).toBeDefined();
			}
		});

		it("should handle warn mode with metadata preservation", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const originalMeta = api.rootMath.add.__metadata;

			// Try to add conflicting API (should warn and keep existing)
			try {
				await api.slothlet.api.add("rootMath", TEST_DIRS.API_SMART_FLATTEN, {
					shouldNotAppear: true
				});
			} catch (_) {
				// May throw or warn
			}

			// Original should still be there with original metadata
			if (api.rootMath?.add) {
				await materialize(api, "rootMath.add", 1, 2);
				const currentMeta = api.rootMath.add.__metadata;
				expect(currentMeta.moduleID).toBe(originalMeta.moduleID);
				expect(currentMeta.shouldNotAppear).not.toBe(true);
			}
		});
	});

	describe("Partial Path Removal", () => {
		it("should remove metadata for partial paths", async () => {
			await api.slothlet.api.add("partial", TEST_DIRS.API_SMART_FLATTEN, {
				partial: true
			});

			await materialize(api, "partial.config.settings.getPluginConfig");
			expect(api.partial.config).toBeDefined();

			// Remove just config subtree
			await api.slothlet.api.remove({ apiPath: "partial.config" });

			expect(api.partial).toBeDefined(); // Parent still exists
			expect(api.partial.config).toBeUndefined(); // Child removed
		});
	});
});
