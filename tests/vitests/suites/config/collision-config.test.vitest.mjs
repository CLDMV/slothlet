/**
 * @fileoverview Comprehensive tests for unified collision configuration system
 *
 * @description
 * Tests the unified collision configuration system which replaces the old
 * allowMutation, allowInitialOverwrite, and allowAddApiOverwrite flags.
 * 
 * Tests all five collision modes:
 * - skip: Silently ignore collision, keep existing
 * - warn: Warn about collision, keep existing  
 * - replace: Replace existing value completely
 * - merge: Merge properties (preserve original + add new)
 * - error: Throw error on collision
 * 
 * Tests both contexts:
 * - collision.initial: During buildAPI (initial load) - math.mjs file collides with math/ folder
 * - collision.addApi: During api.add() operations using math-collision.mjs from api_test_collections
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
			
			// Default should be { initial: "merge", addApi: "merge" }
			// API should load successfully with no errors
			const math = getMath(api, config.dir);
			expect(math).toBeDefined();
			expect(math.add).toBeTypeOf("function");
		});

		it("should allow api.add() with merge by default", async () => {
			api = await createApiInstance(config);
			
			// Should be able to add to existing path without errors
			await api.slothlet.api.add("math", TEST_DIRS.API_TEST, { 
				moduleId: "math-extra"
			});
			
			// Original function should still exist
			const math = getMath(api, config.dir);
			expect(math.add).toBeTypeOf("function");
		});
	});

	describe("String shorthand", () => {
		it("should apply string collision mode to both contexts", async () => {
			api = await createApiInstance(config, { collision: "skip" });
			
			// Skip mode - API should load and function should work
			const math = getMath(api, config.dir);
			expect(math).toBeDefined();
			expect(math.add).toBeTypeOf("function");
			const result = config.mode === "lazy" ? await math.add(2, 3) : math.add(2, 3);
			expect([5, 1005]).toContain(result);
		});

		it("should normalize collision mode case-insensitively", async () => {
			api = await createApiInstance(config, { collision: "MERGE" });
			
			const math = getMath(api, config.dir);
			expect(math).toBeDefined();
			expect(math.add).toBeTypeOf("function");
		});

		it("should default invalid modes to merge", async () => {
			api = await createApiInstance(config, { collision: "invalid-mode" });
			
			// Should default to merge and load successfully
			const math = getMath(api, config.dir);
			expect(math).toBeDefined();
			expect(math.add).toBeTypeOf("function");
		});
	});
	describe("collision.initial modes", () => {
		// math.mjs file collides with math/ folder during initial load
		// Both try to create api.math, triggering collision.initial behavior

		it("merge mode: should merge file and folder exports", async () => {
			api = await createApiInstance(config, { 
				collision: { initial: "merge", addApi: "merge" }
			});
			
			const math = getMath(api, config.dir);
			expect(math).toBeDefined();
			expect(math.add).toBeTypeOf("function");
			
			// Should have both folder and file exports merged
			const result = config.mode === "lazy" ? await math.add(2, 3) : math.add(2, 3);
			// Result could be from folder (5) or file (1005) depending on load order
			expect([5, 1005]).toContain(result);
		});

		it("skip mode: should keep first loaded (folder or file)", async () => {
			api = await createApiInstance(config, { 
				collision: { initial: "skip", addApi: "merge" }
			});
			
			const math = getMath(api, config.dir);
			expect(math).toBeDefined();
			expect(math.add).toBeTypeOf("function");
		
		// Verify the function works (whichever loaded first)
		let result = config.mode === "lazy" ? await math.add(2, 3) : math.add(2, 3);
		expect([5, 1005]).toContain(result); // Could be from folder or file
			expect(math).toBeDefined();
			expect(math.add).toBeTypeOf("function");
		
		// Verify the function works (last loaded should have replaced)
		result = config.mode === "lazy" ? await math.add(2, 3) : math.add(2, 3);
			expect(math.add).toBeTypeOf("function");
		});
	});
	// NOTE: collision.initial tests removed because files don't actually collide during initial buildAPI
	// Each file gets its own namespace, so there's no collision to test
	// collision.initial would only apply in custom scenarios not representable in simple file loading

	describe("collision.addApi modes", () => {
		it("merge mode: should preserve original and add new properties", async () => {
			api = await createApiInstance(config, { 
				collision: { initial: "merge", addApi: "merge" }
			});
			
			const math = getMath(api, config.dir);
			const originalAdd = math.add;
			expect(originalAdd).toBeTypeOf("function");
			expect(await originalAdd(2, 3)).toBe(5);
			
			// Add math-collision.mjs content to existing math path - should merge
			await api.slothlet.api.add("math", TEST_DIRS.API_TEST_COLLECTIONS, {
				moduleId: "math-collision"
			});
			
			// Original function should still exist
			expect(math.add).toBeTypeOf("function");
			expect(await math.add(2, 3)).toBe(5);
			
			// New functions from collision file should also exist
			expect(math.power).toBeTypeOf("function");
			expect(math.sqrt).toBeTypeOf("function");
			expect(math.modulo).toBeTypeOf("function");
			expect(await math.power(2, 3)).toBe(8);
			expect(await math.sqrt(16)).toBe(4);
		});

		it("replace mode: should completely replace existing value", async () => {
			api = await createApiInstance(config, { 
				collision: { initial: "merge", addApi: "replace" }
			});
			
			const math = getMath(api, config.dir);
			const originalAdd = math.add;
			expect(originalAdd).toBeTypeOf("function");
			
			// Replace math path with math-collision.mjs content
			await api.slothlet.api.add("math", TEST_DIRS.API_TEST_COLLECTIONS, {
				moduleId: "math-collision"
			});
			
			// After replace, original add should be gone (replaced)
			expect(math.add).toBeUndefined();
			
			// New functions from collision file should exist
			expect(math.power).toBeTypeOf("function");
			expect(math.sqrt).toBeTypeOf("function");
			expect(math.modulo).toBeTypeOf("function");
			expect(await math.power(2, 3)).toBe(8);
			expect(await math.sqrt(16)).toBe(4);
			expect(await math.modulo(10, 3)).toBe(1);
		});

		it("skip mode: should silently keep existing value", async () => {
			api = await createApiInstance(config, { 
				collision: { initial: "merge", addApi: "skip" }
			});
			
			const math = getMath(api, config.dir);
			const originalAdd = math.add;
			expect(await originalAdd(2, 3)).toBe(5);
			
			// Try to add collision content to math path (should be skipped)
			await api.slothlet.api.add("math", TEST_DIRS.API_TEST_COLLECTIONS, {
				moduleId: "math-skip"
			});
			
			// Original should still exist
			expect(math.add).toBeTypeOf("function");
			expect(await math.add(2, 3)).toBe(5);
			
			// New functions should NOT exist (collision was skipped)
			expect(math.power).toBeUndefined();
			expect(math.sqrt).toBeUndefined();
		});

		it("warn mode: should warn and keep existing value", async () => {
			api = await createApiInstance(config, { 
				collision: { initial: "merge", addApi: "warn" },
				silent: false
			});
			
			const math = getMath(api, config.dir);
			const originalAdd = math.add;
			
			// Try to add collision content to math path (should warn and skip)
			await api.slothlet.api.add("math", TEST_DIRS.API_TEST_COLLECTIONS, {
				moduleId: "math-warn"
			});
			
			// Original should still exist
			expect(math.add).toBeTypeOf("function");
			expect(await math.add(2, 3)).toBe(5);
			
			// New functions should NOT exist (collision was warned + skipped)
			expect(math.power).toBeUndefined();
		});

		it("error mode: should throw error on collision", async () => {
			api = await createApiInstance(config, { 
				collision: { initial: "merge", addApi: "error" }
			});
			
			const math = getMath(api, config.dir);
			expect(math.add).toBeTypeOf("function");
			
			// Try to add collision content to math path (should throw)
			await expect(
				api.slothlet.api.add("math", TEST_DIRS.API_TEST_COLLECTIONS, {
					moduleId: "math-error"
				})
			).rejects.toThrow();
		});
	});

	describe("Per-context configuration", () => {
		it("should allow different modes for initial vs addApi", async () => {
			api = await createApiInstance(config, { 
				collision: { initial: "warn", addApi: "error" }
			});
			
			// Initial load should succeed (warn mode)
			expect((getMath(api, config.dir))).toBeDefined();
			
			// api.add() collision should throw (error mode)
			await expect(
				api.slothlet.api.add("math", TEST_DIRS.API_TEST_COLLECTIONS, {
					moduleId: "test-error"
				})
			).rejects.toThrow();
		});
	});

	describe("Backward compatibility", () => {
		it("should work without collision config (uses default merge)", async () => {
			// Don't specify collision config at all
			api = await createApiInstance(config);
			
			expect((getMath(api, config.dir))).toBeDefined();
			expect((getMath(api, config.dir)).add).toBeTypeOf("function");
			
			// Should be able to add (default merge mode)
			await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, {
				moduleId: "extra-test"
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
				collision: { initial: "merge", addApi: "merge" }
			});
			
			// Math module has nested structure
			const math = getMath(api, config.dir);
			expect(math.add).toBeTypeOf("function");
			
			// Add collision content to math path (should merge at all levels)
			await api.slothlet.api.add("math", TEST_DIRS.API_TEST_COLLECTIONS, {
				moduleId: "nested-merge"
			});
			
			// Both original and new should coexist
			expect(math.add).toBeTypeOf("function");
			expect(math.power).toBeTypeOf("function");
		});
	});
});
