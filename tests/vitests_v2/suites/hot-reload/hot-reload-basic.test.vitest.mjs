/**
 * @fileoverview Hot reload basic functionality coverage using vitest matrix.
 *
 * @description
 * Tests basic hot reload operations: reload(), instanceId regeneration,
 * addApi preservation, removeApi tracking, and reference identity.
 *
 * @module tests/vitests/processed/hot-reload/hot-reload-basic.test.vitest
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

const HOT_RELOAD_MATRIX = getMatrixConfigs({ hotReload: true }).flatMap(({ name, config }) =>
	BASE_DIRS.map(({ label, dir }) => ({
		name: `${name} | ${label}`,
		config: { ...config, dir }
	}))
);

describe.each(HOT_RELOAD_MATRIX)("Hot Reload Basic - $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
		// Allow any pending module operations to complete
		await new Promise((resolve) => setTimeout(resolve, 100));
	});

	it("reloads API and regenerates instanceId", async () => {
		api = await createApiInstance(config);
		const mathAdd = getMathAdd(api, config.dir);
		expect(mathAdd).toBeTypeOf("function");
		expect(await mathAdd(2, 3)).toBe(5);

		const originalInstanceId = api.instanceId;
		await api.reload();
		expect(api.instanceId).not.toBe(originalInstanceId);

		const mathAddAfter = getMathAdd(api, config.dir);
		expect(mathAddAfter).toBeTypeOf("function");
		expect(await mathAddAfter(4, 5)).toBe(9);
	});

	it("preserves addApi modules with moduleId across reloads", async () => {
		api = await createApiInstance(config);
		await api.addApi("extra", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "extra-module" });
		expect(api.extra?.mathCjs).toBeTypeOf("object");

		await api.reload();

		expect(getMathAdd(api, config.dir)).toBeTypeOf("function");
		expect(api.extra?.mathCjs).toBeTypeOf("object");
	});

	it("preserves addApi modules without moduleId across reloads", async () => {
		api = await createApiInstance(config);
		await api.addApi("extra", TEST_DIRS.API_TEST_MIXED);
		expect(api.extra?.mathCjs).toBeTypeOf("object");

		await api.reload();

		expect(getMathAdd(api, config.dir)).toBeTypeOf("function");
		expect(api.extra?.mathCjs).toBeTypeOf("object");
	});

	it("does not restore removed APIs after reload", async () => {
		api = await createApiInstance(config);
		await api.addApi("extra", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "test-module" });
		expect(api.extra?.mathCjs).toBeTypeOf("object");

		await api.removeApi({ moduleId: "test-module" });
		expect(api.extra).toBeUndefined();

		await api.reload();
		expect(api.extra).toBeUndefined();
	});

	it("preserves API reference identity across reloads", async () => {
		api = await createApiInstance(config);
		const reference = api;

		await api.reload();

		expect(api).toBe(reference);
	});

	it("keeps multiple addApi modules registered after reload", async () => {
		api = await createApiInstance(config);
		await api.addApi("extra1", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "module-1" });
		await api.addApi("extra2", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "module-2" });

		await api.reload();

		expect(api.extra1?.mathCjs).toBeTypeOf("object");
		expect(api.extra2?.mathCjs).toBeTypeOf("object");
	});

	it("reloads using the latest addApi overwrite", async () => {
		api = await createApiInstance(config, { allowApiOverwrite: true });
		await api.addApi("extra", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "module-x" });
		await api.addApi("extra", TEST_DIRS.API_TEST, {}, { moduleId: "module-x" });

		await api.reload();

		expect(api.extra?.math?.add).toBeTypeOf("function");
	});
});
