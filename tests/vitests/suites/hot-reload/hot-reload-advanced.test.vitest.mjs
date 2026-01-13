/**
 * @fileoverview Hot reload advanced functionality coverage using vitest matrix.
 *
 * @description
 * Tests advanced hot reload operations: reloadApi(), context/reference preservation,
 * nested reloads, deep reference preservation, and shutdown/reload cycles.
 *
 * @module tests/vitests/processed/hot-reload/hot-reload-advanced.test.vitest
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

describe.each(HOT_RELOAD_MATRIX)("Hot Reload Advanced - $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
	});

	it("reinitializes after shutdown followed by reload", async () => {
		api = await createApiInstance(config);
		const mathAdd = getMathAdd(api, config.dir);
		expect(mathAdd).toBeTypeOf("function");

		await api.shutdown();
		await api.reload();

		const mathAddAfter = getMathAdd(api, config.dir);
		expect(await mathAddAfter(10, 20)).toBe(30);
	});

	it("reloads a specific API path without affecting siblings", async () => {
		api = await createApiInstance(config);
		await api.addApi("extra1", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "module-1" });
		await api.addApi("extra2", TEST_DIRS.API_TEST, {}, { moduleId: "module-2" });

		const extra1Ref = api.extra1;
		await api.reloadApi("extra1");

		expect(api.extra1).toBe(extra1Ref);
		expect(api.extra2?.math?.add).toBeTypeOf("function");
	});

	it("reloads combined modules on the same path", async () => {
		api = await createApiInstance(config);
		await api.addApi("features", TEST_DIRS.API_TEST, {}, { moduleId: "core" });
		await api.addApi("features", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "extra", forceOverwrite: true });

		await api.reloadApi("features");

		expect(api.features?.math?.add).toBeTypeOf("function");
	});

	it("preserves context across reloads", async () => {
		api = await createApiInstance(config);
		api.context.userId = 123;
		api.context.session = "abc";

		await api.reload();

		expect(api.context.userId).toBe(123);
		expect(api.context.session).toBe("abc");
	});

	it("preserves reference object across reloads", async () => {
		api = await createApiInstance(config);
		api.reference.customUtil = () => "test";
		api.reference.constant = 42;

		await api.reload();

		expect(api.reference.customUtil()).toBe("test");
		expect(api.reference.constant).toBe(42);
	});

	it("reloads nested API paths while preserving siblings", async () => {
		api = await createApiInstance(config);
		await api.addApi("features.core", TEST_DIRS.API_TEST, {}, { moduleId: "core" });
		await api.addApi("features.extra", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "extra" });

		await api.reloadApi("features.core");

		expect(api.features?.core?.math?.add).toBeTypeOf("function");
		expect(api.features?.extra?.mathCjs).toBeTypeOf("object");
	});

	it("preserves deep references when mutateExisting is used", async () => {
		api = await createApiInstance(config);
		await api.addApi("deep", TEST_DIRS.API_TEST, {}, { moduleId: "deep-test" });

		if (config.mode === "lazy") {
			await api.deep.math.add(1, 1);
		}

		const mathRef = api.deep?.math;
		const addRef = api.deep?.math?.add;

		await api.reloadApi("deep");

		expect(api.deep?.math).toBe(mathRef);
		expect(api.deep?.math?.add).toBe(addRef);
	});
});
