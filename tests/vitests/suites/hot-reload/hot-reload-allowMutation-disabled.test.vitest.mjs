/**
 * @fileoverview Tests for allowMutation: false config option
 *
 * @description
 * Tests that allowMutation: false properly disables all mutation operations:
 * - api.slothlet.api namespace should not exist (unless diagnostics: true)
 * - api.slothlet.reload should not exist (unless diagnostics: true)
 * - Mutation methods should throw INVALID_CONFIG_MUTATION_DISABLED errors when called via diagnostics
 *
 * @module tests/vitests/processed/hot-reload/allowMutation-disabled.test.vitest
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index2.mjs";
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

describe.each(MATRIX_CONFIGS)("allowMutation: false - $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
	});

	it("should not expose api.slothlet.api when allowMutation: false", async () => {
		api = await createApiInstance(config, { allowMutation: false });

		expect(api.slothlet.api).toBeUndefined();
	});

	it("should not expose api.slothlet.reload when allowMutation: false", async () => {
		api = await createApiInstance(config, { allowMutation: false });

		expect(api.slothlet.reload).toBeUndefined();
	});

	it("should expose mutation methods when diagnostics: true even with allowMutation: false", async () => {
		api = await createApiInstance(config, { allowMutation: false, diagnostics: true });

		expect(api.slothlet.api).toBeDefined();
		expect(api.slothlet.reload).toBeDefined();
	});

	it("should throw INVALID_CONFIG_MUTATION_DISABLED when calling add via diagnostics", async () => {
		api = await createApiInstance(config, { allowMutation: false, diagnostics: true });

		await expect(api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("INVALID_CONFIG_MUTATION_DISABLED");
	});

	it("should throw INVALID_CONFIG_MUTATION_DISABLED when calling remove via diagnostics", async () => {
		api = await createApiInstance(config, { allowMutation: false, diagnostics: true });

		await expect(api.slothlet.api.remove("test")).rejects.toThrow("INVALID_CONFIG_MUTATION_DISABLED");
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
