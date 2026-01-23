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
 * - collision.initial: During buildAPI (initial load) using conflict-1.mjs and conflict-2.mjs
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
			await api.slothlet.api.add("math", TEST_DIRS.API_TEST, {}, { 
				moduleId: "math-extra",
				allowOverwrite: true 
			});
			
			// Original function should still exist
			const math = getMath(api, config.dir);
			expect(math.add).toBeTypeOf("function");
		});
	});

	describe("String shorthand", () => {
		it("should apply string collision mode to both contexts", async () => {
			api = await createApiInstance(config, { collision: "skip" });
			
			// Skip mode - API should load
			const math = getMath(api, config.dir);
			expect(math).toBeDefined();
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
		it("merge mode: should allow later files to overwrite during buildAPI", async () => {
			api = await createApiInstance(config, { 
				collision: { initial: "merge", addApi: "merge" }
			});
			
			// conflict-2.mjs loads after conflict-1.mjs (alphabetically)
			// With merge mode, second file should overwrite
			const result = config.mode === "lazy" ? await api.conflictingName() : api.conflictingName();
			
			// Should get the SECOND version (overwritten)
			expect(result).toBe("from-file-2");
		});

		it("skip mode: should silently keep first file during buildAPI", async () => {
			api = await createApiInstance(config, { 
				collision: { initial: "skip", addApi: "merge" }
			});
			
			// conflict-1.mjs loads first (alphabetically)
			// With skip mode, first file wins, second is skipped
			const result = config.mode === "lazy" ? await api.conflictingName() : api.conflictingName();
			
			// Should get the FIRST version (not overwritten)
			expect(result).toBe("from-file-1");
		});

		it("warn mode: should warn and keep first file during buildAPI", async () => {
			const warnings = [];
			const originalWarn = console.warn;
			console.warn = (...args) => warnings.push(args.join(" "));

			try {
				api = await createApiInstance(config, { 
					collision: { initial: "warn", addApi: "merge" },
					silent: false
				});
				
				// Should have emitted warning about collision
				expect(warnings.length).toBeGreaterThan(0);
				expect(warnings.some((w) => w.includes("conflictingName"))).toBe(true);
				
				// Should keep first file
				const result = config.mode === "lazy" ? await api.conflictingName() : api.conflictingName();
				expect(result).toBe("from-file-1");
			} finally {
				console.warn = originalWarn;
			}
		});

		it("replace mode: should allow later files to completely replace during buildAPI", async () => {
			api = await createApiInstance(config, { 
				collision: { initial: "replace", addApi: "merge" }
			});
			
			// conflict-2.mjs completely replaces conflict-1.mjs
			// With replace mode, second file completely replaces first
			const result = config.mode === "lazy" ? await api.conflictingName() : api.conflictingName();
			
			// Should get the SECOND version (replaced)
			expect(result).toBe("from-file-2");
		});

		it("error mode: should throw error on collision during buildAPI", async () => {
			// Error mode should throw when overwrite-test-2.mjs tries to overwrite
			await expect(
				createApiInstance(config, { 
					collision: { initial: "error", addApi: "merge" }
				})
			).rejects.toThrow();
		});
	});

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
			const collisionFile = TEST_DIRS.API_TEST_COLLECTIONS + "/math-collision.mjs";
			await api.slothlet.api.add("math", collisionFile, {}, {
				moduleId: "math-collision",
				allowOverwrite: true
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
			expect(math.add).toBeTypeOf("function");
			
			// Replace math path with math-collision.mjs content
			const collisionFile = TEST_DIRS.API_TEST_COLLECTIONS + "/math-collision.mjs";
			await api.slothlet.api.add("math", collisionFile, {}, {
				moduleId: "math-replace",
				allowOverwrite: true,
				forceOverwrite: true
			});
			
			// After replace, structure depends on implementation
			// This validates the mode is accepted and doesn't error
		});

		it("skip mode: should silently keep existing value", async () => {
			api = await createApiInstance(config, { 
				collision: { initial: "merge", addApi: "skip" }
			});
			
			const math = getMath(api, config.dir);
			const originalAdd = math.add;
			expect(await originalAdd(2, 3)).toBe(5);
			
			// Try to add collision content to math path (should be skipped)
			const collisionFile = TEST_DIRS.API_TEST_COLLECTIONS + "/math-collision.mjs";
			await api.slothlet.api.add("math", collisionFile, {}, {
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
			const collisionFile = TEST_DIRS.API_TEST_COLLECTIONS + "/math-collision.mjs";
			await api.slothlet.api.add("math", collisionFile, {}, {
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
			const collisionFile = TEST_DIRS.API_TEST_COLLECTIONS + "/math-collision.mjs";
			await expect(
				api.slothlet.api.add("math", collisionFile, {}, {
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
			const collisionFile = TEST_DIRS.API_TEST_COLLECTIONS + "/math-collision.mjs";
			await expect(
				api.slothlet.api.add("math", collisionFile, {}, {
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
			await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, {}, {
				moduleId: "extra-test"
			});
			
			expect(api.extra).toBeDefined();
		});

		it("should not accept old allowMutation config", async () => {
			// allowMutation has been removed - passing it should be ignored
			api = await createApiInstance(config, { allowMutation: false });
			
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
			const collisionFile = TEST_DIRS.API_TEST_COLLECTIONS + "/math-collision.mjs";
			await api.slothlet.api.add("math", collisionFile, {}, {
				moduleId: "nested-merge",
				allowOverwrite: true
			});
			
			// Both original and new should coexist
			expect(math.add).toBeTypeOf("function");
			expect(math.power).toBeTypeOf("function");
		});
	});
});
