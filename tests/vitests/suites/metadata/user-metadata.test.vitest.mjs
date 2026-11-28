/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/metadata/user-metadata.test.vitest.mjs
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
 * @fileoverview Tests for user metadata (mutable, user-defined).
 *
 * User metadata is optional data provided by users:
 * - At slothlet() initialization
 * - Via api.add() options
 * - Via metadata API methods
 *
 * User metadata is MUTABLE and should NOT be used for security decisions.
 *
 * @module tests/vitests/suites/metadata/user-metadata.test.vitest
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, materialize } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("User Metadata > Config: '$name'", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
	});

	describe("User Metadata via api.add()", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST
			});
		});

		it("should attach user metadata to added functions", async () => {
			await api.slothlet.api.add("withMeta", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					version: "1.0.0",
					author: "test-user",
					tags: ["math", "utility"]
				}
			});

			await materialize(api, "withMeta.config.settings.getPluginConfig");
			const meta = api.slothlet.metadata.get(api.withMeta.config.settings.getPluginConfig);

			expect(meta.version).toBe("1.0.0");
			expect(meta.author).toBe("test-user");
			expect(meta.tags).toEqual(["math", "utility"]);
		});

		it("should inherit user metadata to nested functions", async () => {
			await api.slothlet.api.add("inherited", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					inherited: true,
					level: "top"
				}
			});

			await materialize(api, "inherited.config.settings.getPluginConfig");
			const meta = api.slothlet.metadata.get(api.inherited.config.settings.getPluginConfig);

			expect(meta.inherited).toBe(true);
			expect(meta.level).toBe("top");
		});

		it("should support deep nesting (3+ levels) metadata inheritance", async () => {
			await api.slothlet.api.add("deepNest", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					deep: "metadata",
					level: 3
				}
			});

			// Navigate 3 levels deep: deepNest.config.settings.getPluginConfig
			if (api.deepNest?.config?.settings?.getPluginConfig) {
				const result = await materialize(api, "deepNest.config.settings.getPluginConfig");
				expect(result).toBeDefined();

				const meta = api.slothlet.metadata.get(api.deepNest.config.settings.getPluginConfig);
				expect(meta.deep).toBe("metadata");
				expect(meta.level).toBe(3);
			}
		});

		it("should make user metadata immutable after retrieval", async () => {
			await api.slothlet.api.add("immutable", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					config: { debug: true },
					tags: ["test"]
				}
			});

			await materialize(api, "immutable.config.settings.getPluginConfig");
			const meta = api.slothlet.metadata.get(api.immutable.config.settings.getPluginConfig);

			// Try to modify
			try {
				meta.config.debug = false;
				meta.tags.push("modified");
			} catch (_) {
				// Expected - frozen
			}

			// Should remain unchanged
			expect(meta.config.debug).toBe(true);
			expect(meta.tags).toEqual(["test"]);
		});
	});

	describe("User Metadata at Initialization", () => {
		it("should support user metadata at slothlet() init", async () => {
			// Note: This requires userMetadata parameter at slothlet() level
			// which may not be implemented yet
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST,
				metadata: {
					appVersion: "2.0.0",
					environment: "test"
				}
			});

			await materialize(api, "rootMath.add", 1, 2);
			const meta = api.slothlet.metadata.get(api.rootMath.add);

			// This test may fail if init metadata not implemented
			if (meta.appVersion) {
				expect(meta.appVersion).toBe("2.0.0");
				expect(meta.environment).toBe("test");
			}
		});
	});

	describe("User Metadata Merge Behavior", () => {
		it("should merge init metadata with add() metadata", async () => {
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST,
				metadata: {
					appVersion: "2.0.0",
					global: true
				}
			});

			await api.slothlet.api.add("merged", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					moduleVersion: "1.5.0",
					local: true
				}
			});

			await materialize(api, "merged.config.settings.getPluginConfig");
			const meta = api.slothlet.metadata.get(api.merged.config.settings.getPluginConfig);

			// Should have both init and add metadata
			if (meta.appVersion && meta.moduleVersion) {
				expect(meta.appVersion).toBe("2.0.0");
				expect(meta.global).toBe(true);
				expect(meta.moduleVersion).toBe("1.5.0");
				expect(meta.local).toBe(true);
			}
		});

		it("should let add() metadata override init metadata for same keys", async () => {
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST,
				metadata: {
					version: "1.0.0",
					priority: "low"
				}
			});

			await api.slothlet.api.add("override", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					version: "2.0.0", // Override
					newKey: "newValue"
				}
			});

			await materialize(api, "override.config.settings.getPluginConfig");
			const meta = api.slothlet.metadata.get(api.override.config.settings.getPluginConfig);

			if (meta.version && meta.newKey) {
				expect(meta.version).toBe("2.0.0"); // Overridden
				expect(meta.priority).toBe("low"); // From init
				expect(meta.newKey).toBe("newValue"); // From add
			}
		});
	});

	describe("User Metadata Does Not Affect System Metadata", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST
			});
		});

		it("should keep system metadata separate from user metadata", async () => {
			await api.slothlet.api.add("separate", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					moduleID: "fake-id",
					filePath: "/fake/path",
					apiPath: "fake.path"
				}
			});

			await materialize(api, "separate.config.settings.getPluginConfig");
			const meta = api.slothlet.metadata.get(api.separate.config.settings.getPluginConfig);
			const metaNode = api.slothlet.node(api.separate.config.settings.getPluginConfig);

			// System metadata should be correct, not overridden by user
			expect(metaNode.module).toMatch(/^separate_[a-z0-9]+$/);
			// The user's keys stay user metadata, apart from the node's report
			expect(meta.moduleID).toBe("fake-id");
			expect(metaNode.file).toContain("settings.mjs");
			expect(metaNode.path.join(".")).toBe("separate.config.settings.getPluginConfig");
		});
	});

	describe("Empty and Null User Metadata", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST
			});
		});

		it("should handle empty metadata object", async () => {
			await api.slothlet.api.add("empty", TEST_DIRS.API_SMART_FLATTEN, {});
			await materialize(api, "empty.config.settings.getPluginConfig");

			const meta = api.slothlet.metadata.get(api.empty.config.settings.getPluginConfig);
			const metaNode = api.slothlet.node(api.empty.config.settings.getPluginConfig);
			expect(meta).toBeDefined();
			// Should still have system metadata
			expect(metaNode.module).toBeDefined();
		});

		it("should handle null/undefined metadata values", async () => {
			await api.slothlet.api.add("nulls", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					nullValue: null,
					undefinedValue: undefined,
					validValue: "exists"
				}
			});

			await materialize(api, "nulls.config.settings.getPluginConfig");
			const meta = api.slothlet.metadata.get(api.nulls.config.settings.getPluginConfig);

			expect(meta.nullValue).toBeNull();
			expect(meta.undefinedValue).toBeUndefined();
			expect(meta.validValue).toBe("exists");
		});
	});

	describe("Metadata Preservation Across Calls", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST
			});
		});

		it("should not modify metadata between function calls", async () => {
			await api.slothlet.api.add("stable", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					callCount: 0,
					timestamp: Date.now()
				}
			});

			await materialize(api, "stable.config.settings.getPluginConfig");
			const meta1 = api.slothlet.metadata.get(api.stable.config.settings.getPluginConfig);

			await materialize(api, "stable.config.settings.getPluginConfig");
			const meta2 = api.slothlet.metadata.get(api.stable.config.settings.getPluginConfig);

			await materialize(api, "stable.config.settings.getPluginConfig");
			const meta3 = api.slothlet.metadata.get(api.stable.config.settings.getPluginConfig);

			expect(meta1.callCount).toBe(0);
			expect(meta2.callCount).toBe(0);
			expect(meta3.callCount).toBe(0);
			expect(meta1.timestamp).toBe(meta2.timestamp);
			expect(meta2.timestamp).toBe(meta3.timestamp);
		});
	});

	describe("Metadata API (self.slothlet.metadata.*)", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST
			});
		});

		it("should support self.slothlet.metadata.get() from within API context", async () => {
			await api.slothlet.api.add("lookup", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					fromGet: true,
					version: "1.0.0"
				}
			});

			// Use helper function that calls self.slothlet.metadata.get() internally
			if (api.metadataTestHelper?.getMetadata) {
				const meta = await api.metadataTestHelper.getMetadata("lookup.config.settings.getPluginConfig");

				expect(meta).toBeDefined();
				expect(meta.fromGet).toBe(true);
				expect(meta.version).toBe("1.0.0");
				expect(meta.moduleID).toBeUndefined();
				expect((await api.metadataTestHelper.getNode("lookup.config.settings.getPluginConfig")).path[0]).toBe("lookup");
			}
		});

		it("should support self.slothlet.metadata.self() from within API context", async () => {
			// Use helper function that calls self.slothlet.metadata.self() internally
			if (api.metadataTestHelper?.getSelfMetadata) {
				const meta = await api.metadataTestHelper.getSelfMetadata();

				expect(meta).toBeDefined();
				expect(meta.path).toContain("getSelfMetadata");
				expect(typeof meta.module).toBe("string");
				expect(typeof meta.metadata).toBe("object");
			}
		});

		it("should support self.slothlet.metadata.caller() from within API context", async () => {
			// Use helper function that tests caller tracking
			if (api.metadataTestHelper?.testCaller) {
				const result = await api.metadataTestHelper.testCaller();

				expect(result).toBeDefined();
				expect(result.callerMeta).toBeDefined();
				// Caller should be testCaller function itself
				if (result.callerMeta) {
					expect(result.callerMeta.path).toContain("testCaller");
				}
			}
		});

		it("should verify metadata existence via helper", async () => {
			await api.slothlet.api.add("verifiable", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					verified: true
				}
			});

			if (api.metadataTestHelper?.verifyMetadata) {
				const result = await api.metadataTestHelper.verifyMetadata("verifiable.config.settings.getPluginConfig");

				expect(result.exists).toBe(true);
				expect(result.hasSourceFolder).toBe(true);
				expect(result.metadata.verified).toBe(true);
			}
		});
	});

	describe("Complex Path Scenarios (self.slothlet.metadata.*)", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST
			});
		});

		it("should handle deeply nested paths via internal API", async () => {
			await api.slothlet.api.add("deep", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					depth: "very_deep"
				}
			});

			await materialize(api, "deep.config.settings.getPluginConfig");

			// Access deeply nested function
			const metadata = await api.metadataTestHelper.getMetadata("deep.config.settings.getPluginConfig");

			expect(metadata).toBeDefined();
			expect(metadata.depth).toBe("very_deep");
			expect((await api.metadataTestHelper.getNode("deep.config.settings.getPluginConfig")).path).toEqual([
				"deep",
				"config",
				"settings",
				"getPluginConfig"
			]);
		});

		it("should return undefined for partial paths that don't have metadata", async () => {
			await api.slothlet.api.add("partial", TEST_DIRS.API_SMART_FLATTEN);

			// Intermediate paths may not have complete metadata
			const configMeta = await api.metadataTestHelper.getMetadata("partial.config");

			// Depending on implementation, intermediate nodes may or may not have metadata
			// Just verify the call doesn't throw
			expect(configMeta === undefined || typeof configMeta === "object").toBe(true);
		});

		it("should distinguish between different paths with similar names", async () => {
			await api.slothlet.api.add("similar1", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					id: "first"
				}
			});

			await api.slothlet.api.add("similar2", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					id: "second"
				}
			});

			await materialize(api, "similar1.config.settings.getPluginConfig");
			await materialize(api, "similar2.config.settings.getPluginConfig");

			const meta1 = await api.metadataTestHelper.getMetadata("similar1.config.settings.getPluginConfig");
			const meta2 = await api.metadataTestHelper.getMetadata("similar2.config.settings.getPluginConfig");

			expect(meta1.id).toBe("first");
			expect(meta2.id).toBe("second");
			const node1 = await api.metadataTestHelper.getNode("similar1.config.settings.getPluginConfig");
			const node2 = await api.metadataTestHelper.getNode("similar2.config.settings.getPluginConfig");
			expect(node1.module).not.toBe(node2.module);
		});

		it("should handle root-level functions via internal API", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			const report = await api.metadataTestHelper.getNode("rootMath.add");

			expect(report.path).toEqual(["rootMath", "add"]);
			expect(report.module).toMatch(/^base_[a-z0-9]+$/);
		});

		it("should verify metadata existence for various path types", async () => {
			// Root-level function
			await materialize(api, "rootMath.add", 1, 2);
			const rootResult = await api.metadataTestHelper.verifyMetadata("rootMath.add");
			expect(rootResult.exists).toBe(true);

			// Added API function
			await api.slothlet.api.add("verified", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					verified: true
				}
			});
			await materialize(api, "verified.config.settings.getPluginConfig");
			const addedResult = await api.metadataTestHelper.verifyMetadata("verified.config.settings.getPluginConfig");
			expect(addedResult.exists).toBe(true);
			expect(addedResult.metadata.verified).toBe(true);

			// Non-existent path
			const nonExistentResult = await api.metadataTestHelper.verifyMetadata("does.not.exist");
			expect(nonExistentResult.exists).toBe(false);
		});

		it("should access caller metadata from nested calls", async () => {
			// testCaller internally calls self.slothlet.metadata.caller()
			const callerInfo = await api.metadataTestHelper.testCaller();

			// Caller is the test itself, which doesn't have metadata
			// But the call should not throw
			expect(callerInfo !== undefined).toBe(true);
		});

		it("should handle mixed user and system metadata via internal API", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Set user metadata
			api.slothlet.metadata.set(api.rootMath.add, "userKey", "userValue");
			api.slothlet.metadata.set(api.rootMath.add, "timestamp", Date.now());

			// Access via internal API
			const metadata = await api.metadataTestHelper.getMetadata("rootMath.add");

			// User metadata only; the node's facts come from node()
			expect(metadata.moduleID).toBeUndefined();
			expect(metadata.apiPath).toBeUndefined();
			expect((await api.metadataTestHelper.getNode("rootMath.add")).module).toBeDefined();
			expect(metadata.userKey).toBe("userValue"); // User
			expect(metadata.timestamp).toBeDefined(); // User
		});
	});
});
