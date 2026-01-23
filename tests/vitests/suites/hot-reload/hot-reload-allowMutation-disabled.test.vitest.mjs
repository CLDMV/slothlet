/**
 * @fileoverview Tests for allowMutation: false config option (DEPRECATED)
 *
 * @description
 * NOTE: allowMutation config option has been REMOVED in v3.
 * This test file is kept for backward compatibility testing only.
 * 
 * The allowMutation flag has been replaced by the collision configuration system.
 * To disable mutations, use: collision: "error"
 * 
 * These tests now verify that:
 * - Passing allowMutation is ignored (no effect)
 * - Mutation methods are always available
 * - Use collision config for controlling behavior
 *
 * @module tests/vitests/processed/hot-reload/allowMutation-disabled.test.vitest
 * @deprecated Use collision config instead
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

const BASE_DIRS = [
	{ label: "api-test", dir: TEST_DIRS.API_TEST },
	{ label: "api-test-mixed", dir: TEST_DIRS.API_TEST_MIXED }
];

const MATRIX_CONFIGS = getMatrixConfigs({}).flatMap(({ name, config }) =>
	BASE_DIRS.map(({ label, dir }) => ({
		name: `${name} | ${label}`,
		config: { ...config, dir }
	}))
);

describe.each(MATRIX_CONFIGS)("allowMutation config (DEPRECATED) - $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
	});

	it("should ignore allowMutation: false (deprecated config)", async () => {
		api = await createApiInstance(config, { allowMutation: false });

		// Mutation methods should still be available (allowMutation removed)
		expect(api.slothlet.api).toBeDefined();
		expect(api.slothlet.reload).toBeTypeOf("function");
	});

	it("should use collision config instead of allowMutation", async () => {
		// To disable mutations now, use collision: "error"
		api = await createApiInstance(config, { collision: "error" });

		expect(api.slothlet.api).toBeDefined();
		
		// Trying to add with collision mode "error" should throw
		await expect(
			api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "test" })
		).rejects.toThrow();
	});

	it("should allow mutations with collision: merge (default)", async () => {
		api = await createApiInstance(config, { collision: "merge" });

		expect(api.slothlet.api).toBeDefined();
		expect(api.slothlet.reload).toBeTypeOf("function");
		
		// Should be able to add without errors
		await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "extra-test" });
		expect(api.extra).toBeDefined();
	});

	it("should throw INVALID_CONFIG_MUTATION_DISABLED when calling reload via diagnostics", async () => {
		api = await createApiInstance(config, { allowMutation: false, diagnostics: true });

		await expect(api.slothlet.api.reload("test")).rejects.toThrow("INVALID_CONFIG_MUTATION_DISABLED");
	});

	it("should throw INVALID_CONFIG_MUTATION_DISABLED when calling namespace.reload via diagnostics", async () => {
		api = await createApiInstance(config, { allowMutation: false, diagnostics: true });

		await expect(api.slothlet.reload()).rejects.toThrow("INVALID_CONFIG_MUTATION_DISABLED");
	});

	it("should allow normal API usage when allowMutation: false", async () => {
		api = await createApiInstance(config, { allowMutation: false });

		// Normal API functions should still work
		const mathAdd = config.dir === TEST_DIRS.API_TEST_MIXED ? api.mathEsm?.add : api.math?.add;
		expect(mathAdd).toBeDefined();
		expect(typeof mathAdd).toBe("function");

		if (mathAdd) {
			const result = await mathAdd(5, 3);
			expect(result).toBe(8);
		}
	});
});
