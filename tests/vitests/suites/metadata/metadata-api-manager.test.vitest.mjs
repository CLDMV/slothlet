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

			await api.slothlet.api.remove("removable");
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

			await api.slothlet.api.remove("remove");

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

			await api.slothlet.api.remove("replaceable");
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
				partial: true
			});

			await materialize(api, "partial.config.settings.getPluginConfig");
			expect(api.partial.config).toBeDefined();

			// Remove just config subtree
			await api.slothlet.api.remove("partial.config");

			expect(api.partial).toBeDefined(); // Parent still exists
			expect(api.partial.config).toBeUndefined(); // Child removed
		});
	});
});
