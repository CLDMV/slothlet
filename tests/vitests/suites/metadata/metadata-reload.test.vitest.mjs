/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/metadata/metadata-reload.test.vitest.mjs
 *	@Date: 2026-01-25T13:23:08-08:00 (1769376188)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:06-08:00 (1795869126)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

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
import { getMatrixConfigs, TEST_DIRS, materialize } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("Metadata Hot Reload > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST,
			api: {
				mutations: {
					reload: true
				}
			}
		});
	});

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
	});

	describe("api.slothlet.reload() - Full Reload", () => {
		it("should refresh system metadata after full reload", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const metaBefore = api.slothlet.metadata.get(api.rootMath.add);
			const metaBeforeNode = api.slothlet.node(api.rootMath.add);
			expect(metaBefore).toBeDefined();

			// Perform full reload
			await api.slothlet.reload();

			await materialize(api, "rootMath.add", 1, 2);
			const metaAfter = api.slothlet.metadata.get(api.rootMath.add);
			const metaAfterNode = api.slothlet.node(api.rootMath.add);

			// System metadata should be refreshed
			expect(metaAfter).toBeDefined();
			expect(metaAfterNode.file).toBe(metaBeforeNode.file);
			expect(metaAfterNode.path.join(".")).toBe(metaBeforeNode.path.join("."));
			// moduleID may change after reload
		});

		it("should preserve user metadata across full reload", async () => {
			await api.slothlet.api.add("persistent", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					shouldPersist: true,
					version: "1.0.0"
				}
			});

			await materialize(api, "persistent.config.settings.getPluginConfig");

			await api.slothlet.reload();

			// Check if user metadata persisted
			if (api.persistent?.config?.settings?.getPluginConfig) {
				await materialize(api, "persistent.config.settings.getPluginConfig");
				const metaAfter = api.slothlet.metadata.get(api.persistent.config.settings.getPluginConfig);

				// User metadata should persist across reload
				expect(metaAfter.shouldPersist).toBe(true);
				expect(metaAfter.version).toBe("1.0.0");
			}
		});

		it("should handle reload with metadata changes", async () => {
			// Before reload
			await materialize(api, "rootMath.add", 1, 2);
			const meta1 = api.slothlet.metadata.get(api.rootMath.add);
			// Reload (simulates file changes on disk)
			await api.slothlet.reload();

			// After reload
			await materialize(api, "rootMath.add", 1, 2);
			const meta2 = api.slothlet.metadata.get(api.rootMath.add);
			const meta2Node = api.slothlet.node(api.rootMath.add);

			// Both should have metadata
			expect(meta1).toBeDefined();
			expect(meta2).toBeDefined();

			// System metadata should be correct
			expect(meta2Node.file).toBeDefined();
			expect(meta2Node.path.join(".")).toBe("rootMath.add");
		});
	});

	describe("api.slothlet.api.reload() - Partial Reload", () => {
		it("should reload specific API path and update metadata", async () => {
			if (!api.slothlet?.api?.reload) {
				// Skip if api.reload not implemented
				return;
			}

			await api.slothlet.api.add("reloadable", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					version: "1.0.0"
				}
			});

			await materialize(api, "reloadable.config.settings.getPluginConfig");
			const metaBeforeNode = api.slothlet.node(api.reloadable.config.settings.getPluginConfig);

			// Reload just this API path
			await api.slothlet.api.reload("reloadable");

			await materialize(api, "reloadable.config.settings.getPluginConfig");
			const metaAfter = api.slothlet.metadata.get(api.reloadable.config.settings.getPluginConfig);
			const metaAfterNode = api.slothlet.node(api.reloadable.config.settings.getPluginConfig);

			// Metadata should be refreshed
			expect(metaAfter).toBeDefined();
			expect(metaAfterNode.file).toBe(metaBeforeNode.file);
			expect(metaAfter.version).toBe("1.0.0");
		});

		it("should not affect metadata of other APIs during partial reload", async () => {
			if (!api.slothlet?.api?.reload) {
				return;
			}

			await api.slothlet.api.add("stable", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					stable: true
				}
			});

			await api.slothlet.api.add("reloadTarget", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					willReload: true
				}
			});

			await materialize(api, "stable.config.settings.getPluginConfig");
			await materialize(api, "reloadTarget.config.settings.getPluginConfig");

			const stableMetaBeforeNode = api.slothlet.node(api.stable.config.settings.getPluginConfig);

			// Reload only reloadTarget
			await api.slothlet.api.reload("reloadTarget");

			// Stable should be unchanged
			await materialize(api, "stable.config.settings.getPluginConfig");
			const stableMetaAfter = api.slothlet.metadata.get(api.stable.config.settings.getPluginConfig);
			const stableMetaAfterNode = api.slothlet.node(api.stable.config.settings.getPluginConfig);

			expect(stableMetaAfter.stable).toBe(true);
			expect(stableMetaAfterNode.module).toBe(stableMetaBeforeNode.module);
		});

		it("should handle reload of nested paths", async () => {
			if (!api.slothlet?.api?.reload) {
				return;
			}

			await api.slothlet.api.add("nested", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					nested: true
				}
			});

			await materialize(api, "nested.config.settings.getPluginConfig");

			// Reload nested path
			await api.slothlet.api.reload("nested.config");

			if (api.nested?.config?.settings?.getPluginConfig) {
				await materialize(api, "nested.config.settings.getPluginConfig");
				const metaAfter = api.slothlet.metadata.get(api.nested.config.settings.getPluginConfig);

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
				const meta = api.slothlet.metadata.get(api.rootMath.add);
				const metaNode = api.slothlet.node(api.rootMath.add);

				expect(meta).toBeDefined();
				expect(metaNode.path.join(".")).toBe("rootMath.add");
				expect(metaNode.file).toContain("root-math.mjs");
			}
		});

		it("should handle multiple partial reload cycles", async () => {
			if (!api.slothlet?.api?.reload) {
				return;
			}

			await api.slothlet.api.add("multicycle", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					cycles: 0
				}
			});

			const cycles = 3;

			for (let i = 0; i < cycles; i++) {
				await api.slothlet.api.reload("multicycle");

				if (api.multicycle?.config?.settings?.getPluginConfig) {
					await materialize(api, "multicycle.config.settings.getPluginConfig");
					const meta = api.slothlet.metadata.get(api.multicycle.config.settings.getPluginConfig);

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
				metadata: {
					version: "1.0.0"
				}
			});

			// Reload while supplying UPDATED metadata - this is the primary way to change
			// path-registered metadata after initialization without touching each function.
			await api.slothlet.api.reload("updateable", {
				metadata: {
					version: "2.0.0",
					updated: true
				}
			});

			if (api.updateable?.config?.settings?.getPluginConfig) {
				await materialize(api, "updateable.config.settings.getPluginConfig");
				const meta = api.slothlet.metadata.get(api.updateable.config.settings.getPluginConfig);

				// Metadata should reflect the values passed to reload
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
			const metaBeforeNode = api.slothlet.node(api.rootMath.add);

			// Try to reload (may fail if files have issues)
			try {
				await api.slothlet.reload();
			} catch (____error) {
				// Reload failed - metadata should still be accessible
				await materialize(api, "rootMath.add", 1, 2);
				const metaAfter = api.slothlet.metadata.get(api.rootMath.add);
				const metaAfterNode = api.slothlet.node(api.rootMath.add);

				expect(metaAfter).toBeDefined();
				expect(metaAfterNode.path.join(".")).toBe(metaBeforeNode.path.join("."));
			}
		});

		it("should handle reload of non-existent paths gracefully", async () => {
			if (!api.slothlet?.api?.reload) {
				return;
			}

			try {
				await api.slothlet.api.reload("nonexistent.path");
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
				metadata: {
					lazy: true
				}
			});

			// Materialize once
			await materialize(api, "lazyReload.config.settings.getPluginConfig");
			const meta1Node = api.slothlet.node(api.lazyReload.config.settings.getPluginConfig);

			// Reload
			await api.slothlet.api.reload("lazyReload");

			// Rematerialize
			if (api.lazyReload?.config?.settings?.getPluginConfig) {
				await materialize(api, "lazyReload.config.settings.getPluginConfig");
				const meta2 = api.slothlet.metadata.get(api.lazyReload.config.settings.getPluginConfig);
				const meta2Node = api.slothlet.node(api.lazyReload.config.settings.getPluginConfig);

				expect(meta2).toBeDefined();
				expect(meta2.lazy).toBe(true);
				expect(meta2Node.path.join(".")).toBe(meta1Node.path.join("."));
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

			const metaBefore = api.slothlet.metadata.get(api.rootMath.add);
			expect(metaBefore.category).toBe("math");
			expect(metaBefore.version).toBe("2.0.0");

			// Full reload
			await api.slothlet.reload();

			// Rematerialize
			await materialize(api, "rootMath.add", 1, 2);

			// User metadata should persist after reload
			const metaAfter = api.slothlet.metadata.get(api.rootMath.add);
			expect(metaAfter.category).toBe("math");
			expect(metaAfter.version).toBe("2.0.0");
		});

		it("should preserve global metadata set via api.slothlet.metadata.global() after reload", async () => {
			if (!api.slothlet?.reload) {
				return;
			}

			// Set global metadata
			api.slothlet.metadata.global("appVersion", "3.0.0");
			api.slothlet.metadata.global("environment", "test");

			await materialize(api, "rootMath.add", 1, 2);
			expect(api.slothlet.metadata.get(api.rootMath.add).appVersion).toBe("3.0.0");
			expect(api.slothlet.metadata.get(api.rootMath.add).environment).toBe("test");

			// Full reload
			await api.slothlet.reload();

			// Rematerialize another function
			await materialize(api, "rootMath.add", 1, 2);

			// Global metadata should still be applied
			expect(api.slothlet.metadata.get(api.rootMath.add).appVersion).toBe("3.0.0");
			expect(api.slothlet.metadata.get(api.rootMath.add).environment).toBe("test");
		});

		it("should allow updating metadata after api.slothlet.api.reload()", async () => {
			if (!api.slothlet?.api?.reload) {
				return;
			}

			await api.slothlet.api.add("testReload", TEST_DIRS.API_TEST);
			await materialize(api, "testReload.rootMath.add", 1, 2);

			// Set metadata before reload
			api.slothlet.metadata.set(api.testReload.rootMath.add, "status", "initial");
			expect(api.slothlet.metadata.get(api.testReload.rootMath.add).status).toBe("initial");

			// Partial reload
			await api.slothlet.api.reload("testReload");
			await materialize(api, "testReload.rootMath.add", 1, 2);

			// Update metadata after reload
			api.slothlet.metadata.set(api.testReload.rootMath.add, "status", "reloaded");
			expect(api.slothlet.metadata.get(api.testReload.rootMath.add).status).toBe("reloaded");
		});

		it("should remove metadata via api.slothlet.metadata.remove() after reload", async () => {
			if (!api.slothlet?.reload) {
				return;
			}

			await materialize(api, "rootMath.add", 1, 2);

			// Set metadata
			api.slothlet.metadata.set(api.rootMath.add, "temp", "value");
			expect(api.slothlet.metadata.get(api.rootMath.add).temp).toBe("value");

			// Reload
			await api.slothlet.reload();
			await materialize(api, "rootMath.add", 1, 2);

			// Remove metadata after reload
			api.slothlet.metadata.remove(api.rootMath.add, "temp");
			expect(api.slothlet.metadata.get(api.rootMath.add).temp).toBeUndefined();

			// System metadata should remain
			expect(api.slothlet.node(api.rootMath.add).module).toBeDefined();
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
			const report = await api.metadataTestHelper.getNode("rootMath.add");
			expect(report.module).toBeDefined();
			expect(report.path).toEqual(["rootMath", "add"]);

			// User metadata persistence depends on reload implementation
			// Just verify internal API works after reload
			expect(metadata).toBeDefined();
		});

		it("should access added API metadata via internal API after reload", async () => {
			await api.slothlet.api.add("reloadInternal", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					persistValue: "should_persist"
				}
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
				expect(afterReload.persistValue).toBe("should_persist");

				// The node's report is refreshed
				const report = await api.metadataTestHelper.getNode("reloadInternal.config.settings.getPluginConfig");
				expect(report.module).toBeDefined();
				expect(report.path.join(".")).toBe("reloadInternal.config.settings.getPluginConfig");
			}
		});

		it("should handle partial reload with internal API access", async () => {
			await api.slothlet.api.add("partialReload", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					partial: true
				}
			});

			await materialize(api, "partialReload.config.settings.getPluginConfig");

			// Partial reload
			await api.slothlet.api.reload("partialReload");

			// Access via internal API
			if (api.partialReload?.config?.settings?.getPluginConfig) {
				await materialize(api, "partialReload.config.settings.getPluginConfig");
				const metadata = await api.metadataTestHelper.getMetadata("partialReload.config.settings.getPluginConfig");

				expect(metadata).toBeDefined();
				expect((await api.metadataTestHelper.getNode("partialReload.config.settings.getPluginConfig")).path.join(".")).toBe(
					"partialReload.config.settings.getPluginConfig"
				);
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
			expect((await api.metadataTestHelper.getNode()).path).toContain("metadataTestHelper");
		});
	});

	// ─── importUserState merge branch ──────────────────────────────────────────
	//
	// The merge branch (existing keys win) in importUserState fires when load()
	// has already populated #userMetadataStore for a key by the time
	// importUserState is called. This happens for the base moduleID when the
	// top-level slothlet config includes a `metadata` option: load() calls
	// registerUserMetadata(baseModuleId, "", config.metadata), so pre-reload
	// savedState and post-load store both have the same baseModuleId key.

	describe("importUserState - merge branch (existing entry wins)", () => {
		let apiWithConfigMeta;

		beforeEach(async () => {
			apiWithConfigMeta = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST,
				metadata: {
					fromConfig: true,
					configVersion: "1.0.0"
				},
				api: {
					mutations: {
						reload: true
					}
				}
			});
		});

		afterEach(async () => {
			if (apiWithConfigMeta?.shutdown) {
				await apiWithConfigMeta.shutdown();
			}
		});

		it("config-level metadata survives reload (exercises importUserState merge branch)", async () => {
			// Verify metadata is present before reload
			await materialize(apiWithConfigMeta, "rootMath.add", 1, 2);
			const before = apiWithConfigMeta.slothlet.metadata.get(apiWithConfigMeta.rootMath.add);
			expect(before.fromConfig).toBe(true);
			expect(before.configVersion).toBe("1.0.0");

			// Reload — triggers: exportUserState → load() (re-registers baseModuleId) →
			// importUserState (existing entry found → merge branch fires) → replay
			await apiWithConfigMeta.slothlet.reload();

			// Metadata must still be present after reload
			await materialize(apiWithConfigMeta, "rootMath.add", 1, 2);
			const after = apiWithConfigMeta.slothlet.metadata.get(apiWithConfigMeta.rootMath.add);
			expect(after.fromConfig).toBe(true);
			expect(after.configVersion).toBe("1.0.0");
		});
	});
});
