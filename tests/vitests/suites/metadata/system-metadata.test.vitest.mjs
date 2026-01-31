/**
 * @fileoverview Tests for system metadata (immutable, auto-generated).
 *
 * System metadata is automatically set by slothlet and CANNOT be modified:
 * - moduleID: Module identifier with format "prefix_id:apiPath"
 * - filePath: Absolute path to source file
 * - apiPath: Dotted path in API tree
 * - sourceFolder: Directory where module was loaded from
 * - taggedAt: Timestamp when metadata was attached
 *
 * @module tests/vitests/suites/metadata/system-metadata.test.vitest
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, materialize } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("System Metadata > Config: '$name'", ({ config }) => {
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

	describe("Base API System Metadata", () => {
		it("should have moduleID on base API functions", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const meta = api.rootMath.add.__metadata;

			expect(meta).toBeDefined();
			expect(meta.moduleID).toBeDefined();
			expect(typeof meta.moduleID).toBe("string");
			expect(meta.moduleID).toMatch(/^base_[a-z0-9]+:rootMath\/add$/);
		});

		it("should have correct filePath for base API", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const meta = api.rootMath.add.__metadata;

			expect(meta.filePath).toBeDefined();
			expect(typeof meta.filePath).toBe("string");
			expect(meta.filePath).toContain("root-math.mjs");
			expect(meta.filePath).toContain("api_test");
		});

		it("should have correct apiPath for base API", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const meta = api.rootMath.add.__metadata;

			expect(meta.apiPath).toBe("rootMath.add");
		});

		it("should have sourceFolder matching base dir for base API", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const meta = api.rootMath.add.__metadata;

			expect(meta.sourceFolder).toBeDefined();
			expect(meta.sourceFolder).toContain("api_test");
			expect(meta.sourceFolder).not.toContain("api_test_mixed");
		});
	});

	describe("Added API System Metadata", () => {
		it("should have moduleID on added API functions", async () => {
			await api.slothlet.api.add("plugins", TEST_DIRS.API_SMART_FLATTEN);
			await materialize(api, "plugins.config.settings.getPluginConfig");
			const meta = api.plugins.config.settings.getPluginConfig.__metadata;

			expect(meta.moduleID).toBeDefined();
			expect(typeof meta.moduleID).toBe("string");
			expect(meta.moduleID).toMatch(/^plugins_[a-z0-9]+:plugins\/config\/settings\/getPluginConfig$/);
		});

		it("should have sourceFolder matching added dir", async () => {
			await api.slothlet.api.add("plugins", TEST_DIRS.API_SMART_FLATTEN);
			await materialize(api, "plugins.config.settings.getPluginConfig");
			const meta = api.plugins.config.settings.getPluginConfig.__metadata;

			expect(meta.sourceFolder).toBeDefined();
			expect(meta.sourceFolder).toContain("api_smart_flatten_addapi_with_folders");
		});

		it("should have correct filePath for added API", async () => {
			await api.slothlet.api.add("plugins", TEST_DIRS.API_SMART_FLATTEN);
			await materialize(api, "plugins.config.settings.getPluginConfig");
			const meta = api.plugins.config.settings.getPluginConfig.__metadata;

			expect(meta.filePath).toContain("settings.mjs");
			expect(meta.filePath).toContain("api_smart_flatten_addapi_with_folders");
		});

		it("should have correct apiPath for added API", async () => {
			await api.slothlet.api.add("plugins", TEST_DIRS.API_SMART_FLATTEN);
			await materialize(api, "plugins.config.settings.getPluginConfig");
			const meta = api.plugins.config.settings.getPluginConfig.__metadata;

			expect(meta.apiPath).toBe("plugins.config.settings.getPluginConfig");
		});
	});

	describe("System Metadata Immutability", () => {
		it("should prevent modification of moduleID", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const meta = api.rootMath.add.__metadata;
			const originalModuleID = meta.moduleID;

			try {
				meta.moduleID = "hacked_id";
			} catch (_) {
				// Expected - frozen object
			}

			expect(meta.moduleID).toBe(originalModuleID);
		});

		it("should prevent modification of filePath", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const meta = api.rootMath.add.__metadata;
			const originalFilePath = meta.filePath;

			try {
				meta.filePath = "/fake/path.mjs";
			} catch (_) {
				// Expected
			}

			expect(meta.filePath).toBe(originalFilePath);
		});

		it("should prevent modification of apiPath", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const meta = api.rootMath.add.__metadata;
			const originalApiPath = meta.apiPath;

			try {
				meta.apiPath = "hacked.path";
			} catch (_) {
				// Expected
			}

			expect(meta.apiPath).toBe(originalApiPath);
		});

		it("should prevent modification of sourceFolder", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const meta = api.rootMath.add.__metadata;
			const originalSourceFolder = meta.sourceFolder;

			try {
				meta.sourceFolder = "/fake/folder";
			} catch (_) {
				// Expected
			}

			expect(meta.sourceFolder).toBe(originalSourceFolder);
		});
	});

	describe("Lazy Mode Materialization", () => {
		it("should have metadata before and after lazy materialization", async () => {
			if (config.mode !== "lazy") return;

			await api.slothlet.api.add("lazyTest", TEST_DIRS.API_SMART_FLATTEN);

			// Before materialization - access __type to trigger lazy loading
			// The __type getter will trigger materialization, then return symbol if in-flight or typeof if complete
			const wrapper = api.lazyTest.config.settings.getPluginConfig;
			const typeBefore = wrapper.__type;

			// Also get metadata
			const metaBefore = wrapper.__metadata;
			await materialize(api, "lazyTest.config.settings.getPluginConfig");

			// After materialization - metadata comes from function wrapper
			const metaAfter = api.lazyTest.config.settings.getPluginConfig.__metadata;
			const typeAfter = api.lazyTest.config.settings.getPluginConfig.__type;

			// Both metadata should be defined
			expect(metaBefore).toBeDefined();
			expect(metaAfter).toBeDefined();

			// Before materialization: __type triggers materialization and either:
			// - Returns a symbol (UNMATERIALIZED or IN_FLIGHT) if materialization is async/pending
			// - Returns typeof string ("function") if materialization completed synchronously
			if (typeof typeBefore === "symbol") {
				expect(["unmaterialized", "inFlight"]).toContain(typeBefore.description);
			} else {
				// Materialized synchronously - should be "function"
				expect(typeBefore).toBe("function");
			}

			// After explicit materialization, metadata comes from specific function
			expect(metaAfter.apiPath).toBe("lazyTest.config.settings.getPluginConfig");
			expect(metaAfter.moduleID).toMatch(/^lazyTest_[a-z0-9]+:lazyTest\/config\/settings\/getPluginConfig$/);
			expect(metaAfter.filePath).toContain("settings.mjs");

			// After materialization, __type should return "function" (the typeof the impl)
			expect(typeAfter).toBe("function");
		});

		it("should have correct system metadata at function level", async () => {
			await api.slothlet.api.add("nested", TEST_DIRS.API_SMART_FLATTEN);

			// Note: Intermediate levels (api.nested, api.nested.config) may or may not have complete metadata
			// depending on how they were added. Only the actual function wrappers are guaranteed to have
			// complete system metadata.

			// Test function-level metadata
			await materialize(api, "nested.config.settings.getPluginConfig");
			const meta = api.nested.config.settings.getPluginConfig.__metadata;
			expect(meta.apiPath).toBe("nested.config.settings.getPluginConfig");
			expect(meta.moduleID).toContain("nested/config/settings/getPluginConfig");
		});

		it("should maintain sourceFolder through all nesting levels", async () => {
			await api.slothlet.api.add("deep", TEST_DIRS.API_SMART_FLATTEN);
			await materialize(api, "deep.config.settings.getPluginConfig");

			const meta = api.deep.config.settings.getPluginConfig.__metadata;
			expect(meta.sourceFolder).toContain("api_smart_flatten_addapi_with_folders");
		});
	});

	describe("moduleID Format Validation", () => {
		it("should use base_ prefix for base API", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const meta = api.rootMath.add.__metadata;

			expect(meta.moduleID).toMatch(/^base_[a-z0-9]+:/);
		});

		it("should use custom prefix for added API", async () => {
			await api.slothlet.api.add("custom", TEST_DIRS.API_SMART_FLATTEN);
			await materialize(api, "custom.config.settings.getPluginConfig");
			const meta = api.custom.config.settings.getPluginConfig.__metadata;

			expect(meta.moduleID).toMatch(/^custom_[a-z0-9]+:/);
		});

		it("should include full apiPath after colon", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const meta = api.rootMath.add.__metadata;

			const [prefix, path] = meta.moduleID.split(":");
			expect(prefix).toMatch(/^base_[a-z0-9]+$/);
			expect(path).toBe("rootMath/add");
		});
	});

	describe("Internal API Access to System Metadata (self.slothlet.metadata.*)", () => {
		it("should access system metadata via self.slothlet.metadata.get() from within API", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Use helper that calls self.slothlet.metadata.get() internally
			const metadata = await api.metadataTestHelper.getMetadata("rootMath.add");

			// Should retrieve system metadata
			expect(metadata).toBeDefined();
			expect(metadata.moduleID).toBeDefined();
			expect(metadata.moduleID).toMatch(/^base_[a-z0-9]+:rootMath\/add$/);
			expect(metadata.filePath).toContain("root-math.mjs");
			expect(metadata.apiPath).toBe("rootMath.add");
			expect(metadata.sourceFolder).toContain("api_test");
		});

		it("should access nested function system metadata internally", async () => {
			await api.slothlet.api.add("internal", TEST_DIRS.API_SMART_FLATTEN);
			await materialize(api, "internal.config.settings.getPluginConfig");

			// Access via internal API
			const metadata = await api.metadataTestHelper.getMetadata("internal.config.settings.getPluginConfig");

			expect(metadata.apiPath).toBe("internal.config.settings.getPluginConfig");
			expect(metadata.moduleID).toContain("internal/config/settings/getPluginConfig");
			expect(metadata.filePath).toContain("settings.mjs");
		});

		it("should return undefined for non-existent paths via internal API", async () => {
			const metadata = await api.metadataTestHelper.getMetadata("nonExistent.path");
			expect(metadata).toBeUndefined();
		});

		it("should access own system metadata via self.slothlet.metadata.self()", async () => {
			const selfMetadata = await api.metadataTestHelper.getSelfMetadata();

			// Should return metadata of the helper function itself
			expect(selfMetadata).toBeDefined();
			expect(selfMetadata.apiPath).toContain("metadataTestHelper");
			expect(selfMetadata.moduleID).toBeDefined();
		});

		it("should track system metadata immutability via internal API", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Get metadata via internal API
			const metadata = await api.metadataTestHelper.getMetadata("rootMath.add");
			const originalModuleID = metadata.moduleID;

			// Attempt to modify (should fail silently due to freeze)
			try {
				metadata.moduleID = "hacked";
			} catch (_) {
				// Expected
			}

			// Verify still immutable
			const metadataAfter = await api.metadataTestHelper.getMetadata("rootMath.add");
			expect(metadataAfter.moduleID).toBe(originalModuleID);
		});
	});
});
