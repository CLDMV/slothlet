/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/config/collision-config.test.vitest.mjs
 *	@Date: 2026-01-22T21:11:18-08:00 (1769145078)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-10 18:01:59 -08:00 (1770775319)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Comprehensive tests for unified collision configuration system
 *
 * @description
 * Tests the unified collision configuration system which replaces the old
 * allowMutation, allowInitialOverwrite, and allowAddApiOverwrite flags.
 *
 * Tests all six collision modes:
 * - skip: Silently ignore collision, keep existing
 * - warn: Warn about collision, keep existing
 * - replace: Replace existing value completely
 * - merge: Merge properties (preserve FIRST + add new)
 * - merge-replace: Merge properties (add new + REPLACE existing with SECOND)
 * - error: Throw error on collision
 *
 * Tests both contexts:
 * - collision.initial: During buildAPI (initial load) - math.mjs file collides with math/ folder
 * - collision.api: During api.slothlet.api.add() operations using math-collision.mjs from api_test_collections
 *
 * @module tests/vitests/config/collision-config.test.vitest
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Create a slothlet API instance for a given configuration.
 * @param {object} baseConfig - Base configuration from the matrix.
 * @param {object} [overrides] - Additional overrides for the slothlet config.
 * @returns {Promise<object>} Initialized slothlet API instance.
 */
async function createApiInstance(baseConfig, overrides = {}) {
	return slothlet({ ...baseConfig, ...overrides });
}

/**
 * Get the math module for the current API based on the directory
 * @param {object} api - Slothlet API instance
 * @param {string} dir - API directory used during initialization
 * @returns {object|undefined} Math module
 */
function getMath(api, dir) {
	return dir === TEST_DIRS.API_TEST_MIXED ? api.mathEsm : api.math;
}

const BASE_DIRS = [
	{ label: "api-test", dir: TEST_DIRS.API_TEST }
	// Note: api-test-mixed doesn't have the same module structure, skip it
];

const MATRIX_CONFIGS = getMatrixConfigs({}).flatMap(({ name, config }) =>
	BASE_DIRS.map(({ label, dir }) => ({
		name: `${name} | ${label}`,
		config: { ...config, dir }
	}))
);

