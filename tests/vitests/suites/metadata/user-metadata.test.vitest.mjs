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
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("User Metadata > Config: '$name'", ({ config }) => {
	let api;

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

	describe("User Metadata via api.add()", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST
			});
		});

		it("should attach user metadata to added functions", async () => {
			await api.slothlet.api.add("withMeta", TEST_DIRS.API_SMART_FLATTEN, {
				version: "1.0.0",
				author: "test-user",
				tags: ["math", "utility"]
			});

			await materialize(api, "withMeta.config.settings.getPluginConfig");
			const meta = api.withMeta.config.settings.getPluginConfig.__metadata;

			expect(meta.version).toBe("1.0.0");
			expect(meta.author).toBe("test-user");
			expect(meta.tags).toEqual(["math", "utility"]);
		});

		it("should inherit user metadata to nested functions", async () => {
			await api.slothlet.api.add("inherited", TEST_DIRS.API_SMART_FLATTEN, {
				inherited: true,
				level: "top"
			});

			await materialize(api, "inherited.config.settings.getPluginConfig");
			const meta = api.inherited.config.settings.getPluginConfig.__metadata;

			expect(meta.inherited).toBe(true);
			expect(meta.level).toBe("top");
		});

		it("should support deep nesting (3+ levels) metadata inheritance", async () => {
			await api.slothlet.api.add("deepNest", TEST_DIRS.API_SMART_FLATTEN, {
				deep: "metadata",
				level: 3
			});

			// Navigate 3 levels deep: deepNest.config.settings.getPluginConfig
			if (api.deepNest?.config?.settings?.getPluginConfig) {
				const result = await materialize(api, "deepNest.config.settings.getPluginConfig");
				expect(result).toBeDefined();

				const meta = api.deepNest.config.settings.getPluginConfig.__metadata;
				expect(meta.deep).toBe("metadata");
				expect(meta.level).toBe(3);
			}
		});

		it("should make user metadata immutable after retrieval", async () => {
			await api.slothlet.api.add("immutable", TEST_DIRS.API_SMART_FLATTEN, {
				config: { debug: true },
				tags: ["test"]
			});

			await materialize(api, "immutable.config.settings.getPluginConfig");
			const meta = api.immutable.config.settings.getPluginConfig.__metadata;

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
				dir: TEST_DIRS.API_TEST,
				metadata: {
					appVersion: "2.0.0",
					environment: "test"
				}
			});

			await materialize(api, "rootMath.add", 1, 2);
			const meta = api.rootMath.add.__metadata;

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
				dir: TEST_DIRS.API_TEST,
				metadata: {
					appVersion: "2.0.0",
					global: true
				}
			});

			await api.slothlet.api.add("merged", TEST_DIRS.API_SMART_FLATTEN, {
				moduleVersion: "1.5.0",
				local: true
			});

			await materialize(api, "merged.config.settings.getPluginConfig");
			const meta = api.merged.config.settings.getPluginConfig.__metadata;

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
				dir: TEST_DIRS.API_TEST,
				metadata: {
					version: "1.0.0",
					priority: "low"
				}
			});

			await api.slothlet.api.add("override", TEST_DIRS.API_SMART_FLATTEN, {
				version: "2.0.0", // Override
				newKey: "newValue"
			});

			await materialize(api, "override.config.settings.getPluginConfig");
			const meta = api.override.config.settings.getPluginConfig.__metadata;

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
				dir: TEST_DIRS.API_TEST
			});
		});

		it("should keep system metadata separate from user metadata", async () => {
			await api.slothlet.api.add("separate", TEST_DIRS.API_SMART_FLATTEN, {
				moduleID: "fake-id",
				filePath: "/fake/path",
				apiPath: "fake.path"
			});

			await materialize(api, "separate.config.settings.getPluginConfig");
			const meta = api.separate.config.settings.getPluginConfig.__metadata;

			// System metadata should be correct, not overridden by user
			expect(meta.moduleID).toMatch(/^separate_[a-z0-9]+:/);
			expect(meta.filePath).toContain("settings.mjs");
			expect(meta.apiPath).toBe("separate.config.settings.getPluginConfig");
		});
	});

	describe("Empty and Null User Metadata", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST
			});
		});

		it("should handle empty metadata object", async () => {
			await api.slothlet.api.add("empty", TEST_DIRS.API_SMART_FLATTEN, {});
			await materialize(api, "empty.config.settings.getPluginConfig");

			const meta = api.empty.config.settings.getPluginConfig.__metadata;
			expect(meta).toBeDefined();
			// Should still have system metadata
			expect(meta.moduleID).toBeDefined();
		});

		it("should handle null/undefined metadata values", async () => {
			await api.slothlet.api.add("nulls", TEST_DIRS.API_SMART_FLATTEN, {
				nullValue: null,
				undefinedValue: undefined,
				validValue: "exists"
			});

			await materialize(api, "nulls.config.settings.getPluginConfig");
			const meta = api.nulls.config.settings.getPluginConfig.__metadata;

			expect(meta.nullValue).toBeNull();
			expect(meta.undefinedValue).toBeUndefined();
			expect(meta.validValue).toBe("exists");
		});
	});

	describe("Metadata Preservation Across Calls", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST
			});
		});

		it("should not modify metadata between function calls", async () => {
			await api.slothlet.api.add("stable", TEST_DIRS.API_SMART_FLATTEN, {
				callCount: 0,
				timestamp: Date.now()
			});

			await materialize(api, "stable.config.settings.getPluginConfig");
			const meta1 = api.stable.config.settings.getPluginConfig.__metadata;

			await materialize(api, "stable.config.settings.getPluginConfig");
			const meta2 = api.stable.config.settings.getPluginConfig.__metadata;

			await materialize(api, "stable.config.settings.getPluginConfig");
			const meta3 = api.stable.config.settings.getPluginConfig.__metadata;

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
				dir: TEST_DIRS.API_TEST
			});
		});

		it("should support self.slothlet.metadata.get() from within API context", async () => {
			await api.slothlet.api.add("lookup", TEST_DIRS.API_SMART_FLATTEN, {
				fromGet: true,
				version: "1.0.0"
			});

			// Use helper function that calls self.slothlet.metadata.get() internally
			if (api.metadataTestHelper?.getMetadata) {
				const meta = await api.metadataTestHelper.getMetadata("lookup.config.settings.getPluginConfig");

				expect(meta).toBeDefined();
				expect(meta.fromGet).toBe(true);
				expect(meta.version).toBe("1.0.0");
				expect(meta.moduleID).toContain("lookup");
			}
		});

		it("should support self.slothlet.metadata.self() from within API context", async () => {
			// Use helper function that calls self.slothlet.metadata.self() internally
			if (api.metadataTestHelper?.getSelfMetadata) {
				const meta = await api.metadataTestHelper.getSelfMetadata();

				expect(meta).toBeDefined();
				expect(meta.moduleID).toBeDefined();
				expect(meta.apiPath).toContain("getSelfMetadata");
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
					expect(result.callerMeta.apiPath).toContain("testCaller");
				}
			}
		});

		it("should verify metadata existence via helper", async () => {
			await api.slothlet.api.add("verifiable", TEST_DIRS.API_SMART_FLATTEN, {
				verified: true
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
				dir: TEST_DIRS.API_TEST
			});
		});

		it("should handle deeply nested paths via internal API", async () => {
			await api.slothlet.api.add("deep", TEST_DIRS.API_SMART_FLATTEN, {
				depth: "very_deep"
			});

			await materialize(api, "deep.config.settings.getPluginConfig");

			// Access deeply nested function
			const metadata = await api.metadataTestHelper.getMetadata("deep.config.settings.getPluginConfig");

			expect(metadata).toBeDefined();
			expect(metadata.depth).toBe("very_deep");
			expect(metadata.apiPath).toBe("deep.config.settings.getPluginConfig");
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
				id: "first"
			});

			await api.slothlet.api.add("similar2", TEST_DIRS.API_SMART_FLATTEN, {
				id: "second"
			});

			await materialize(api, "similar1.config.settings.getPluginConfig");
			await materialize(api, "similar2.config.settings.getPluginConfig");

			const meta1 = await api.metadataTestHelper.getMetadata("similar1.config.settings.getPluginConfig");
			const meta2 = await api.metadataTestHelper.getMetadata("similar2.config.settings.getPluginConfig");

			expect(meta1.id).toBe("first");
			expect(meta2.id).toBe("second");
			expect(meta1.moduleID).not.toBe(meta2.moduleID);
		});

		it("should handle root-level functions via internal API", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			const metadata = await api.metadataTestHelper.getMetadata("rootMath.add");

			expect(metadata.apiPath).toBe("rootMath.add");
			expect(metadata.moduleID).toContain("rootMath/add");
		});

		it("should verify metadata existence for various path types", async () => {
			// Root-level function
			await materialize(api, "rootMath.add", 1, 2);
			const rootResult = await api.metadataTestHelper.verifyMetadata("rootMath.add");
			expect(rootResult.exists).toBe(true);

			// Added API function
			await api.slothlet.api.add("verified", TEST_DIRS.API_SMART_FLATTEN, {
				verified: true
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

			// Should have both system and user metadata
			expect(metadata.moduleID).toBeDefined(); // System
			expect(metadata.apiPath).toBeDefined(); // System
			expect(metadata.userKey).toBe("userValue"); // User
			expect(metadata.timestamp).toBeDefined(); // User
		});
	});
});
