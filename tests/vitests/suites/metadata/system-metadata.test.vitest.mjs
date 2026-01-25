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
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

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
		it("should preserve system metadata after lazy materialization", async () => {
			if (config.mode !== "lazy") return;

			await api.slothlet.api.add("lazyTest", TEST_DIRS.API_SMART_FLATTEN);

			// Before materialization - check if we can access metadata
			const metaBefore = api.lazyTest.config.settings.getPluginConfig.__metadata;

			// Materialize by calling
			await materialize(api, "lazyTest.config.settings.getPluginConfig");

			// After materialization
			const metaAfter = api.lazyTest.config.settings.getPluginConfig.__metadata;

			expect(metaBefore).toBeDefined();
			expect(metaAfter).toBeDefined();
			expect(metaAfter.moduleID).toBe(metaBefore.moduleID);
			expect(metaAfter.filePath).toBe(metaBefore.filePath);
			expect(metaAfter.apiPath).toBe(metaBefore.apiPath);
		});
	});

	describe("Nested Structure System Metadata", () => {
		it("should have correct system metadata at each nesting level", async () => {
			await api.slothlet.api.add("nested", TEST_DIRS.API_SMART_FLATTEN);

			// Level 1: nested
			if (api.nested.__metadata) {
				expect(api.nested.__metadata.apiPath).toContain("nested");
			}

			// Level 2: nested.config
			if (api.nested.config.__metadata) {
				expect(api.nested.config.__metadata.apiPath).toContain("nested.config");
			}

			// Level 3: nested.config.settings.getPluginConfig
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
});
