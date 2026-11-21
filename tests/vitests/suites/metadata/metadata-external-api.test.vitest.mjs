/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/metadata/metadata-external-api.test.vitest.mjs
 *	@Date: 2026-01-25T14:50:54-08:00 (1769381454)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:09-08:00 (1794882609)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Tests for external metadata API (set/remove/metadata.global).
 *
 * Tests the public API for manipulating metadata from OUTSIDE API context:
 * - api.slothlet.metadata.set(fn, key, value) - Set metadata on specific function
 * - api.slothlet.metadata.remove(fn, key?) - Remove metadata from function
 * - api.slothlet.metadata.global(key, value) - Set global metadata
 *
 * These are EXTERNAL APIs used by users to modify metadata at runtime.
 * They differ from INTERNAL APIs (self.slothlet.metadata.get/self/caller)
 * which are used FROM WITHIN API files for introspection.
 *
 * @module tests/vitests/suites/metadata/metadata-external-api.test.vitest
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, materialize, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("External Metadata API > Config: '$name'", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
	});

	describe("api.slothlet.metadata.set()", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST
			});
		});

		it("should set user metadata on a function", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Set metadata via external API
			api.slothlet.metadata.set(api.rootMath.add, "category", "math");
			api.slothlet.metadata.set(api.rootMath.add, "version", "2.0.0");

			// Verify metadata was set
			const meta = api.slothlet.metadata.get(api.rootMath.add);
			const metaNode = api.slothlet.node(api.rootMath.add);
			expect(meta).toBeDefined();
			expect(meta.category).toBe("math");
			expect(meta.version).toBe("2.0.0");

			// System metadata should still be present
			expect(metaNode.module).toBeDefined();
			expect(metaNode.file).toBeDefined();
		});

		it("should override existing user metadata keys", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Set initial metadata
			api.slothlet.metadata.set(api.rootMath.add, "version", "1.0.0");
			expect(api.slothlet.metadata.get(api.rootMath.add).version).toBe("1.0.0");

			// Override with new value
			api.slothlet.metadata.set(api.rootMath.add, "version", "2.0.0");
			expect(api.slothlet.metadata.get(api.rootMath.add).version).toBe("2.0.0");
		});

		it("should NOT override system metadata", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			const originalModuleID = api.slothlet.node(api.rootMath.add).module;
			const originalFilePath = api.slothlet.node(api.rootMath.add).file;

			// Attempt to override system metadata (should fail or be ignored)
			api.slothlet.metadata.set(api.rootMath.add, "moduleID", "fake-id");
			api.slothlet.metadata.set(api.rootMath.add, "filePath", "fake-path");

			// System metadata should remain unchanged
			expect(api.slothlet.node(api.rootMath.add).module).toBe(originalModuleID);
			expect(api.slothlet.node(api.rootMath.add).file).toBe(originalFilePath);
		});

		it("should work with nested functions", async () => {
			await materialize(api, "nested.date.today");

			api.slothlet.metadata.set(api.nested.date.today, "plugin", "test-plugin");
			api.slothlet.metadata.set(api.nested.date.today, "enabled", true);

			const meta = api.slothlet.metadata.get(api.nested.date.today);
			expect(meta.plugin).toBe("test-plugin");
			expect(meta.enabled).toBe(true);
		});

		it("should handle multiple functions independently", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			await materialize(api, "rootMath.multiply", 5, 3);

			api.slothlet.metadata.set(api.rootMath.add, "operation", "addition");
			api.slothlet.metadata.set(api.rootMath.multiply, "operation", "multiplication");

			expect(api.slothlet.metadata.get(api.rootMath.add).operation).toBe("addition");
			expect(api.slothlet.metadata.get(api.rootMath.multiply).operation).toBe("multiplication");
		});

		it("should persist metadata across function calls", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.set(api.rootMath.add, "callCount", 0);

			// Call function multiple times
			await materialize(api, "rootMath.add", 1, 2);
			await materialize(api, "rootMath.add", 3, 4);
			await materialize(api, "rootMath.add", 5, 6);

			// Metadata should persist
			expect(api.slothlet.metadata.get(api.rootMath.add).callCount).toBe(0);
		});
	});

	describe("api.slothlet.metadata.remove()", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST
			});
		});

		it("should remove specific user metadata key", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Set metadata
			api.slothlet.metadata.set(api.rootMath.add, "version", "1.0.0");
			api.slothlet.metadata.set(api.rootMath.add, "category", "math");

			expect(api.slothlet.metadata.get(api.rootMath.add).version).toBe("1.0.0");
			expect(api.slothlet.metadata.get(api.rootMath.add).category).toBe("math");

			// Remove one key
			api.slothlet.metadata.remove(api.rootMath.add, "version");

			// Only removed key should be gone
			expect(api.slothlet.metadata.get(api.rootMath.add).version).toBeUndefined();
			expect(api.slothlet.metadata.get(api.rootMath.add).category).toBe("math");

			// System metadata should remain
			expect(api.slothlet.node(api.rootMath.add).module).toBeDefined();
		});

		it("should remove all user metadata when no key specified", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Set multiple metadata keys
			api.slothlet.metadata.set(api.rootMath.add, "version", "1.0.0");
			api.slothlet.metadata.set(api.rootMath.add, "category", "math");
			api.slothlet.metadata.set(api.rootMath.add, "author", "test");

			const originalModuleID = api.slothlet.node(api.rootMath.add).module;

			// Remove all user metadata
			api.slothlet.metadata.remove(api.rootMath.add);

			// All user metadata should be removed
			expect(api.slothlet.metadata.get(api.rootMath.add).version).toBeUndefined();
			expect(api.slothlet.metadata.get(api.rootMath.add).category).toBeUndefined();
			expect(api.slothlet.metadata.get(api.rootMath.add).author).toBeUndefined();

			// System metadata should remain
			expect(api.slothlet.node(api.rootMath.add).module).toBe(originalModuleID);
		});

		it("should NOT remove system metadata", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			const metaNode = api.slothlet.node(api.rootMath.add);
			const originalModuleID = metaNode.module;
			const originalFilePath = metaNode.file;
			const originalApiPath = metaNode.path.join(".");

			// Attempt to remove system metadata (should fail or be ignored)
			api.slothlet.metadata.remove(api.rootMath.add, "moduleID");
			api.slothlet.metadata.remove(api.rootMath.add, "filePath");
			api.slothlet.metadata.remove(api.rootMath.add, "apiPath");

			// System metadata should remain
			expect(api.slothlet.node(api.rootMath.add).module).toBe(originalModuleID);
			expect(api.slothlet.node(api.rootMath.add).file).toBe(originalFilePath);
			expect(api.slothlet.node(api.rootMath.add).path.join(".")).toBe(originalApiPath);
		});

		it("should handle removing non-existent keys gracefully", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Try to remove key that doesn't exist
			expect(() => {
				api.slothlet.metadata.remove(api.rootMath.add, "nonexistent");
			}).not.toThrow();

			// Metadata should still exist
			expect(api.slothlet.metadata.get(api.rootMath.add)).toBeDefined();
		});

		it("should remove multiple keys with array parameter", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Set multiple metadata keys
			api.slothlet.metadata.set(api.rootMath.add, "version", "1.0.0");
			api.slothlet.metadata.set(api.rootMath.add, "category", "math");
			api.slothlet.metadata.set(api.rootMath.add, "author", "test");
			api.slothlet.metadata.set(api.rootMath.add, "status", "stable");

			expect(api.slothlet.metadata.get(api.rootMath.add).version).toBe("1.0.0");
			expect(api.slothlet.metadata.get(api.rootMath.add).category).toBe("math");
			expect(api.slothlet.metadata.get(api.rootMath.add).author).toBe("test");
			expect(api.slothlet.metadata.get(api.rootMath.add).status).toBe("stable");

			// Remove multiple keys at once
			api.slothlet.metadata.remove(api.rootMath.add, ["version", "author"]);

			// Removed keys should be gone
			expect(api.slothlet.metadata.get(api.rootMath.add).version).toBeUndefined();
			expect(api.slothlet.metadata.get(api.rootMath.add).author).toBeUndefined();

			// Non-removed keys should remain
			expect(api.slothlet.metadata.get(api.rootMath.add).category).toBe("math");
			expect(api.slothlet.metadata.get(api.rootMath.add).status).toBe("stable");

			// System metadata should remain
			expect(api.slothlet.node(api.rootMath.add).module).toBeDefined();
		});

		it("should throw error for non-string elements in array parameter", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.set(api.rootMath.add, "version", "1.0.0");

			// Try to remove with non-string array element
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => {
					api.slothlet.metadata.remove(api.rootMath.add, ["version", 123]);
				}).toThrow(/METADATA_KEY_INVALID/);
				expect(() => {
					api.slothlet.metadata.remove(api.rootMath.add, ["version", null]);
				}).toThrow(/METADATA_KEY_INVALID/);
				expect(() => {
					api.slothlet.metadata.remove(api.rootMath.add, ["version", undefined]);
				}).toThrow(/METADATA_KEY_INVALID/);
			});
		});

		it("should remove nested keys from object values with object parameter", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Set metadata with nested objects
			api.slothlet.metadata.set(api.rootMath.add, "config", {
				timeout: 5000,
				retries: 3,
				cache: true,
				debug: false
			});
			api.slothlet.metadata.set(api.rootMath.add, "stats", {
				calls: 100,
				errors: 2,
				avgTime: 50
			});

			// Remove specific nested keys from both objects
			api.slothlet.metadata.remove(api.rootMath.add, {
				config: ["timeout", "debug"],
				stats: ["errors"]
			});

			// Removed nested keys should be gone
			expect(api.slothlet.metadata.get(api.rootMath.add).config.timeout).toBeUndefined();
			expect(api.slothlet.metadata.get(api.rootMath.add).config.debug).toBeUndefined();
			expect(api.slothlet.metadata.get(api.rootMath.add).stats.errors).toBeUndefined();

			// Non-removed nested keys should remain
			expect(api.slothlet.metadata.get(api.rootMath.add).config.retries).toBe(3);
			expect(api.slothlet.metadata.get(api.rootMath.add).config.cache).toBe(true);
			expect(api.slothlet.metadata.get(api.rootMath.add).stats.calls).toBe(100);
			expect(api.slothlet.metadata.get(api.rootMath.add).stats.avgTime).toBe(50);

			// System metadata should remain
			expect(api.slothlet.node(api.rootMath.add).module).toBeDefined();
		});

		it("should throw error for non-array values in object parameter", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.set(api.rootMath.add, "config", { timeout: 5000 });

			// Try to remove with non-array object value
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => {
					api.slothlet.metadata.remove(api.rootMath.add, { config: "timeout" });
				}).toThrow(/METADATA_KEY_INVALID/);
				expect(() => {
					api.slothlet.metadata.remove(api.rootMath.add, { config: 123 });
				}).toThrow(/METADATA_KEY_INVALID/);
			});
		});

		it("should throw error for non-string nested keys in object parameter", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.set(api.rootMath.add, "config", { timeout: 5000 });

			// Try to remove with non-string nested key
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => {
					api.slothlet.metadata.remove(api.rootMath.add, { config: ["timeout", 123] });
				}).toThrow(/METADATA_KEY_INVALID/);
			});
		});

		it("should handle object parameter gracefully when metadata value is not an object", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Set non-object metadata value
			api.slothlet.metadata.set(api.rootMath.add, "version", "1.0.0");

			// Try to remove nested keys (should not throw, just not remove anything)
			expect(() => {
				api.slothlet.metadata.remove(api.rootMath.add, { version: ["subkey"] });
			}).not.toThrow();

			// Value should remain unchanged
			expect(api.slothlet.metadata.get(api.rootMath.add).version).toBe("1.0.0");
		});
	});

	describe("api.slothlet.metadata.global()", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST
			});
		});

		it("should set global metadata visible to all functions", async () => {
			// Set global metadata
			api.slothlet.metadata.global("appVersion", "3.0.0");
			api.slothlet.metadata.global("environment", "test");

			// Materialize multiple functions
			await materialize(api, "rootMath.add", 1, 2);
			await materialize(api, "rootMath.multiply", 5, 3);

			// Global metadata should be in both
			expect(api.slothlet.metadata.get(api.rootMath.add).appVersion).toBe("3.0.0");
			expect(api.slothlet.metadata.get(api.rootMath.add).environment).toBe("test");
			expect(api.slothlet.metadata.get(api.rootMath.multiply).appVersion).toBe("3.0.0");
			expect(api.slothlet.metadata.get(api.rootMath.multiply).environment).toBe("test");
		});

		it("should accept object payload for global metadata", async () => {
			api.slothlet.metadata.global({ appVersion: "3.1.0", environment: "staging" });

			await materialize(api, "rootMath.add", 1, 2);
			await materialize(api, "rootMath.multiply", 5, 3);

			expect(api.slothlet.metadata.get(api.rootMath.add).appVersion).toBe("3.1.0");
			expect(api.slothlet.metadata.get(api.rootMath.add).environment).toBe("staging");
			expect(api.slothlet.metadata.get(api.rootMath.multiply).appVersion).toBe("3.1.0");
			expect(api.slothlet.metadata.get(api.rootMath.multiply).environment).toBe("staging");
		});

		it("should preserve nested object payload shape in metadata.global", async () => {
			api.slothlet.metadata.global({
				build: { region: "us", env: { tier: "prod" } }
			});

			await materialize(api, "rootMath.add", 1, 2);

			expect(api.slothlet.metadata.get(api.rootMath.add).build.region).toBe("us");
			expect(api.slothlet.metadata.get(api.rootMath.add).build.env.tier).toBe("prod");
		});

		it("should deep merge nested object payloads across metadata.global calls", async () => {
			api.slothlet.metadata.global({
				build: { region: "us" }
			});
			api.slothlet.metadata.global({
				build: { env: { tier: "prod" } }
			});

			await materialize(api, "rootMath.add", 1, 2);

			expect(api.slothlet.metadata.get(api.rootMath.add).build.region).toBe("us");
			expect(api.slothlet.metadata.get(api.rootMath.add).build.env.tier).toBe("prod");
		});

		it("should reject circular plain objects in string-key metadata.global mode", async () => {
			api.slothlet.metadata.global("build", { region: "us" });

			const circular = {
				region: "eu"
			};
			circular.self = circular;

			try {
				api.slothlet.metadata.global("build", circular);
				expect.unreachable("Should have thrown INVALID_ARGUMENT");
			} catch (error) {
				expect(error.message).toContain("INVALID_ARGUMENT");
				expect(error.details?.argument).toBe("metadata.build");
			}

			await materialize(api, "rootMath.add", 1, 2);
			expect(api.slothlet.metadata.get(api.rootMath.add).build.region).toBe("us");
		});

		it("should reject prototype-pollution global metadata keys in string mode", async () => {
			expect(() => api.slothlet.metadata.global("__proto__", "polluted")).toThrow(/METADATA_KEY_INVALID/);
			expect(() => api.slothlet.metadata.global("constructor", "polluted")).toThrow(/METADATA_KEY_INVALID/);
			expect(() => api.slothlet.metadata.global("prototype", "polluted")).toThrow(/METADATA_KEY_INVALID/);
		});

		it("should reject prototype-pollution keys when deep-merging metadata.global string-mode objects", async () => {
			api.slothlet.metadata.global("build", { region: "us" });

			const mergePayload = Object.create(null);
			Object.defineProperty(mergePayload, "__proto__", {
				value: { polluted: true },
				enumerable: true,
				configurable: true,
				writable: true
			});

			expect(() => api.slothlet.metadata.global("build", mergePayload)).toThrow(/METADATA_KEY_INVALID/);
		});

		it("should reject prototype-pollution segments in nested object mode", async () => {
			const buildWithProtoKey = Object.create(null);
			Object.defineProperty(buildWithProtoKey, "__proto__", {
				value: "polluted",
				enumerable: true,
				configurable: true,
				writable: true
			});

			expect(() =>
				api.slothlet.metadata.global({
					safe: "ok",
					build: buildWithProtoKey
				})
			).toThrow(/METADATA_KEY_INVALID/);

			expect(() =>
				api.slothlet.metadata.global({
					safe: "ok",
					constructor: { nested: true }
				})
			).toThrow(/METADATA_KEY_INVALID/);
		});

		it("should override global metadata on specific function", async () => {
			// Set global metadata
			api.slothlet.metadata.global("version", "1.0.0");

			await materialize(api, "rootMath.add", 1, 2);
			await materialize(api, "rootMath.multiply", 5, 3);

			// Override on specific function
			api.slothlet.metadata.set(api.rootMath.add, "version", "2.0.0");

			// One function has override, other has global
			expect(api.slothlet.metadata.get(api.rootMath.add).version).toBe("2.0.0");
			expect(api.slothlet.metadata.get(api.rootMath.multiply).version).toBe("1.0.0");
		});

		it("should apply global metadata to newly added functions", async () => {
			// Set global metadata first
			api.slothlet.metadata.global("defaultCategory", "utility");

			// Add new API
			await api.slothlet.api.add("testFunc", TEST_DIRS.API_SMART_FLATTEN);

			// Materialize function from newly added API
			await materialize(api, "testFunc.config.settings.getPluginConfig");

			// Should have global metadata
			expect(api.slothlet.metadata.get(api.testFunc.config.settings.getPluginConfig).defaultCategory).toBe("utility");
		});

		it("should handle multiple global metadata updates", async () => {
			api.slothlet.metadata.global("counter", 1);

			await materialize(api, "rootMath.add", 1, 2);
			expect(api.slothlet.metadata.get(api.rootMath.add).counter).toBe(1);

			// Update global metadata
			api.slothlet.metadata.global("counter", 2);

			// Newly materialized functions should get updated value
			await materialize(api, "rootMath.multiply", 5, 3);
			expect(api.slothlet.metadata.get(api.rootMath.multiply).counter).toBe(2);

			// Already materialized function gets updated value too (global metadata is LIVE)
			expect(api.slothlet.metadata.get(api.rootMath.add).counter).toBe(2);
		});
	});

	describe("Combined External API Operations", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST
			});
		});

		it("should handle set/remove/metadata.global in combination", async () => {
			// Set global metadata
			api.slothlet.metadata.global("appName", "TestApp");
			api.slothlet.metadata.global("version", "1.0.0");

			await materialize(api, "rootMath.add", 1, 2);

			// Should have global metadata
			expect(api.slothlet.metadata.get(api.rootMath.add).appName).toBe("TestApp");
			expect(api.slothlet.metadata.get(api.rootMath.add).version).toBe("1.0.0");

			// Set function-specific metadata
			api.slothlet.metadata.set(api.rootMath.add, "version", "2.0.0");
			api.slothlet.metadata.set(api.rootMath.add, "custom", "value");

			expect(api.slothlet.metadata.get(api.rootMath.add).appName).toBe("TestApp"); // Global
			expect(api.slothlet.metadata.get(api.rootMath.add).version).toBe("2.0.0"); // Override
			expect(api.slothlet.metadata.get(api.rootMath.add).custom).toBe("value"); // Specific

			// Remove function-specific metadata
			api.slothlet.metadata.remove(api.rootMath.add, "custom");

			expect(api.slothlet.metadata.get(api.rootMath.add).custom).toBeUndefined();
			expect(api.slothlet.metadata.get(api.rootMath.add).appName).toBe("TestApp"); // Still present
			expect(api.slothlet.metadata.get(api.rootMath.add).version).toBe("2.0.0"); // Still present
		});

		it("should maintain metadata isolation between functions", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			await materialize(api, "rootMath.multiply", 5, 3);
			await materialize(api, "nested.date.today");

			// Set different metadata on each
			api.slothlet.metadata.set(api.rootMath.add, "tag", "add");
			api.slothlet.metadata.set(api.rootMath.multiply, "tag", "multiply");
			api.slothlet.metadata.set(api.nested.date.today, "tag", "date");

			// Each should have its own metadata
			expect(api.slothlet.metadata.get(api.rootMath.add).tag).toBe("add");
			expect(api.slothlet.metadata.get(api.rootMath.multiply).tag).toBe("multiply");
			expect(api.slothlet.metadata.get(api.nested.date.today).tag).toBe("date");

			// Removing one shouldn't affect others
			api.slothlet.metadata.remove(api.rootMath.add, "tag");

			expect(api.slothlet.metadata.get(api.rootMath.add).tag).toBeUndefined();
			expect(api.slothlet.metadata.get(api.rootMath.multiply).tag).toBe("multiply");
			expect(api.slothlet.metadata.get(api.nested.date.today).tag).toBe("date");
		});
	});

	describe("api.slothlet.metadata.set()", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST
			});
		});

		it("should set metadata on all functions under an API path (single key)", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			await materialize(api, "rootMath.multiply", 5, 3);

			api.slothlet.metadata.set("rootMath", "category", "math");

			expect(api.slothlet.metadata.get(api.rootMath.add).category).toBe("math");
			expect(api.slothlet.metadata.get(api.rootMath.multiply).category).toBe("math");
		});

		it("should set metadata via object merge", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.set("rootMath", { category: "math", version: "2.0.0" });

			const meta = api.slothlet.metadata.get(api.rootMath.add);
			expect(meta.category).toBe("math");
			expect(meta.version).toBe("2.0.0");
		});

		it("should reject prototype-pollution keys when merging object payloads in setFor", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			const pollutedConfig = Object.create(null);
			Object.defineProperty(pollutedConfig, "__proto__", {
				value: { polluted: true },
				enumerable: true,
				configurable: true,
				writable: true
			});

			expect(() =>
				api.slothlet.metadata.set("rootMath", {
					config: pollutedConfig
				})
			).toThrow(/METADATA_KEY_INVALID/);
		});

		it("should target a specific subpath without affecting siblings", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			await materialize(api, "rootMath.multiply", 5, 3);

			api.slothlet.metadata.set("rootMath.add", "specificToAdd", true);

			expect(api.slothlet.metadata.get(api.rootMath.add).specificToAdd).toBe(true);
			// multiply is at rootMath.multiply - not under rootMath.add
			expect(api.slothlet.metadata.get(api.rootMath.multiply).specificToAdd).toBeUndefined();
		});

		it("should accumulate across multiple calls and last value wins for same key", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.set("rootMath", "version", "1.0.0");
			api.slothlet.metadata.set("rootMath", "version", "2.0.0");
			api.slothlet.metadata.set("rootMath", "author", "test");

			const meta = api.slothlet.metadata.get(api.rootMath.add);
			expect(meta.version).toBe("2.0.0");
			expect(meta.author).toBe("test");
		});

		it("function-level set() should take priority over setFor() for same key", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.set("rootMath", "version", "1.0.0");
			api.slothlet.metadata.set(api.rootMath.add, "version", "3.0.0");

			// set() (moduleID-level) wins over setFor() (path-level)
			expect(api.slothlet.metadata.get(api.rootMath.add).version).toBe("3.0.0");
		});

		it("should not affect system metadata", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const systemModuleID = api.slothlet.node(api.rootMath.add).module;

			api.slothlet.metadata.set("rootMath", "moduleID", "HACKED");

			// System metadata always wins
			expect(api.slothlet.node(api.rootMath.add).module).toBe(systemModuleID);
		});
	});

	describe("api.slothlet.metadata.remove()", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST
			});
		});

		it("should remove a specific key from path-level metadata", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.set("rootMath", { category: "math", version: "1.0.0" });
			expect(api.slothlet.metadata.get(api.rootMath.add).category).toBe("math");

			api.slothlet.metadata.remove("rootMath", "category");

			expect(api.slothlet.metadata.get(api.rootMath.add).category).toBeUndefined();
			// Other keys from the same path entry should remain
			expect(api.slothlet.metadata.get(api.rootMath.add).version).toBe("1.0.0");
		});

		it("should remove all path-level metadata when no key is given", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.set("rootMath", { category: "math", version: "1.0.0" });
			api.slothlet.metadata.remove("rootMath");

			expect(api.slothlet.metadata.get(api.rootMath.add).category).toBeUndefined();
			expect(api.slothlet.metadata.get(api.rootMath.add).version).toBeUndefined();
			// System metadata should remain
			expect(api.slothlet.node(api.rootMath.add).module).toBeDefined();
		});

		it("should not affect function-level metadata set via set()", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.set("rootMath", "tag", "path");
			api.slothlet.metadata.set(api.rootMath.add, "tag", "function");

			// function-level wins
			expect(api.slothlet.metadata.get(api.rootMath.add).tag).toBe("function");

			api.slothlet.metadata.remove("rootMath", "tag");

			// function-level still present after path removal
			expect(api.slothlet.metadata.get(api.rootMath.add).tag).toBe("function");
		});

		it("should throw METADATA_KEY_INVALID when key in array is not a string", async () => {
			// Populate the path entry first so removeFor reaches the array-key loop
			api.slothlet.metadata.set("rootMath", { category: "math" });

			// Passing an array with a non-string element triggers the per-element type check
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => api.slothlet.metadata.remove("rootMath", ["category", 99])).toThrow();
			});
		});

		it("should throw METADATA_KEY_INVALID when key is a non-string, non-array value", async () => {
			// Populate the path entry first so removeFor reaches the else throw
			api.slothlet.metadata.set("rootMath", { category: "math" });

			// Passing a number as key is not undefined, not array, not string → throws
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => api.slothlet.metadata.remove("rootMath", 42)).toThrow();
			});
		});
	});

	describe("api.slothlet.metadata.get()", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST
			});
		});

		it("should return metadata set via setFor at the exact path", () => {
			api.slothlet.metadata.set("rootMath", "category", "math");
			api.slothlet.metadata.set("rootMath", "version", "2.0.0");

			const meta = api.slothlet.metadata.get("rootMath");
			expect(meta.category).toBe("math");
			expect(meta.version).toBe("2.0.0");
		});

		it("should return metadata via object merge", () => {
			api.slothlet.metadata.set("rootMath", { category: "math", author: "test" });

			const meta = api.slothlet.metadata.get("rootMath");
			expect(meta.category).toBe("math");
			expect(meta.author).toBe("test");
		});

		it("should surface ancestor metadata on descendant paths (parent → child merge)", () => {
			api.slothlet.metadata.set("rootMath", "category", "math");

			const childMeta = api.slothlet.metadata.get("rootMath.add");
			expect(childMeta.category).toBe("math");
		});

		it("should merge ancestor + child metadata, with child entries overriding for shared keys", () => {
			api.slothlet.metadata.set("rootMath", { category: "math", version: "1.0.0" });
			api.slothlet.metadata.set("rootMath.add", { version: "2.0.0", specific: true });

			const meta = api.slothlet.metadata.get("rootMath.add");
			expect(meta.category).toBe("math"); // inherited from rootMath
			expect(meta.version).toBe("2.0.0"); // overridden at rootMath.add
			expect(meta.specific).toBe(true); // set at rootMath.add
		});

		it("should return an empty object when no metadata has been set for the path", () => {
			const meta = api.slothlet.metadata.get("rootMath");
			expect(meta).toEqual({});
		});

		it("should return an empty object for a path that does not exist", () => {
			const meta = api.slothlet.metadata.get("nonexistent.path");
			expect(meta).toEqual({});
		});

		it("should not include immutable system metadata (filePath, moduleID, etc.)", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			api.slothlet.metadata.set("rootMath", "category", "math");

			const meta = api.slothlet.metadata.get("rootMath");
			expect(meta.category).toBe("math");
			expect(meta.filePath).toBeUndefined();
			expect(meta.moduleID).toBeUndefined();
			expect(meta.apiPath).toBeUndefined();
			expect(meta.taggedAt).toBeUndefined();
		});

		it("should include global user metadata in the returned object", () => {
			api.slothlet.metadata.global("env", "production");
			api.slothlet.metadata.set("rootMath", "category", "math");

			const meta = api.slothlet.metadata.get("rootMath");
			expect(meta.env).toBe("production");
			expect(meta.category).toBe("math");
		});

		it("should round-trip a full plugin-manifest-shaped payload (B1 contract)", () => {
			// Mirrors B1's resolution: helpers store the full manifest once at the
			// mount point under "_module" and rely on getFor for retrieval.
			const manifest = {
				schema: 2,
				name: "@org/test-driver",
				version: "1.0.0",
				mount: ["rootMath"],
				base: "./api",
				kind: "driver",
				priority: 100
			};

			api.slothlet.metadata.set("rootMath", "_module", { manifest });

			const meta = api.slothlet.metadata.get("rootMath");
			expect(meta._module).toBeDefined();
			expect(meta._module.manifest).toEqual(manifest);

			// Descendants inherit the manifest entry via parent → child merge
			const childMeta = api.slothlet.metadata.get("rootMath.add");
			expect(childMeta._module).toBeDefined();
			expect(childMeta._module.manifest).toEqual(manifest);
		});
	});

	describe("api.slothlet.metadata.set() - validation errors", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				base: TEST_DIRS.API_TEST
			});
		});

		it("should throw INVALID_ARGUMENT when keyOrObj is an array", async () => {
			// An array passes the `typeof keyOrObj !== "string"` check so it becomes
			// metadataObj, but Array.isArray(metadataObj) is true → throws INVALID_ARGUMENT
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => api.slothlet.metadata.set("rootMath", ["category", "math"])).toThrow();
			});
		});

		it("should throw INVALID_ARGUMENT when path is null", async () => {
			// _resolvePathOrModuleId returns null for null input; setPathMetadata
			// then throws because typeof null !== "string"
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => api.slothlet.metadata.set(null, "key", "value")).toThrow();
			});
		});

		it("should throw INVALID_ARGUMENT when path is an empty string", async () => {
			// setPathMetadata checks !apiPath — empty string is falsy → throws
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => api.slothlet.metadata.set("", "key", "value")).toThrow();
			});
		});

		it("should handle pre-frozen nested objects in metadata without error", async () => {
			// #deepFreeze short-circuits on already-frozen objects (isFrozen check)
			const frozenNested = Object.freeze({ alreadyFrozen: true });

			await api.slothlet.api.add("frozenMetaTest", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: { nested: frozenNested, normal: "value" }
			});

			await materialize(api, "frozenMetaTest.config.settings.getPluginConfig");
			const meta = api.slothlet.metadata.get(api.frozenMetaTest.config.settings.getPluginConfig);
			expect(meta.normal).toBe("value");
			expect(meta.nested.alreadyFrozen).toBe(true);
		});
	});
});