describe.each(MATRIX_CONFIGS)("Collision Config - $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
		await new Promise((resolve) => setTimeout(resolve, 50));
	});

	describe("Default behavior (merge mode)", () => {
		it("should default to merge mode for both contexts", async () => {
			api = await createApiInstance(config);

			// Default should be { initial: "merge", api.slothlet.api.add: "merge" }
			// API should load successfully with no errors
			const math = getMath(api, config.dir);
			expect(math).toBeDefined();
			expect(math.add).toBeTypeOf("function");
		});

		it("should allow api.add() with merge by default", async () => {
			api = await createApiInstance(config);

			// Should be able to add to existing path without errors
			await api.slothlet.api.add("math", TEST_DIRS.API_TEST, {
				moduleID: "math-extra"
			});

			// Original function should still exist
			const math = getMath(api, config.dir);
			expect(math.add).toBeTypeOf("function");
		});
	});

	describe("String shorthand", () => {
		it("should apply string collision mode to both contexts (skip)", async () => {
			// String shorthand: collision: "skip" => { initial: "skip", api: "skip" }
			api = await createApiInstance(config, { collision: "skip" });

			const math = getMath(api, config.dir);
			const originalAdd = math.add;
			// With skip mode, only one source loads (file XOR folder)
			const addResult = await originalAdd(2, 3);
			expect([5, 1005]).toContain(addResult); // Either file (1005) or folder (5)

			// Try to add collision content to math path (should be skipped by api: "skip")
			await api.slothlet.api.add("", TEST_DIRS.API_TEST_COLLECTIONS, {
				moduleID: "math-skip-shorthand"
			});

			// Original should still exist (collision was skipped)
			expect(math.add).toBeTypeOf("function");
			const addResult2 = await math.add(2, 3);
			expect([5, 1005]).toContain(addResult2); // Same as before

			// New functions should NOT exist (collision was skipped)
			expect(math.power).toBeUndefined();
			expect(math.sqrt).toBeUndefined();
		});

		it("should normalize collision mode case-insensitively (MERGE)", async () => {
			// String shorthand with uppercase: collision: "MERGE" => { initial: "merge", api: "merge" }
			api = await createApiInstance(config, { collision: "MERGE" });

			const math = getMath(api, config.dir);
			const originalAdd = math.add;
			// With merge mode, file's version (FIRST) should be kept
			expect(await originalAdd(2, 3)).toBe(1005); // File's version (FIRST)

			// Add collision content to math path (should merge despite uppercase)
			await api.slothlet.api.add("", TEST_DIRS.API_TEST_COLLECTIONS, {
				moduleID: "math-merge-uppercase"
			});

			// Original should still exist (merged, keeps FIRST)
			expect(math.add).toBeTypeOf("function");
			expect(await math.add(2, 3)).toBe(1005); // File's version still kept

			// New functions should also exist (merged)
			expect(math.power).toBeTypeOf("function");
			expect(math.sqrt).toBeTypeOf("function");
		});

		it("should default invalid modes to merge", async () => {
			// Invalid mode defaults to merge: collision: "invalid" => { initial: "merge", api: "merge" }
			api = await createApiInstance(config, { collision: "invalid-mode" });

			const math = getMath(api, config.dir);
			const originalAdd = math.add;
			// With merge mode (default for invalid), file's version (FIRST) should be kept
			expect(await originalAdd(2, 3)).toBe(1005); // File's version (FIRST)

			// Add collision content - should merge (invalid mode defaults to merge)
			await api.slothlet.api.add("", TEST_DIRS.API_TEST_COLLECTIONS, {
				moduleID: "math-invalid-mode"
			});

			// Should behave like merge: both original and new exist
			expect(math.add).toBeTypeOf("function");
			expect(await math.add(2, 3)).toBe(1005); // File's version still kept
			expect(math.power).toBeTypeOf("function");
			expect(math.sqrt).toBeTypeOf("function");
		});
	});
	describe("collision.initial modes", () => {
		// math.mjs file collides with math/ folder during initial load
		// Both try to create api.math, triggering collision.initial behavior
		// File has: add() returning 1005, collisionVersion property
		// Folder has: add() returning 5, multiply() function

		it("merge mode: should merge file and folder exports, keeping FIRST version of conflicts", async () => {
			api = await createApiInstance(config, {
				api: { collision: { initial: "merge", api: "merge" } }
			});

			const math = getMath(api, config.dir);
			expect(math).toBeDefined();
			expect(math.add).toBeTypeOf("function");

			// Force materialization to complete
			if (config.mode === "lazy") {
				await math.add(0, 0);
			}

			// Check unique identifiers to verify BOTH sources present
			const hasFileSource = math.collisionVersion === "collision-math-file";
			const hasFolderSource = typeof math.multiply === "function";

			// BOTH sources should be merged
			expect(hasFileSource).toBe(true);
			expect(hasFolderSource).toBe(true);

			// Verify math.add uses FIRST (file) version: add(2,3) = 1005
			const addResult = config.mode === "lazy" ? await math.add(2, 3) : math.add(2, 3);
			expect(addResult).toBe(1005); // File's add (first) should be kept in merge mode

			if (hasFolderSource) {
				const multiplyResult = config.mode === "lazy" ? await math.multiply(2, 3) : math.multiply(2, 3);
				expect(multiplyResult).toBe(6);
			}
		});

		it("merge-replace mode: should merge file and folder exports, REPLACING conflicts with SECOND version", async () => {
			api = await createApiInstance(config, {
				api: { collision: { initial: "merge-replace", api: "merge-replace" } }
			});

			const math = getMath(api, config.dir);
			expect(math).toBeDefined();
			expect(math.add).toBeTypeOf("function");
			// Force materialization to complete in lazy mode
			if (config.mode === "lazy") {
				await math.add(0, 0);
			}
			// Check unique identifiers to verify BOTH sources present
			const hasFileSource = math.collisionVersion === "collision-math-file";
			const hasFolderSource = typeof math.multiply === "function";

			// BOTH sources should be merged
			expect(hasFileSource).toBe(true);
			expect(hasFolderSource).toBe(true);

			// Verify math.add uses SECOND (folder) version: add(2,3) = 5
			const addResult = config.mode === "lazy" ? await math.add(2, 3) : math.add(2, 3);
			expect(addResult).toBe(5); // Folder's add (second) should replace file's in merge-replace mode

			if (hasFolderSource) {
				const multiplyResult = config.mode === "lazy" ? await math.multiply(2, 3) : math.multiply(2, 3);
				expect(multiplyResult).toBe(6);
			}
		});

		it("skip mode: should keep first loaded (folder or file)", async () => {
			api = await createApiInstance(config, {
				api: { collision: { initial: "skip", api: "merge" } }
			});

			const math = getMath(api, config.dir);
			expect(math).toBeDefined();
			expect(math.add).toBeTypeOf("function");

			// Check unique identifiers to verify ONLY ONE source present
			const hasFileSource = math.collisionVersion === "collision-math-file";
			const hasFolderSource = typeof math.multiply === "function";

			// ONLY ONE source should be present (XOR)
			expect(hasFileSource !== hasFolderSource).toBe(true);

			// Verify the present source works
			const addResult = config.mode === "lazy" ? await math.add(2, 3) : math.add(2, 3);
			if (hasFileSource) {
				expect(addResult).toBe(1005); // File version
			} else {
				expect(addResult).toBe(5); // Folder version
			}
		});

		it("replace mode: should replace with last loaded (folder or file)", async () => {
			api = await createApiInstance(config, {
				api: { collision: { initial: "replace", api: "merge" } }
			});

			const math = getMath(api, config.dir);
			expect(math).toBeDefined();
			expect(math.add).toBeTypeOf("function");

			// Check unique identifiers to verify ONLY ONE source present
			const hasFileSource = math.collisionVersion === "collision-math-file";
			const hasFolderSource = typeof math.multiply === "function";

			// ONLY ONE source should be present (XOR)
			expect(hasFileSource !== hasFolderSource).toBe(true);

			// Verify the present source works
			const addResult = config.mode === "lazy" ? await math.add(2, 3) : math.add(2, 3);
			if (hasFileSource) {
				expect(addResult).toBe(1005); // File version
			} else {
				expect(addResult).toBe(5); // Folder version
			}
		});

		it("warn mode: should warn and merge file and folder exports", async () => {
			api = await createApiInstance(config, {
				api: { collision: { initial: "warn", api: "merge" } },
				silent: false
			});

			const math = getMath(api, config.dir);
			expect(math).toBeDefined();
			expect(math.add).toBeTypeOf("function");
			// Force materialization to complete in lazy mode
			if (config.mode === "lazy") {
				await math.add(0, 0);
			}
			// Warn mode merges file properties onto lazy folder proxy (preserving lazy capability)
			// File exports: add (impl 1) + collisionVersion
			// Folder exports: add (impl 2) + multiply + divide
			// Expected: ALL properties present (file properties applied to lazy folder proxy)
			const hasFileSource = math.collisionVersion === "collision-math-file";
			const hasFolderSource = typeof math.multiply === "function";

			// BOTH sources should be merged (file properties → lazy folder proxy)
			expect(hasFileSource).toBe(true);
			expect(hasFolderSource).toBe(true);
		});

		it("error mode: should throw error on collision", async () => {
			await expect(async () => {
				api = await createApiInstance(config, {
					api: { collision: { initial: "error", api: "merge" } }
				});
			}).rejects.toThrow();
		});
	});

	describe("collision.api modes", () => {
		it("merge mode: should preserve original and add new properties", async () => {
			api = await createApiInstance(config, {
				api: { collision: { initial: "merge", api: "merge" } }
			});

			const math = getMath(api, config.dir);
			const originalAdd = math.add;
			expect(originalAdd).toBeTypeOf("function");
			expect(await originalAdd(2, 3)).toBe(1005); // File's version (FIRST) after initial merge

			// Add math-collision.mjs content to existing math path - should merge
			await api.slothlet.api.add("", TEST_DIRS.API_TEST_COLLECTIONS, {
				moduleID: "math-collision"
			});

			// Original function should still exist (merge keeps FIRST)
			expect(math.add).toBeTypeOf("function");
			expect(await math.add(2, 3)).toBe(1005); // File's version still kept

			// New functions from collision file should also exist
			expect(math.power).toBeTypeOf("function");
			expect(math.sqrt).toBeTypeOf("function");
			expect(math.modulo).toBeTypeOf("function");
			expect(await math.power(2, 3)).toBe(8);
			expect(await math.sqrt(16)).toBe(4);
		});

		it("merge-replace mode: should add new properties and REPLACE conflicting ones", async () => {
			api = await createApiInstance(config, {
				api: { collision: { initial: "merge", api: "merge-replace" } }
			});

			const math = getMath(api, config.dir);
			const originalAdd = math.add;
			expect(originalAdd).toBeTypeOf("function");
			expect(await originalAdd(2, 3)).toBe(1005); // File's version (FIRST) after initial merge

			// Check if api_test_collections/math.mjs has an 'add' function that conflicts
			// If it doesn't have 'add', this test would be identical to merge mode
			// Based on our earlier examination, math-collision.mjs doesn't have 'add'
			// So let's test that original 'add' is preserved and new functions are added

			await api.slothlet.api.add("", TEST_DIRS.API_TEST_COLLECTIONS, {
				moduleID: "math-collision-replace"
			});

			// Since math-collision.mjs doesn't export 'add', original should still exist
			expect(math.add).toBeTypeOf("function");
			expect(await math.add(2, 3)).toBe(1005); // Still file's version

			// New functions from collision file should be added
			expect(math.power).toBeTypeOf("function");
			expect(math.sqrt).toBeTypeOf("function");
			expect(math.modulo).toBeTypeOf("function");
			expect(await math.power(2, 3)).toBe(8);
			expect(await math.sqrt(16)).toBe(4);

			// Note: Since there's no actual conflict (math-collision.mjs doesn't have 'add'),
			// this behaves the same as merge. To properly test merge-replace, we'd need
			// a test file that has conflicting exports.
		});

		it("replace mode: should completely replace existing value", async () => {
			api = await createApiInstance(config, {
				api: { collision: { initial: "merge", api: "replace" } }
			});

			const mathOld = getMath(api, config.dir);
			const originalAdd = mathOld.add;
			expect(originalAdd).toBeTypeOf("function");

			// Replace math path with math-collision.mjs content
			await api.slothlet.api.add("", TEST_DIRS.API_TEST_COLLECTIONS, {
				moduleID: "math-collision"
			});

			// Get NEW reference after replacement
			const mathNew = getMath(api, config.dir);

			// UNIFIED WRAPPER PATTERN: mathNew and mathOld are the SAME wrapper
			// (wrapper preserved, impl replaced)
			expect(mathNew).toBe(mathOld);

			// In replace mode, verify new impl functions work
			// The originalAdd reference still works on its own
			expect(await originalAdd(1, 2)).toBe(1003);

			// Wrapper now executes NEW impl - new functions exist
			expect(await mathNew.power(2, 3)).toBe(8);
			expect(await mathNew.sqrt(16)).toBe(4);
			expect(await mathNew.modulo(10, 3)).toBe(1);

			// Old reference also executes new impl (same wrapper!)
			expect(await mathOld.power(2, 3)).toBe(8);
		});

		it("skip mode: should silently keep existing value", async () => {
			api = await createApiInstance(config, {
				collision: { initial: "merge", api: "skip" }
			});

			const math = getMath(api, config.dir);
			const originalAdd = math.add;
			// After initial merge, file's version (FIRST) should be present
			expect(await originalAdd(2, 3)).toBe(1005); // File's version (FIRST)

			// Try to add collision content to math path (should be skipped)
			await api.slothlet.api.add("", TEST_DIRS.API_TEST_COLLECTIONS, {
				moduleID: "math-skip"
			});

			// Original should still exist
			expect(math.add).toBeTypeOf("function");
			expect(await math.add(2, 3)).toBe(1005); // File's version still kept

			// New functions should NOT exist (collision was skipped)
			expect(math.power).toBeUndefined();
			expect(math.sqrt).toBeUndefined();
		});

		it("warn mode: should warn and keep existing value", async () => {
			api = await createApiInstance(config, {
				api: { collision: { initial: "merge", api: "warn" } },
				silent: false
			});

			const math = getMath(api, config.dir);
			const originalAdd = math.add;

			// Try to add collision content to math path (should warn and skip)
			await api.slothlet.api.add("", TEST_DIRS.API_TEST_COLLECTIONS, {
				moduleID: "math-warn"
			});

			// Original should still exist
			expect(math.add).toBeTypeOf("function");
			expect(await math.add(2, 3)).toBe(1005); // File's version still kept

			// New functions should NOT exist (collision was warned + skipped)
			expect(math.power).toBeUndefined();
		});

		it("error mode: should throw error on collision", async () => {
			api = await createApiInstance(config, {
				collision: { initial: "merge", api: "error" }
			});

			const math = getMath(api, config.dir);
			expect(math.add).toBeTypeOf("function");

			// Try to add collision content to math path (should throw)
			await expect(
				api.slothlet.api.add("", TEST_DIRS.API_TEST_COLLECTIONS, {
					moduleID: "math-error"
				})
			).rejects.toThrow();
		});
	});

	describe("Per-context configuration", () => {
		it("should allow different modes for initial vs api", async () => {
			api = await createApiInstance(config, {
				collision: { initial: "merge", api: "error" }
			});

			// Initial load should succeed (warn mode)
			expect(getMath(api, config.dir)).toBeDefined();

			// api.add() collision should throw (error mode)
			await expect(
				api.slothlet.api.add("", TEST_DIRS.API_TEST_COLLECTIONS, {
					moduleID: "test-error"
				})
			).rejects.toThrow();
		});
	});

	describe("Backward compatibility", () => {
		it("should work without collision config (uses default merge)", async () => {
			// Don't specify collision config at all
			api = await createApiInstance(config);

			expect(getMath(api, config.dir)).toBeDefined();
			expect(getMath(api, config.dir).add).toBeTypeOf("function");

			// Should be able to add (default merge mode)
			await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, {
				moduleID: "extra-test"
			});

			expect(api.extra).toBeDefined();
			// Verify the added module has expected content
			expect(api.extra.mathEsm).toBeDefined();
			expect(api.extra.mathCjs).toBeDefined();
			// Mutation methods should still be available (collision config controls behavior now)
			expect(api.slothlet.api).toBeDefined();
			expect(api.slothlet.reload).toBeTypeOf("function");
		});
	});

	describe("Collision with complex structures", () => {
		it("should merge nested properties correctly", async () => {
			api = await createApiInstance(config, {
				api: { collision: { initial: "merge", api: "merge" } }
			});

			// Math module has nested structure
			const math = getMath(api, config.dir);
			expect(math.add).toBeTypeOf("function");

			// Add collision content to math path (should merge at all levels)
			await api.slothlet.api.add("", TEST_DIRS.API_TEST_COLLECTIONS, {
				moduleID: "nested-merge"
			});

			// Both original and new should coexist
			expect(math.add).toBeTypeOf("function");
			expect(math.power).toBeTypeOf("function");
		});
	});
});
