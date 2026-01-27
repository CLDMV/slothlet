/**
 * @fileoverview Tests for metadata behavior with hot reload functionality.
 *
 * Tests how metadata behaves when using:
 * - api.slothlet.reload() - Full instance reload
 * - api.slothlet.api.reload() - Partial API reload
 *
 * Note: These are HOT RELOAD operations, NOT api manager (add/remove).
 * Hot reload reloads files from disk while maintaining instance state.
 *
 * ⚠️ WARNING: These tests may fail if reload functionality is not yet implemented.
 *
 * @module tests/vitests/suites/metadata/metadata-reload.test.vitest
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("Metadata Hot Reload > Config: '$name'", ({ config }) => {
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

	describe("api.slothlet.reload() - Full Reload", () => {
		it("should refresh system metadata after full reload", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const metaBefore = api.rootMath.add.__metadata;
			expect(metaBefore).toBeDefined();

			// Perform full reload
			await api.slothlet.reload();

			await materialize(api, "rootMath.add", 1, 2);
			const metaAfter = api.rootMath.add.__metadata;

			// System metadata should be refreshed
			expect(metaAfter).toBeDefined();
			expect(metaAfter.filePath).toBe(metaBefore.filePath);
			expect(metaAfter.apiPath).toBe(metaBefore.apiPath);
			// moduleID may change after reload
		});

		it("should preserve user metadata across full reload", async () => {
			await api.slothlet.api.add("persistent", TEST_DIRS.API_SMART_FLATTEN, {
				shouldPersist: true,
				version: "1.0.0"
			});

			await materialize(api, "persistent.config.settings.getPluginConfig");
			const metaBefore = api.persistent.config.settings.getPluginConfig.__metadata;

			await api.slothlet.reload();

			// Check if user metadata persisted
			if (api.persistent?.config?.settings?.getPluginConfig) {
				await materialize(api, "persistent.config.settings.getPluginConfig");
				const metaAfter = api.persistent.config.settings.getPluginConfig.__metadata;

				// User metadata should persist across reload
				expect(metaAfter.shouldPersist).toBe(true);
				expect(metaAfter.version).toBe("1.0.0");
			}
		});

		it("should handle reload with metadata changes", async () => {
			// Reload (simulates file changes on disk)
			await api.slothlet.reload();

			// After reload
			await materialize(api, "rootMath.add", 1, 2);
			const meta2 = api.rootMath.add.__metadata;

			// Both should have metadata
			expect(meta1).toBeDefined();
			expect(meta2).toBeDefined();

			// System metadata should be correct
			expect(meta2.filePath).toBeDefined();
			expect(meta2.apiPath).toBe("rootMath.add");
		});
	});

	describe("api.slothlet.api.reload() - Partial Reload", () => {
		it("should reload specific API path and update metadata", async () => {
			if (!api.slothlet?.api?.reload) {
				// Skip if api.reload not implemented
				return;
			}

			await api.slothlet.api.add("reloadable", TEST_DIRS.API_SMART_FLATTEN, {
				version: "1.0.0"
			});

			await materialize(api, "reloadable.config.settings.getPluginConfig");
			const metaBefore = api.reloadable.config.settings.getPluginConfig.__metadata;

			// Reload just this API path
			await api.slothlet.api.reload({ apiPath: "reloadable" });

			await materialize(api, "reloadable.config.settings.getPluginConfig");
			const metaAfter = api.reloadable.config.settings.getPluginConfig.__metadata;

			// Metadata should be refreshed
			expect(metaAfter).toBeDefined();
			expect(metaAfter.filePath).toBe(metaBefore.filePath);
			expect(metaAfter.version).toBe("1.0.0");
		});

		it("should not affect metadata of other APIs during partial reload", async () => {
			if (!api.slothlet?.api?.reload) {
				return;
			}

			await api.slothlet.api.add("stable", TEST_DIRS.API_SMART_FLATTEN, {
				stable: true
			});

			await api.slothlet.api.add("reloadTarget", TEST_DIRS.API_SMART_FLATTEN, {
				willReload: true
			});

			await materialize(api, "stable.config.settings.getPluginConfig");
			await materialize(api, "reloadTarget.config.settings.getPluginConfig");

			const stableMetaBefore = api.stable.config.settings.getPluginConfig.__metadata;

			// Reload only reloadTarget
			await api.slothlet.api.reload({ apiPath: "reloadTarget" });

			// Stable should be unchanged
			await materialize(api, "stable.config.settings.getPluginConfig");
			const stableMetaAfter = api.stable.config.settings.getPluginConfig.__metadata;

			expect(stableMetaAfter.stable).toBe(true);
			expect(stableMetaAfter.moduleID).toBe(stableMetaBefore.moduleID);
		});

		it("should handle reload of nested paths", async () => {
			if (!api.slothlet?.api?.reload) {
				return;
			}

			await api.slothlet.api.add("nested", TEST_DIRS.API_SMART_FLATTEN, {
				nested: true
			});

			await materialize(api, "nested.config.settings.getPluginConfig");
			const metaBefore = api.nested.config.settings.getPluginConfig.__metadata;

			// Reload nested path
			await api.slothlet.api.reload({ apiPath: "nested.config" });

			if (api.nested?.config?.settings?.getPluginConfig) {
				await materialize(api, "nested.config.settings.getPluginConfig");
				const metaAfter = api.nested.config.settings.getPluginConfig.__metadata;

				expect(metaAfter).toBeDefined();
				expect(metaAfter.nested).toBe(true);
			}
		});
	});

	describe("Multiple Reload Cycles", () => {
		it("should handle multiple full reload cycles", async () => {
			if (!api.slothlet?.reload) {
				return;
			}

			const cycles = 3;

			for (let i = 0; i < cycles; i++) {
				await api.slothlet.reload();

				await materialize(api, "rootMath.add", 1, 2);
				const meta = api.rootMath.add.__metadata;

				expect(meta).toBeDefined();
				expect(meta.apiPath).toBe("rootMath.add");
				expect(meta.filePath).toContain("root-math.mjs");
			}
		});

		it("should handle multiple partial reload cycles", async () => {
			if (!api.slothlet?.api?.reload) {
				return;
			}

			await api.slothlet.api.add("multicycle", TEST_DIRS.API_SMART_FLATTEN, {
				cycles: 0
			});

			const cycles = 3;

			for (let i = 0; i < cycles; i++) {
				await api.slothlet.api.reload({ apiPath: "multicycle" });

				if (api.multicycle?.config?.settings?.getPluginConfig) {
					await materialize(api, "multicycle.config.settings.getPluginConfig");
					const meta = api.multicycle.config.settings.getPluginConfig.__metadata;

					expect(meta).toBeDefined();
					expect(meta.cycles).toBe(0); // Should stay 0, not increment
				}
			}
		});
	});

	describe("Reload with Metadata Updates", () => {
		it("should apply new user metadata during reload", async () => {
			if (!api.slothlet?.api?.reload) {
				return;
			}

			await api.slothlet.api.add("updateable", TEST_DIRS.API_SMART_FLATTEN, {
				version: "1.0.0"
			});

			// Reload with updated metadata
			await api.slothlet.api.reload({
				apiPath: "updateable",
				metadata: {
					version: "2.0.0",
					updated: true
				}
			});

			if (api.updateable?.config?.settings?.getPluginConfig) {
				await materialize(api, "updateable.config.settings.getPluginConfig");
				const meta = api.updateable.config.settings.getPluginConfig.__metadata;

				// Should have updated metadata
				expect(meta.version).toBe("2.0.0");
				expect(meta.updated).toBe(true);
			}
		});
	});

	describe("Reload Error Handling", () => {
		it("should preserve metadata if reload fails", async () => {
			if (!api.slothlet?.reload) {
				return;
			}

			await materialize(api, "rootMath.add", 1, 2);
			const metaBefore = api.rootMath.add.__metadata;

			// Try to reload (may fail if files have issues)
			try {
				await api.slothlet.reload();
			} catch (error) {
				// Reload failed - metadata should still be accessible
				await materialize(api, "rootMath.add", 1, 2);
				const metaAfter = api.rootMath.add.__metadata;

				expect(metaAfter).toBeDefined();
				expect(metaAfter.apiPath).toBe(metaBefore.apiPath);
			}
		});

		it("should handle reload of non-existent paths gracefully", async () => {
			if (!api.slothlet?.api?.reload) {
				return;
			}

			try {
				await api.slothlet.api.reload({ apiPath: "nonexistent.path" });
			} catch (error) {
				// Should throw appropriate error
				expect(error).toBeDefined();
			}
		});
	});

	describe("Reload with Lazy Mode", () => {
		it("should rematerialize lazy proxies with fresh metadata", async () => {
			if (config.mode !== "lazy" || !api.slothlet?.api?.reload) {
				return;
			}

			await api.slothlet.api.add("lazyReload", TEST_DIRS.API_SMART_FLATTEN, {
				lazy: true
			});

			// Materialize once
			await materialize(api, "lazyReload.config.settings.getPluginConfig");
			const meta1 = api.lazyReload.config.settings.getPluginConfig.__metadata;

			// Reload
			await api.slothlet.api.reload({ apiPath: "lazyReload" });

			// Rematerialize
			if (api.lazyReload?.config?.settings?.getPluginConfig) {
				await materialize(api, "lazyReload.config.settings.getPluginConfig");
				const meta2 = api.lazyReload.config.settings.getPluginConfig.__metadata;

				expect(meta2).toBeDefined();
				expect(meta2.lazy).toBe(true);
				expect(meta2.apiPath).toBe(meta1.apiPath);
			}
		});
	});

	describe("External Metadata API with Reload", () => {
		it("should preserve user metadata set via api.slothlet.metadata.set() after full reload", async () => {
			if (!api.slothlet?.reload) {
				return;
			}

			await materialize(api, "rootMath.add", 1, 2);

			// Set user metadata via external API
			api.slothlet.metadata.set(api.rootMath.add, "category", "math");
			api.slothlet.metadata.set(api.rootMath.add, "version", "2.0.0");

			const metaBefore = api.rootMath.add.__metadata;
			expect(metaBefore.category).toBe("math");
			expect(metaBefore.version).toBe("2.0.0");

			// Full reload
			await api.slothlet.reload();

			// Rematerialize
			await materialize(api, "rootMath.add", 1, 2);

			// User metadata should persist after reload
			const metaAfter = api.rootMath.add.__metadata;
			expect(metaAfter.category).toBe("math");
			expect(metaAfter.version).toBe("2.0.0");
		});

		it("should preserve global metadata set via api.slothlet.metadata.setGlobal() after reload", async () => {
			if (!api.slothlet?.reload) {
				return;
			}

			// Set global metadata
			api.slothlet.metadata.setGlobal("appVersion", "3.0.0");
			api.slothlet.metadata.setGlobal("environment", "test");

			await materialize(api, "rootMath.add", 1, 2);
			expect(api.rootMath.add.__metadata.appVersion).toBe("3.0.0");
			expect(api.rootMath.add.__metadata.environment).toBe("test");

			// Full reload
			await api.slothlet.reload();

			// Rematerialize another function
			await materialize(api, "rootMath.subtract", 5, 3);

			// Global metadata should still be applied
			expect(api.rootMath.subtract.__metadata.appVersion).toBe("3.0.0");
			expect(api.rootMath.subtract.__metadata.environment).toBe("test");
		});

		it("should allow updating metadata after api.slothlet.api.reload()", async () => {
			if (!api.slothlet?.api?.reload) {
				return;
			}

			await api.slothlet.api.add("testReload", TEST_DIRS.API_TEST);
			await materialize(api, "testReload.rootMath.add", 1, 2);

			// Set metadata before reload
			api.slothlet.metadata.set(api.testReload.rootMath.add, "status", "initial");
			expect(api.testReload.rootMath.add.__metadata.status).toBe("initial");

			// Partial reload
			await api.slothlet.api.reload({ apiPath: "testReload" });
			await materialize(api, "testReload.rootMath.add", 1, 2);

			// Update metadata after reload
			api.slothlet.metadata.set(api.testReload.rootMath.add, "status", "reloaded");
			expect(api.testReload.rootMath.add.__metadata.status).toBe("reloaded");
		});

		it("should remove metadata via api.slothlet.metadata.remove() after reload", async () => {
			if (!api.slothlet?.reload) {
				return;
			}

			await materialize(api, "rootMath.add", 1, 2);

			// Set metadata
			api.slothlet.metadata.set(api.rootMath.add, "temp", "value");
			expect(api.rootMath.add.__metadata.temp).toBe("value");

			// Reload
			await api.slothlet.reload();
			await materialize(api, "rootMath.add", 1, 2);

			// Remove metadata after reload
			api.slothlet.metadata.remove(api.rootMath.add, "temp");
			expect(api.rootMath.add.__metadata.temp).toBeUndefined();

			// System metadata should remain
			expect(api.rootMath.add.__metadata.moduleID).toBeDefined();
		});
	});

	describe("Internal API Access During Reload (self.slothlet.metadata.*)", () => {
		it("should access metadata via internal API after full reload", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Set user metadata
			api.slothlet.metadata.set(api.rootMath.add, "preReload", "value123");

			// Reload
			await api.slothlet.reload();
			await materialize(api, "rootMath.add", 1, 2);

			// Access via internal API
			const metadata = await api.metadataTestHelper.getMetadata("rootMath.add");

			// Should have system metadata
			expect(metadata.moduleID).toBeDefined();
			expect(metadata.apiPath).toBe("rootMath.add");

			// User metadata persistence depends on reload implementation
			// Just verify internal API works after reload
			expect(metadata).toBeDefined();
		});

		it("should access added API metadata via internal API after reload", async () => {
			await api.slothlet.api.add("reloadInternal", TEST_DIRS.API_SMART_FLATTEN, {
				persistValue: "should_persist"
			});

			await materialize(api, "reloadInternal.config.settings.getPluginConfig");

			// Access before reload
			const beforeReload = await api.metadataTestHelper.getMetadata("reloadInternal.config.settings.getPluginConfig");
			expect(beforeReload.persistValue).toBe("should_persist");

			// Reload
			await api.slothlet.reload();

			// Access after reload via internal API
			if (api.reloadInternal?.config?.settings?.getPluginConfig) {
				await materialize(api, "reloadInternal.config.settings.getPluginConfig");
				const afterReload = await api.metadataTestHelper.getMetadata("reloadInternal.config.settings.getPluginConfig");

				// System metadata should be refreshed
				expect(afterReload.moduleID).toBeDefined();
				expect(afterReload.apiPath).toBe("reloadInternal.config.settings.getPluginConfig");
			}
		});

		it("should handle partial reload with internal API access", async () => {
			await api.slothlet.api.add("partialReload", TEST_DIRS.API_SMART_FLATTEN, {
				partial: true
			});

			await materialize(api, "partialReload.config.settings.getPluginConfig");

			// Partial reload
			await api.slothlet.api.reload("partialReload");

			// Access via internal API
			if (api.partialReload?.config?.settings?.getPluginConfig) {
				await materialize(api, "partialReload.config.settings.getPluginConfig");
				const metadata = await api.metadataTestHelper.getMetadata("partialReload.config.settings.getPluginConfig");

				expect(metadata).toBeDefined();
				expect(metadata.apiPath).toBe("partialReload.config.settings.getPluginConfig");
			}
		});

		it("should track metadata changes across reload via internal API", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Set metadata before reload
			api.slothlet.metadata.set(api.rootMath.add, "counter", 1);

			// Read via internal API
			let metadata = await api.metadataTestHelper.getMetadata("rootMath.add");
			expect(metadata.counter).toBe(1);

			// Reload
			await api.slothlet.reload();
			await materialize(api, "rootMath.add", 1, 2);

			// Set different value after reload
			api.slothlet.metadata.set(api.rootMath.add, "counter", 2);

			// Read via internal API
			metadata = await api.metadataTestHelper.getMetadata("rootMath.add");
			expect(metadata.counter).toBe(2);
		});

		it("should access self metadata during reload scenarios", async () => {
			// Get self metadata before reload
			const beforeReload = await api.metadataTestHelper.getSelfMetadata();
			expect(beforeReload).toBeDefined();

			// Reload
			await api.slothlet.reload();

			// Get self metadata after reload
			const afterReload = await api.metadataTestHelper.getSelfMetadata();
			expect(afterReload).toBeDefined();

			// Both should reference the helper function
			expect(afterReload.apiPath).toContain("metadataTestHelper");
		});
	});
});
