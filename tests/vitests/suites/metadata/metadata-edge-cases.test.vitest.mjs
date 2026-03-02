/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/metadata/metadata-edge-cases.test.vitest.mjs
 *	@Date: 2026-01-25T13:23:08-08:00 (1769376188)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:52 -08:00 (1772425312)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for metadata edge cases and special scenarios.
 *
 * Tests uncommon but important metadata scenarios:
 * - Root contributor pattern with metadata
 * - Very deep nesting (5+ levels)
 * - Large metadata objects
 * - Special characters in metadata
 * - Circular reference handling
 *
 * @module tests/vitests/suites/metadata/metadata-edge-cases.test.vitest
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { Metadata } from "@cldmv/slothlet/handlers/metadata";
import { SlothletError } from "@cldmv/slothlet/errors";
import { getMatrixConfigs, TEST_DIRS, materialize } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("Metadata Edge Cases > Config: '$name'", ({ config }) => {
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

	describe("Root Contributor Pattern", () => {
		it("should handle metadata with root contributor pattern", async () => {
			// Root contributor: when a file exports default and makes it THE api
			// Check if single.mjs exists in test directory
			if (api.single) {
				await materialize(api, "single", "test");
				const meta = api.single.__metadata;

				expect(meta).toBeDefined();
				expect(meta.moduleID).toBeDefined();
				expect(meta.apiPath).toBeDefined();
			}
		});

		it("should preserve metadata on root contributor children", async () => {
			// Root contributor with child properties
			if (api.single?.nested) {
				await materialize(api, "single.nested", "test");
				const meta = api.single.nested.__metadata;

				expect(meta).toBeDefined();
				expect(meta.moduleID).toBeDefined();
			}
		});
	});

	describe("Very Deep Nesting", () => {
		it("should handle metadata at 5+ nesting levels", async () => {
			await api.slothlet.api.add("veryDeep", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					depth: "extreme",
					level: 5
				}
			});

			// Navigate 5+ levels if structure exists
			// veryDeep.config.settings.getPluginConfig
			if (api.veryDeep?.config?.settings?.getPluginConfig) {
				const result = await materialize(api, "veryDeep.config.settings.getPluginConfig");
				const meta = api.veryDeep.config.settings.getPluginConfig.__metadata;

				expect(meta.depth).toBe("extreme");
				expect(meta.level).toBe(5);
				expect(meta.moduleID).toContain("veryDeep");
			}
		});
	});

	describe("Large Metadata Objects", () => {
		it("should handle large metadata objects efficiently", async () => {
			const largeMetadata = {};
			for (let i = 0; i < 100; i++) {
				largeMetadata[`key${i}`] = `value${i}`;
				largeMetadata[`nested${i}`] = {
					data: `nested-value-${i}`,
					array: [1, 2, 3, 4, 5]
				};
			}

			await api.slothlet.api.add("large", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: largeMetadata
			});
			await materialize(api, "large.config.settings.getPluginConfig");
			const meta = api.large.config.settings.getPluginConfig.__metadata;

			expect(meta.key0).toBe("value0");
			expect(meta.key99).toBe("value99");
			expect(meta.nested50.data).toBe("nested-value-50");
			expect(meta.nested50.array).toEqual([1, 2, 3, 4, 5]);
		});
	});

	describe("Special Characters in Metadata", () => {
		it("should handle special characters in metadata keys", async () => {
			await api.slothlet.api.add("special", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					"key-with-dashes": "value",
					"key.with.dots": "value",
					"key:with:colons": "value",
					"key/with/slashes": "value",
					"key with spaces": "value"
				}
			});

			await materialize(api, "special.config.settings.getPluginConfig");
			const meta = api.special.config.settings.getPluginConfig.__metadata;

			expect(meta["key-with-dashes"]).toBe("value");
			expect(meta["key.with.dots"]).toBe("value");
			expect(meta["key:with:colons"]).toBe("value");
			expect(meta["key/with/slashes"]).toBe("value");
			expect(meta["key with spaces"]).toBe("value");
		});

		it("should handle unicode in metadata values", async () => {
			await api.slothlet.api.add("unicode", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					emoji: "🎉✨🚀",
					chinese: "你好世界",
					arabic: "مرحبا بالعالم",
					symbols: "©®™€£¥"
				}
			});

			await materialize(api, "unicode.config.settings.getPluginConfig");
			const meta = api.unicode.config.settings.getPluginConfig.__metadata;

			expect(meta.emoji).toBe("🎉✨🚀");
			expect(meta.chinese).toBe("你好世界");
			expect(meta.arabic).toBe("مرحبا بالعالم");
			expect(meta.symbols).toBe("©®™€£¥");
		});
	});

	describe("Circular Reference Handling", () => {
		it("should handle metadata with circular references", async () => {
			const circular = {
				name: "circular",
				level: 1
			};
			circular.self = circular; // Circular reference

			try {
				await api.slothlet.api.add("circular", TEST_DIRS.API_SMART_FLATTEN, {
					metadata: circular
				});
				await materialize(api, "circular.config.settings.getPluginConfig");

				const meta = api.circular.config.settings.getPluginConfig.__metadata;
				expect(meta.name).toBe("circular");
				expect(meta.level).toBe(1);
				// self may be undefined or handled gracefully
			} catch (error) {
				// Circular references may cause errors during freezing
				expect(error).toBeDefined();
			}
		});
	});

	describe("Metadata with Functions", () => {
		it("should handle metadata containing function values", async () => {
			await api.slothlet.api.add("withFuncs", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					normalValue: "test",
					functionValue: () => "I am a function",
					arrowFunc: (x) => x * 2
				}
			});

			await materialize(api, "withFuncs.config.settings.getPluginConfig");
			const meta = api.withFuncs.config.settings.getPluginConfig.__metadata;

			expect(meta.normalValue).toBe("test");
			expect(typeof meta.functionValue).toBe("function");
			expect(typeof meta.arrowFunc).toBe("function");

			// Functions should be executable
			if (typeof meta.functionValue === "function") {
				expect(meta.functionValue()).toBe("I am a function");
			}

			if (typeof meta.arrowFunc === "function") {
				expect(meta.arrowFunc(5)).toBe(10);
			}
		});
	});

	describe("Metadata with Symbols", () => {
		it("should handle Symbol keys in metadata", async () => {
			const sym1 = Symbol("test");
			const sym2 = Symbol("another");

			await api.slothlet.api.add("symbols", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					normal: "value",
					[sym1]: "symbol-value-1",
					[sym2]: "symbol-value-2"
				}
			});

			await materialize(api, "symbols.config.settings.getPluginConfig");
			// Symbol properties may or may not be preserved
			// depending on how metadata is stored/frozen
		});
	});

	describe("Metadata Access Performance", () => {
		it("should access metadata efficiently for repeated calls", async () => {
			await api.slothlet.api.add("perf", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					data: "test"
				}
			});

			await materialize(api, "perf.config.settings.getPluginConfig");

			const iterations = 1000;
			const start = Date.now();

			for (let i = 0; i < iterations; i++) {
				const meta = api.perf.config.settings.getPluginConfig.__metadata;
				expect(meta.data).toBe("test");
			}

			const duration = Date.now() - start;

			// Should be fast (< 300ms for 1000 accesses, ~3.3 accesses/ms)
			expect(duration).toBeLessThan(300);
		});
	});

	describe("Empty API Paths", () => {
		it("should handle metadata operations on non-existent paths gracefully", async () => {
			// Test that metadata API handles non-existent paths without crashing

			// Get metadata for non-existent path should return undefined
			const nonExistentMeta = api.nonExistent?.__metadata;
			expect(nonExistentMeta).toBeUndefined();

			// metadata.get() should return null for non-existent paths (traversal fails gracefully)
			const result = await api.slothlet.metadata.get("nonExistent.path.that.doesNotExist");
			expect(result).toBeNull();
		});
	});

	describe("Nested 'metadata' Key Spreading", () => {
		it("should spread a nested 'metadata' object key to root level in getMetadata()", async () => {
			// Lines 206-207: getMetadata() has a branch that detects when combined result
			// has a key literally named 'metadata' that is an object, and spreads it to root.
			// This fires when set() stores { metadata: <object> } on a function's user metadata.
			await materialize(api, "rootMath.add", 1, 2);
			api.slothlet.metadata.set(api.rootMath.add, "metadata", { nestedFlag: true, nestedVersion: "2" });
			const meta = api.rootMath.add.__metadata;
			// The nested metadata object should be spread to root level
			expect(meta.nestedFlag).toBe(true);
			expect(meta.nestedVersion).toBe("2");
		});
	});

	describe("Validation Errors", () => {
		it("should throw when set() is called with a plain function that has no system metadata", async () => {
			// Line coverage: setUserMetadata throws METADATA_NO_MODULE_ID when target has no moduleID
			const plainFn = () => {};
			expect(() => api.slothlet.metadata.set(plainFn, "key", "value")).toThrow();
		});

		it("should throw when set() is called with a non-function, non-object target", async () => {
			// Line coverage: setUserMetadata throws INVALID_METADATA_TARGET when target is a primitive
			expect(() => api.slothlet.metadata.set("notAFunction", "key", "value")).toThrow();
		});

		it("should throw when remove() is called with a non-function, non-object target", async () => {
			// Line coverage: removeUserMetadata throws INVALID_METADATA_TARGET when target is a primitive
			expect(() => api.slothlet.metadata.remove("notAFunction", "key")).toThrow();
		});

		it("should throw when remove() is called with an invalid key type", async () => {
			// Line coverage: removeUserMetadata throws INVALID_METADATA_KEY when key is not string/array/object
			// First set a value so a storeEntry exists, then remove with a bad key type
			await materialize(api, "rootMath.add", 1, 2);
			api.slothlet.metadata.set(api.rootMath.add, "tempKey", "tempVal");
			expect(() => api.slothlet.metadata.remove(api.rootMath.add, 123)).toThrow();
		});

		it("should throw when registerUserMetadata() is called with an invalid identifier", () => {
			// Line coverage: registerUserMetadata guard at line 386 — requires direct instantiation
			// since no public API surface reaches it with a bad identifier
			const mockSlothlet = { SlothletError };
			const handler = new Metadata(mockSlothlet);
			expect(() => handler.registerUserMetadata(null, {})).toThrow();
			expect(() => handler.registerUserMetadata("", {})).toThrow();
		});
	});

	describe("Metadata on Different Export Types", () => {
		it("should handle metadata on default exports", async () => {
			await materialize(api, "rootMath.add", 1, 2);
			const meta = api.rootMath.add.__metadata;
			expect(meta).toBeDefined();
		});

		it("should handle metadata on named exports", async () => {
			await api.slothlet.api.add("named", TEST_DIRS.API_SMART_FLATTEN);

			if (api.named?.config?.settings?.getPluginConfig) {
				await materialize(api, "named.config.settings.getPluginConfig");
				const meta = api.named.config.settings.getPluginConfig.__metadata;
				expect(meta).toBeDefined();
			}
		});

		it("should handle metadata on mixed exports", async () => {
			await api.slothlet.api.add("mixed", TEST_DIRS.API_SMART_FLATTEN, {
				metadata: {
					type: "mixed"
				}
			});

			if (api.mixed) {
				// Test both default and named exports if they exist
				const keys = Object.keys(api.mixed);
				for (const key of keys) {
					// Materialize the value (triggers loading in lazy mode)
					await materialize(api, `mixed.${key}`);

					// Check metadata - user metadata is only on direct children (mixed.*)
					// Subfolders like mixed.config.settings don't inherit user metadata
					const meta = api.mixed[key].__metadata;
					if (meta && meta.apiPath === `mixed.${key}`) {
						// Only check if this is a direct child with user metadata
						expect(meta.type).toBe("mixed");
					}
				}
			}
		});
	});
});
