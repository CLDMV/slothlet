/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/metadata/metadata-external-api.test.vitest.mjs
 *	@Date: 2026-01-25T14:50:54-08:00 (1769381454)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-21 21:28:14 -08:00 (1771738094)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for external metadata API (set/remove/setGlobal).
 *
 * Tests the public API for manipulating metadata from OUTSIDE API context:
 * - api.slothlet.metadata.set(fn, key, value) - Set metadata on specific function
 * - api.slothlet.metadata.remove(fn, key?) - Remove metadata from function
 * - api.slothlet.metadata.setGlobal(key, value) - Set global metadata
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
				dir: TEST_DIRS.API_TEST
			});
		});

		it("should set user metadata on a function", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Set metadata via external API
			api.slothlet.metadata.set(api.rootMath.add, "category", "math");
			api.slothlet.metadata.set(api.rootMath.add, "version", "2.0.0");

			// Verify metadata was set
			const meta = api.rootMath.add.__metadata;
			expect(meta).toBeDefined();
			expect(meta.category).toBe("math");
			expect(meta.version).toBe("2.0.0");

			// System metadata should still be present
			expect(meta.moduleID).toBeDefined();
			expect(meta.filePath).toBeDefined();
		});

		it("should override existing user metadata keys", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Set initial metadata
			api.slothlet.metadata.set(api.rootMath.add, "version", "1.0.0");
			expect(api.rootMath.add.__metadata.version).toBe("1.0.0");

			// Override with new value
			api.slothlet.metadata.set(api.rootMath.add, "version", "2.0.0");
			expect(api.rootMath.add.__metadata.version).toBe("2.0.0");
		});

		it("should NOT override system metadata", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			const originalModuleID = api.rootMath.add.__metadata.moduleID;
			const originalFilePath = api.rootMath.add.__metadata.filePath;

			// Attempt to override system metadata (should fail or be ignored)
			api.slothlet.metadata.set(api.rootMath.add, "moduleID", "fake-id");
			api.slothlet.metadata.set(api.rootMath.add, "filePath", "fake-path");

			// System metadata should remain unchanged
			expect(api.rootMath.add.__metadata.moduleID).toBe(originalModuleID);
			expect(api.rootMath.add.__metadata.filePath).toBe(originalFilePath);
		});

		it("should work with nested functions", async () => {
			await materialize(api, "nested.date.today");

			api.slothlet.metadata.set(api.nested.date.today, "plugin", "test-plugin");
			api.slothlet.metadata.set(api.nested.date.today, "enabled", true);

			const meta = api.nested.date.today.__metadata;
			expect(meta.plugin).toBe("test-plugin");
			expect(meta.enabled).toBe(true);
		});

		it("should handle multiple functions independently", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			await materialize(api, "rootMath.multiply", 5, 3);

			api.slothlet.metadata.set(api.rootMath.add, "operation", "addition");
			api.slothlet.metadata.set(api.rootMath.multiply, "operation", "multiplication");

			expect(api.rootMath.add.__metadata.operation).toBe("addition");
			expect(api.rootMath.multiply.__metadata.operation).toBe("multiplication");
		});

		it("should persist metadata across function calls", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.set(api.rootMath.add, "callCount", 0);

			// Call function multiple times
			await materialize(api, "rootMath.add", 1, 2);
			await materialize(api, "rootMath.add", 3, 4);
			await materialize(api, "rootMath.add", 5, 6);

			// Metadata should persist
			expect(api.rootMath.add.__metadata.callCount).toBe(0);
		});
	});

	describe("api.slothlet.metadata.remove()", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST
			});
		});

		it("should remove specific user metadata key", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Set metadata
			api.slothlet.metadata.set(api.rootMath.add, "version", "1.0.0");
			api.slothlet.metadata.set(api.rootMath.add, "category", "math");

			expect(api.rootMath.add.__metadata.version).toBe("1.0.0");
			expect(api.rootMath.add.__metadata.category).toBe("math");

			// Remove one key
			api.slothlet.metadata.remove(api.rootMath.add, "version");

			// Only removed key should be gone
			expect(api.rootMath.add.__metadata.version).toBeUndefined();
			expect(api.rootMath.add.__metadata.category).toBe("math");

			// System metadata should remain
			expect(api.rootMath.add.__metadata.moduleID).toBeDefined();
		});

		it("should remove all user metadata when no key specified", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Set multiple metadata keys
			api.slothlet.metadata.set(api.rootMath.add, "version", "1.0.0");
			api.slothlet.metadata.set(api.rootMath.add, "category", "math");
			api.slothlet.metadata.set(api.rootMath.add, "author", "test");

			const originalModuleID = api.rootMath.add.__metadata.moduleID;

			// Remove all user metadata
			api.slothlet.metadata.remove(api.rootMath.add);

			// All user metadata should be removed
			expect(api.rootMath.add.__metadata.version).toBeUndefined();
			expect(api.rootMath.add.__metadata.category).toBeUndefined();
			expect(api.rootMath.add.__metadata.author).toBeUndefined();

			// System metadata should remain
			expect(api.rootMath.add.__metadata.moduleID).toBe(originalModuleID);
		});

		it("should NOT remove system metadata", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			const meta = api.rootMath.add.__metadata;
			const originalModuleID = meta.moduleID;
			const originalFilePath = meta.filePath;
			const originalApiPath = meta.apiPath;

			// Attempt to remove system metadata (should fail or be ignored)
			api.slothlet.metadata.remove(api.rootMath.add, "moduleID");
			api.slothlet.metadata.remove(api.rootMath.add, "filePath");
			api.slothlet.metadata.remove(api.rootMath.add, "apiPath");

			// System metadata should remain
			expect(api.rootMath.add.__metadata.moduleID).toBe(originalModuleID);
			expect(api.rootMath.add.__metadata.filePath).toBe(originalFilePath);
			expect(api.rootMath.add.__metadata.apiPath).toBe(originalApiPath);
		});

		it("should handle removing non-existent keys gracefully", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Try to remove key that doesn't exist
			expect(() => {
				api.slothlet.metadata.remove(api.rootMath.add, "nonexistent");
			}).not.toThrow();

			// Metadata should still exist
			expect(api.rootMath.add.__metadata).toBeDefined();
		});

		it("should remove multiple keys with array parameter", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			// Set multiple metadata keys
			api.slothlet.metadata.set(api.rootMath.add, "version", "1.0.0");
			api.slothlet.metadata.set(api.rootMath.add, "category", "math");
			api.slothlet.metadata.set(api.rootMath.add, "author", "test");
			api.slothlet.metadata.set(api.rootMath.add, "status", "stable");

			expect(api.rootMath.add.__metadata.version).toBe("1.0.0");
			expect(api.rootMath.add.__metadata.category).toBe("math");
			expect(api.rootMath.add.__metadata.author).toBe("test");
			expect(api.rootMath.add.__metadata.status).toBe("stable");

			// Remove multiple keys at once
			api.slothlet.metadata.remove(api.rootMath.add, ["version", "author"]);

			// Removed keys should be gone
			expect(api.rootMath.add.__metadata.version).toBeUndefined();
			expect(api.rootMath.add.__metadata.author).toBeUndefined();

			// Non-removed keys should remain
			expect(api.rootMath.add.__metadata.category).toBe("math");
			expect(api.rootMath.add.__metadata.status).toBe("stable");

			// System metadata should remain
			expect(api.rootMath.add.__metadata.moduleID).toBeDefined();
		});

		it("should throw error for non-string elements in array parameter", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.set(api.rootMath.add, "version", "1.0.0");

			// Try to remove with non-string array element
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => {
					api.slothlet.metadata.remove(api.rootMath.add, ["version", 123]);
				}).toThrow(/INVALID_METADATA_KEY/);
				expect(() => {
					api.slothlet.metadata.remove(api.rootMath.add, ["version", null]);
				}).toThrow(/INVALID_METADATA_KEY/);
				expect(() => {
					api.slothlet.metadata.remove(api.rootMath.add, ["version", undefined]);
				}).toThrow(/INVALID_METADATA_KEY/);
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
			expect(api.rootMath.add.__metadata.config.timeout).toBeUndefined();
			expect(api.rootMath.add.__metadata.config.debug).toBeUndefined();
			expect(api.rootMath.add.__metadata.stats.errors).toBeUndefined();

			// Non-removed nested keys should remain
			expect(api.rootMath.add.__metadata.config.retries).toBe(3);
			expect(api.rootMath.add.__metadata.config.cache).toBe(true);
			expect(api.rootMath.add.__metadata.stats.calls).toBe(100);
			expect(api.rootMath.add.__metadata.stats.avgTime).toBe(50);

			// System metadata should remain
			expect(api.rootMath.add.__metadata.moduleID).toBeDefined();
		});

		it("should throw error for non-array values in object parameter", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.set(api.rootMath.add, "config", { timeout: 5000 });

			// Try to remove with non-array object value
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => {
					api.slothlet.metadata.remove(api.rootMath.add, { config: "timeout" });
				}).toThrow(/INVALID_METADATA_KEY/);
				expect(() => {
					api.slothlet.metadata.remove(api.rootMath.add, { config: 123 });
				}).toThrow(/INVALID_METADATA_KEY/);
			});
		});

		it("should throw error for non-string nested keys in object parameter", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.set(api.rootMath.add, "config", { timeout: 5000 });

			// Try to remove with non-string nested key
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => {
					api.slothlet.metadata.remove(api.rootMath.add, { config: ["timeout", 123] });
				}).toThrow(/INVALID_METADATA_KEY/);
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
			expect(api.rootMath.add.__metadata.version).toBe("1.0.0");
		});
	});

	describe("api.slothlet.metadata.setGlobal()", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST
			});
		});

		it("should set global metadata visible to all functions", async () => {
			// Set global metadata
			api.slothlet.metadata.setGlobal("appVersion", "3.0.0");
			api.slothlet.metadata.setGlobal("environment", "test");

			// Materialize multiple functions
			await materialize(api, "rootMath.add", 1, 2);
			await materialize(api, "rootMath.multiply", 5, 3);

			// Global metadata should be in both
			expect(api.rootMath.add.__metadata.appVersion).toBe("3.0.0");
			expect(api.rootMath.add.__metadata.environment).toBe("test");
			expect(api.rootMath.multiply.__metadata.appVersion).toBe("3.0.0");
			expect(api.rootMath.multiply.__metadata.environment).toBe("test");
		});

		it("should override global metadata on specific function", async () => {
			// Set global metadata
			api.slothlet.metadata.setGlobal("version", "1.0.0");

			await materialize(api, "rootMath.add", 1, 2);
			await materialize(api, "rootMath.multiply", 5, 3);

			// Override on specific function
			api.slothlet.metadata.set(api.rootMath.add, "version", "2.0.0");

			// One function has override, other has global
			expect(api.rootMath.add.__metadata.version).toBe("2.0.0");
			expect(api.rootMath.multiply.__metadata.version).toBe("1.0.0");
		});

		it("should apply global metadata to newly added functions", async () => {
			// Set global metadata first
			api.slothlet.metadata.setGlobal("defaultCategory", "utility");

			// Add new API
			await api.slothlet.api.add("testFunc", TEST_DIRS.API_SMART_FLATTEN);

			// Materialize function from newly added API
			await materialize(api, "testFunc.config.settings.getPluginConfig");

			// Should have global metadata
			expect(api.testFunc.config.settings.getPluginConfig.__metadata.defaultCategory).toBe("utility");
		});

		it("should handle multiple global metadata updates", async () => {
			api.slothlet.metadata.setGlobal("counter", 1);

			await materialize(api, "rootMath.add", 1, 2);
			expect(api.rootMath.add.__metadata.counter).toBe(1);

			// Update global metadata
			api.slothlet.metadata.setGlobal("counter", 2);

			// Newly materialized functions should get updated value
			await materialize(api, "rootMath.multiply", 5, 3);
			expect(api.rootMath.multiply.__metadata.counter).toBe(2);

			// Already materialized function gets updated value too (global metadata is LIVE)
			expect(api.rootMath.add.__metadata.counter).toBe(2);
		});
	});

	describe("Combined External API Operations", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST
			});
		});

		it("should handle set/remove/setGlobal in combination", async () => {
			// Set global metadata
			api.slothlet.metadata.setGlobal("appName", "TestApp");
			api.slothlet.metadata.setGlobal("version", "1.0.0");

			await materialize(api, "rootMath.add", 1, 2);

			// Should have global metadata
			expect(api.rootMath.add.__metadata.appName).toBe("TestApp");
			expect(api.rootMath.add.__metadata.version).toBe("1.0.0");

			// Set function-specific metadata
			api.slothlet.metadata.set(api.rootMath.add, "version", "2.0.0");
			api.slothlet.metadata.set(api.rootMath.add, "custom", "value");

			expect(api.rootMath.add.__metadata.appName).toBe("TestApp"); // Global
			expect(api.rootMath.add.__metadata.version).toBe("2.0.0"); // Override
			expect(api.rootMath.add.__metadata.custom).toBe("value"); // Specific

			// Remove function-specific metadata
			api.slothlet.metadata.remove(api.rootMath.add, "custom");

			expect(api.rootMath.add.__metadata.custom).toBeUndefined();
			expect(api.rootMath.add.__metadata.appName).toBe("TestApp"); // Still present
			expect(api.rootMath.add.__metadata.version).toBe("2.0.0"); // Still present
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
			expect(api.rootMath.add.__metadata.tag).toBe("add");
			expect(api.rootMath.multiply.__metadata.tag).toBe("multiply");
			expect(api.nested.date.today.__metadata.tag).toBe("date");

			// Removing one shouldn't affect others
			api.slothlet.metadata.remove(api.rootMath.add, "tag");

			expect(api.rootMath.add.__metadata.tag).toBeUndefined();
			expect(api.rootMath.multiply.__metadata.tag).toBe("multiply");
			expect(api.nested.date.today.__metadata.tag).toBe("date");
		});
	});

	describe("api.slothlet.metadata.setFor()", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST
			});
		});

		it("should set metadata on all functions under an API path (single key)", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			await materialize(api, "rootMath.multiply", 5, 3);

			api.slothlet.metadata.setFor("rootMath", "category", "math");

			expect(api.rootMath.add.__metadata.category).toBe("math");
			expect(api.rootMath.multiply.__metadata.category).toBe("math");
		});

		it("should set metadata via object merge", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.setFor("rootMath", { category: "math", version: "2.0.0" });

			const meta = api.rootMath.add.__metadata;
			expect(meta.category).toBe("math");
			expect(meta.version).toBe("2.0.0");
		});

		it("should target a specific subpath without affecting siblings", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			await materialize(api, "rootMath.multiply", 5, 3);

			api.slothlet.metadata.setFor("rootMath.add", "specificToAdd", true);

			expect(api.rootMath.add.__metadata.specificToAdd).toBe(true);
			// multiply is at rootMath.multiply - not under rootMath.add
			expect(api.rootMath.multiply.__metadata.specificToAdd).toBeUndefined();
		});

		it("should accumulate across multiple calls and last value wins for same key", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.setFor("rootMath", "version", "1.0.0");
			api.slothlet.metadata.setFor("rootMath", "version", "2.0.0");
			api.slothlet.metadata.setFor("rootMath", "author", "test");

			const meta = api.rootMath.add.__metadata;
			expect(meta.version).toBe("2.0.0");
			expect(meta.author).toBe("test");
		});

		it("function-level set() should take priority over setFor() for same key", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.setFor("rootMath", "version", "1.0.0");
			api.slothlet.metadata.set(api.rootMath.add, "version", "3.0.0");

			// set() (moduleID-level) wins over setFor() (path-level)
			expect(api.rootMath.add.__metadata.version).toBe("3.0.0");
		});

		it("should not affect system metadata", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const systemModuleID = api.rootMath.add.__metadata.moduleID;

			api.slothlet.metadata.setFor("rootMath", "moduleID", "HACKED");

			// System metadata always wins
			expect(api.rootMath.add.__metadata.moduleID).toBe(systemModuleID);
		});
	});

	describe("api.slothlet.metadata.removeFor()", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST
			});
		});

		it("should remove a specific key from path-level metadata", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.setFor("rootMath", { category: "math", version: "1.0.0" });
			expect(api.rootMath.add.__metadata.category).toBe("math");

			api.slothlet.metadata.removeFor("rootMath", "category");

			expect(api.rootMath.add.__metadata.category).toBeUndefined();
			// Other keys from the same path entry should remain
			expect(api.rootMath.add.__metadata.version).toBe("1.0.0");
		});

		it("should remove all path-level metadata when no key is given", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.setFor("rootMath", { category: "math", version: "1.0.0" });
			api.slothlet.metadata.removeFor("rootMath");

			expect(api.rootMath.add.__metadata.category).toBeUndefined();
			expect(api.rootMath.add.__metadata.version).toBeUndefined();
			// System metadata should remain
			expect(api.rootMath.add.__metadata.moduleID).toBeDefined();
		});

		it("should not affect function-level metadata set via set()", async () => {
			await materialize(api, "rootMath.add", 1, 2);

			api.slothlet.metadata.setFor("rootMath", "tag", "path");
			api.slothlet.metadata.set(api.rootMath.add, "tag", "function");

			// function-level wins
			expect(api.rootMath.add.__metadata.tag).toBe("function");

			api.slothlet.metadata.removeFor("rootMath", "tag");

			// function-level still present after path removal
			expect(api.rootMath.add.__metadata.tag).toBe("function");
		});

		it("should throw INVALID_METADATA_KEY when key in array is not a string", async () => {
			// Populate the path entry first so removeFor reaches the array-key loop
			api.slothlet.metadata.setFor("rootMath", { category: "math" });

			// Passing an array with a non-string element triggers the per-element type check
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() =>
					api.slothlet.metadata.removeFor("rootMath", ["category", 99])
				).toThrow();
			});
		});

		it("should throw INVALID_METADATA_KEY when key is a non-string, non-array value", async () => {
			// Populate the path entry first so removeFor reaches the else throw
			api.slothlet.metadata.setFor("rootMath", { category: "math" });

			// Passing a number as key is not undefined, not array, not string → throws
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() =>
					api.slothlet.metadata.removeFor("rootMath", 42)
				).toThrow();
			});
		});
	});

	describe("api.slothlet.metadata.setFor() - validation errors", () => {
		beforeEach(async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST
			});
		});

		it("should throw INVALID_ARGUMENT when keyOrObj is an array", async () => {
			// An array passes the `typeof keyOrObj !== "string"` check so it becomes
			// metadataObj, but Array.isArray(metadataObj) is true → throws INVALID_ARGUMENT
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() =>
					api.slothlet.metadata.setFor("rootMath", ["category", "math"])
				).toThrow();
			});
		});

		it("should throw INVALID_ARGUMENT when path is null", async () => {
			// _resolvePathOrModuleId returns null for null input; setPathMetadata
			// then throws because typeof null !== "string"
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() =>
					api.slothlet.metadata.setFor(null, "key", "value")
				).toThrow();
			});
		});

		it("should throw INVALID_ARGUMENT when path is an empty string", async () => {
			// setPathMetadata checks !apiPath — empty string is falsy → throws
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() =>
					api.slothlet.metadata.setFor("", "key", "value")
				).toThrow();
			});
		});

		it("should handle pre-frozen nested objects in metadata without error", async () => {
			// #deepFreeze short-circuits on already-frozen objects (isFrozen check)
			const frozenNested = Object.freeze({ alreadyFrozen: true });

			await api.slothlet.api.add("frozenMetaTest", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: { nested: frozenNested, normal: "value" }
			});

			await materialize(api, "frozenMetaTest.config.settings.getPluginConfig");
			const meta = api.frozenMetaTest.config.settings.getPluginConfig.__metadata;
			expect(meta.normal).toBe("value");
			expect(meta.nested.alreadyFrozen).toBe(true);
		});
	});
});
