/**
 * @fileoverview Hot reload error handling coverage.
 *
 * @description
 * Tests error conditions for hot reload operations: disabled hotReload rejections,
 * invalid arguments, concurrent operations, and non-existent paths.
 *
 * @module tests/vitests/processed/hot-reload/hot-reload-errors.test.vitest
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect } from "vitest";
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

const NON_HOT_CONFIG = { ...getMatrixConfigs({ hotReload: false })[0].config, dir: TEST_DIRS.API_TEST };
const DEFAULT_HOT_CONFIG = { ...getMatrixConfigs({ hotReload: true })[0].config, dir: TEST_DIRS.API_TEST };

describe("Hot Reload Error Handling", () => {
	it("rejects reload() when hotReload is disabled", async () => {
		const api = await createApiInstance(NON_HOT_CONFIG);
		await expect(api.reload()).rejects.toThrow("hotReload must be enabled");
		await api.shutdown();
	});

	it("rejects invalid reloadApi arguments", async () => {
		const api = await createApiInstance(DEFAULT_HOT_CONFIG);

		await expect(api.reloadApi(123)).rejects.toThrow("must be a string");
		await expect(api.reloadApi("")).rejects.toThrow("non-empty");
		await expect(api.reloadApi("   ")).rejects.toThrow("non-whitespace");

		await api.shutdown();
	});

	it("rejects reloadApi when hotReload is disabled", async () => {
		const api = await createApiInstance(NON_HOT_CONFIG);
		await expect(api.reloadApi("test")).rejects.toThrow("hotReload must be enabled");
		await api.shutdown();
	});

	it("allows reloadApi on non-existent paths without throwing", async () => {
		const api = await createApiInstance(DEFAULT_HOT_CONFIG);
		await expect(api.reloadApi("nonExistentPath")).resolves.toBeUndefined();
		await api.shutdown();
	});

	it("handles concurrent reloadApi operations", async () => {
		const api = await createApiInstance(DEFAULT_HOT_CONFIG);

		await api.addApi("extra1", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "module-1" });
		await api.addApi("extra2", TEST_DIRS.API_TEST, {}, { moduleId: "module-2" });

		await expect(Promise.all([api.reloadApi("extra1"), api.reloadApi("extra2")])).resolves.toBeDefined();

		expect(api.extra1?.mathCjs).toBeTypeOf("object");
		expect(api.extra2?.math?.add).toBeTypeOf("function");

		await api.shutdown();
	});
});
