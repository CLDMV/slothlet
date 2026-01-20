/**
 * @fileoverview Hot reload error handling coverage.
 *
 * @description
 * Tests error conditions for hot reload operations: disabled hotReload rejections,
 * invalid arguments, concurrent operations, and non-existent paths.
 *
 * @module tests/vitests/processed/hot-reload/hot-reload-errors.test.vitest
 */

// TODO(v3): Align hot reload error expectations with v3-only behavior.

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
	return slothlet({ ...baseConfig, diagnostics: true, ...overrides });
}

const NON_HOT_CONFIG = { ...getMatrixConfigs({ hotReload: false })[0].config, dir: TEST_DIRS.API_TEST };
const DEFAULT_HOT_CONFIG = { ...getMatrixConfigs({ hotReload: true })[0].config, dir: TEST_DIRS.API_TEST };

describe("Hot Reload Error Handling", () => {
	it("rejects reload() until full instance reload is implemented", async () => {
		const api = await createApiInstance(NON_HOT_CONFIG);
		await expect(api.slothlet.reload()).rejects.toThrow();
		await api.shutdown();
	});

	it("rejects invalid reloadApi arguments", async () => {
		const api = await createApiInstance(DEFAULT_HOT_CONFIG);

		await expect(api.slothlet.api.reload(123)).rejects.toThrow();
		await expect(api.slothlet.api.reload("")).rejects.toThrow();
		await expect(api.slothlet.api.reload("   ")).rejects.toThrow();

		await api.shutdown();
	});

	it("allows reloadApi on non-existent paths without throwing", async () => {
		const api = await createApiInstance(DEFAULT_HOT_CONFIG);
		await expect(api.slothlet.api.reload("nonExistentPath")).resolves.toBeUndefined();
		await api.shutdown();
	});

	it("handles concurrent reloadApi operations", async () => {
		const api = await createApiInstance(DEFAULT_HOT_CONFIG);

		await api.slothlet.api.add({ apiPath: "extra1", folderPath: TEST_DIRS.API_TEST_MIXED, options: { moduleId: "module-1" } });
		await api.slothlet.api.add({ apiPath: "extra2", folderPath: TEST_DIRS.API_TEST, options: { moduleId: "module-2" } });

		await expect(Promise.all([api.slothlet.api.reload("extra1"), api.slothlet.api.reload("extra2")])).resolves.toBeDefined();

		expect(api.extra1?.mathCjs).toBeTypeOf("object");
		expect(api.extra2?.math?.add).toBeTypeOf("function");

		await api.shutdown();
	});
});
