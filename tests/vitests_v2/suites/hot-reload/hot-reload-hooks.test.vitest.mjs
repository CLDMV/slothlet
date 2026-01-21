/**
 * @fileoverview Hot reload hooks functionality coverage using vitest matrix.
 *
 * @description
 * Tests hot reload behavior with hooks enabled, ensuring hook registrations
 * are preserved across reload operations.
 *
 * @module tests/vitests/processed/hot-reload/hot-reload-hooks.test.vitest
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
 * Resolve the math add function for the current API based on the source directory.
 * @param {object} api - Slothlet API instance.
 * @param {string} dir - API directory used during initialization.
 * @returns {Function|undefined} Math add function.
 */
function getMathAdd(api, dir) {
	return dir === TEST_DIRS.API_TEST_MIXED ? api.mathEsm?.add : api.math?.add;
}

const BASE_DIRS = [
	{ label: "api-test", dir: TEST_DIRS.API_TEST },
	{ label: "api-test-mixed", dir: TEST_DIRS.API_TEST_MIXED }
];

const HOOKED_HOT_RELOAD_MATRIX = getMatrixConfigs({ hotReload: true, hooks: true }).flatMap(({ name, config }) =>
	BASE_DIRS.map(({ label, dir }) => ({
		name: `${name} | ${label}`,
		config: { ...config, dir }
	}))
);

describe.each(HOOKED_HOT_RELOAD_MATRIX)("Hot Reload Hooks - $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
	});

	it("preserves hook registrations across reloads", async () => {
		api = await createApiInstance(config);
		let hookCalled = false;

		api.hooks.on(
			"before",
			({ path }) => {
				hookCalled = Boolean(path);
			},
			{ pattern: "**" }
		);

		const mathAdd = getMathAdd(api, config.dir);
		await mathAdd?.(1, 2);

		hookCalled = false;
		await api.reload();

		const mathAddAfter = getMathAdd(api, config.dir);
		await mathAddAfter?.(3, 4);

		expect(hookCalled).toBe(true);
	});
});
