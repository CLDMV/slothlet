/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/metadata/system-metadata.test.vitest.mjs
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
 * @fileoverview Tests for system metadata (immutable, auto-generated).
 *
 * System metadata is automatically set by slothlet and CANNOT be modified:
 * - moduleID: Module identifier with format `prefix_id${MODULE_ID_SEPARATOR}apiPath`
 * - filePath: Absolute path to source file
 * - apiPath: Dotted path in API tree
 * - sourceFolder: Directory where module was loaded from
 * - taggedAt: Timestamp when metadata was attached
 *
 * @module tests/vitests/suites/metadata/system-metadata.test.vitest
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { MODULE_ID_SEPARATOR } from "#handlers/metadata";
import { getMatrixConfigs, TEST_DIRS, materialize } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("System Metadata > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST
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
			const meta = api.slothlet.metadata.get(api.rootMath.add);
			const metaNode = api.slothlet.node(api.rootMath.add);

			expect(meta).toBeDefined();
			expect(metaNode.module).toBeDefined();
			expect(typeof metaNode.module).toBe("string");
			expect(metaNode.module).toMatch(new RegExp(`^base_[a-z0-9]+$`));
		});

		it("should have correct filePath for base API", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const metaNode = api.slothlet.node(api.rootMath.add);

			expect(metaNode.file).toBeDefined();
			expect(typeof metaNode.file).toBe("string");
			expect(metaNode.file).toContain("root-math.mjs");
			expect(metaNode.file).toContain("api_test");
		});

		it("should have correct apiPath for base API", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const metaNode = api.slothlet.node(api.rootMath.add);

			expect(metaNode.path.join(".")).toBe("rootMath.add");
		});

		it("should have sourceFolder matching base dir for base API", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const metaNode = api.slothlet.node(api.rootMath.add);

			expect(metaNode.folder).toBeDefined();
			expect(metaNode.folder).toContain("api_test");
			expect(metaNode.folder).not.toContain("api_test_mixed");
		});
	});

	describe("Added API System Metadata", () => {
		it("should have moduleID on added API functions", async () => {
			await api.slothlet.api.add("plugins", TEST_DIRS.API_SMART_FLATTEN);
			await materialize(api, "plugins.config.settings.getPluginConfig");
			const metaNode = api.slothlet.node(api.plugins.config.settings.getPluginConfig);

			expect(metaNode.module).toBeDefined();
			expect(typeof metaNode.module).toBe("string");
			expect(metaNode.module).toMatch(new RegExp(`^plugins_[a-z0-9]+$`));
		});

		it("should have sourceFolder matching added dir", async () => {
			await api.slothlet.api.add("plugins", TEST_DIRS.API_SMART_FLATTEN);
			await materialize(api, "plugins.config.settings.getPluginConfig");
			const metaNode = api.slothlet.node(api.plugins.config.settings.getPluginConfig);

			expect(metaNode.folder).toBeDefined();
			expect(metaNode.folder).toContain("api_smart_flatten_addapi_with_folders");
		});

		it("should have correct filePath for added API", async () => {
			await api.slothlet.api.add("plugins", TEST_DIRS.API_SMART_FLATTEN);
			await materialize(api, "plugins.config.settings.getPluginConfig");
			const metaNode = api.slothlet.node(api.plugins.config.settings.getPluginConfig);

			expect(metaNode.file).toContain("settings.mjs");
			expect(metaNode.file).toContain("api_smart_flatten_addapi_with_folders");
		});

		it("should have correct apiPath for added API", async () => {
			await api.slothlet.api.add("plugins", TEST_DIRS.API_SMART_FLATTEN);
			await materialize(api, "plugins.config.settings.getPluginConfig");
			const metaNode = api.slothlet.node(api.plugins.config.settings.getPluginConfig);

			expect(metaNode.path.join(".")).toBe("plugins.config.settings.getPluginConfig");
		});
	});

	describe("System Metadata Immutability", () => {
		it("should prevent modification of moduleID", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const metaNode = api.slothlet.node(api.rootMath.add);
			const originalModuleID = metaNode.module;

			try {
				metaNode.module = "hacked_id";
			} catch (_) {
				// Expected - frozen object
			}

			expect(metaNode.module).toBe(originalModuleID);
		});

		it("should prevent modification of filePath", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const metaNode = api.slothlet.node(api.rootMath.add);
			const originalFilePath = metaNode.file;

			try {
				metaNode.file = "/fake/path.mjs";
			} catch (_) {
				// Expected
			}

			expect(metaNode.file).toBe(originalFilePath);
		});

		it("should prevent modification of apiPath", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const metaNode = api.slothlet.node(api.rootMath.add);
			const originalApiPath = metaNode.path.join(".");

			try {
				metaNode.path = ["hacked", "path"];
			} catch (_) {
				// Expected
			}

			expect(metaNode.path.join(".")).toBe(originalApiPath);
		});

		it("should prevent modification of sourceFolder", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const metaNode = api.slothlet.node(api.rootMath.add);
			const originalSourceFolder = metaNode.folder;

			try {
				metaNode.folder = "/fake/folder";
			} catch (_) {
				// Expected
			}

			expect(metaNode.folder).toBe(originalSourceFolder);
		});
	});

	describe("Lazy Mode Materialization", () => {
		it("should have metadata before and after lazy materialization", async () => {
			if (config.mode !== "lazy") return;

			await api.slothlet.api.add("lazyTest", TEST_DIRS.API_SMART_FLATTEN);

			// Before materialization - access __type to trigger lazy loading
			// The __type getter will trigger materialization, then return symbol if in-flight or typeof if complete
			const wrapper = api.lazyTest.config.settings.getPluginConfig;
			const typeBefore = api.slothlet.node(wrapper).type;

			// Also get metadata
			const metaBefore = api.slothlet.metadata.get(wrapper);
			await materialize(api, "lazyTest.config.settings.getPluginConfig");

			// After materialization - metadata comes from function wrapper
			const metaAfter = api.slothlet.metadata.get(api.lazyTest.config.settings.getPluginConfig);
			const metaAfterNode = api.slothlet.node(api.lazyTest.config.settings.getPluginConfig);
			const typeAfter = api.slothlet.node(api.lazyTest.config.settings.getPluginConfig).type;

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
			expect(metaAfterNode.path.join(".")).toBe("lazyTest.config.settings.getPluginConfig");
			expect(metaAfterNode.module).toMatch(new RegExp(`^lazyTest_[a-z0-9]+$`));
			expect(metaAfterNode.file).toContain("settings.mjs");

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
			const metaNode = api.slothlet.node(api.nested.config.settings.getPluginConfig);
			expect(metaNode.path.join(".")).toBe("nested.config.settings.getPluginConfig");
			expect(metaNode.module).toMatch(/^nested_[a-z0-9]+$/);
		});

		it("should maintain sourceFolder through all nesting levels", async () => {
			await api.slothlet.api.add("deep", TEST_DIRS.API_SMART_FLATTEN);
			await materialize(api, "deep.config.settings.getPluginConfig");

			const metaNode = api.slothlet.node(api.deep.config.settings.getPluginConfig);
			expect(metaNode.folder).toContain("api_smart_flatten_addapi_with_folders");
		});
	});

	describe("moduleID Format Validation", () => {
		it("should use base_ prefix for base API", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const metaNode = api.slothlet.node(api.rootMath.add);

			expect(metaNode.module).toMatch(new RegExp(`^base_[a-z0-9]+$`));
		});

		it("should use custom prefix for added API", async () => {
			await api.slothlet.api.add("custom", TEST_DIRS.API_SMART_FLATTEN);
			await materialize(api, "custom.config.settings.getPluginConfig");
			const metaNode = api.slothlet.node(api.custom.config.settings.getPluginConfig);

			expect(metaNode.module).toMatch(new RegExp(`^custom_[a-z0-9]+$`));
		});

		it("reports the raw module id, never the internal composite", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const metaNode = api.slothlet.node(api.rootMath.add);

			expect(metaNode.module).not.toContain(MODULE_ID_SEPARATOR);
			expect(metaNode.module).toMatch(/^base_[a-z0-9]+$/);
			expect(metaNode.path).toEqual(["rootMath", "add"]);
		});
	});

	describe("Internal API Access to node reports (self.slothlet.node)", () => {
		it("reads a node's report via self.slothlet.node() from within the API", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			const report = await api.metadataTestHelper.getNode("rootMath.add");

			expect(report).toBeDefined();
			expect(report.module).toMatch(/^base_[a-z0-9]+$/);
			expect(report.file).toContain("root-math.mjs");
			expect(report.path).toEqual(["rootMath", "add"]);
			expect(report.folder).toContain("api_test");
		});

		it("reads a nested function's report internally", async () => {
			await api.slothlet.api.add("internal", TEST_DIRS.API_SMART_FLATTEN);
			await materialize(api, "internal.config.settings.getPluginConfig");

			const report = await api.metadataTestHelper.getNode("internal.config.settings.getPluginConfig");

			expect(report.path).toEqual(["internal", "config", "settings", "getPluginConfig"]);
			expect(report.module).toMatch(/^internal_[a-z0-9]+$/);
			expect(report.file).toContain("settings.mjs");
		});

		it("returns undefined for non-existent paths via internal API", async () => {
			expect(await api.metadataTestHelper.getNode("nonExistent.path")).toBeUndefined();
		});

		it("reads its own node's report", async () => {
			const report = await api.metadataTestHelper.getNode();

			expect(report).toBeDefined();
			expect(report.path).toContain("metadataTestHelper");
			expect(typeof report.module).toBe("string");
		});

		it("the report read internally is frozen", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			const report = await api.metadataTestHelper.getNode("rootMath.add");
			const originalModule = report.module;
			expect(() => {
				report.module = "hacked";
			}).toThrow(TypeError);

			const after = await api.metadataTestHelper.getNode("rootMath.add");
			expect(after.module).toBe(originalModule);
		});

		it("self.slothlet.metadata.get() returns user metadata only", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			const metadata = await api.metadataTestHelper.getMetadata("rootMath.add");
			expect(metadata.moduleID).toBeUndefined();
			expect(metadata.filePath).toBeUndefined();
			expect(metadata.apiPath).toBeUndefined();
		});
	});
});
