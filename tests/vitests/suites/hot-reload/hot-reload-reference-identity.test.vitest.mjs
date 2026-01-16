/**
 * @fileoverview Comprehensive reference identity preservation tests for hot reload.
 *
 * @description
 * Tests that ALL entity types preserve their reference identity across reloadApi():
 * - Functions (standalone, nested, methods)
 * - Objects (namespaces, nested objects)
 * - Mixed exports (default + named)
 * - Wrapped functions (for hot-reload reference preservation)
 *
 * NOTE: reload() does a full reload and creates new references (expected behavior).
 * Only reloadApi() and addApi with mutateExisting preserve references via wrappers.
 *
 * @module tests/vitests/processed/hot-reload/hot-reload-reference-identity.test.vitest
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

const HOT_RELOAD_MATRIX = getMatrixConfigs({ hotReload: true }).flatMap(({ name, config }) =>
	BASE_DIRS.map(({ label, dir }) => ({
		name: `${name} | ${label}`,
		config: { ...config, dir }
	}))
);

describe.each(HOT_RELOAD_MATRIX)("Hot Reload Reference Identity - $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
		await new Promise((resolve) => setTimeout(resolve, 100));
	});

	it("preserves root-level API reference across reload()", async () => {
		api = await createApiInstance(config);
		const apiRef = api;

		await api.reload();

		// Root API reference is always preserved
		expect(api).toBe(apiRef);
	});

	it("preserves function references across reloadApi()", async () => {
		api = await createApiInstance(config);
		await api.addApi("extra", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "test-module" });

		// Get function references
		const mathCjsRef = api.extra?.mathCjs;
		const multiplyRef = api.extra?.mathCjs?.multiply;
		const mathEsmRef = api.extra?.mathEsm;
		const addRef = api.extra?.mathEsm?.add;

		await api.reloadApi("extra");

		// Same references after reloadApi
		expect(api.extra?.mathCjs).toBe(mathCjsRef);
		expect(api.extra?.mathCjs?.multiply).toBe(multiplyRef);
		expect(api.extra?.mathEsm).toBe(mathEsmRef);
		expect(api.extra?.mathEsm?.add).toBe(addRef);
	});

	it("preserves nested object and function references across reloadApi()", async () => {
		api = await createApiInstance(config);
		await api.addApi("deep", TEST_DIRS.API_TEST, {}, { moduleId: "deep-module" });

		// In lazy mode, access properties to materialize them before getting references
		if (config.mode === "lazy") {
			await api.deep.util.controller.getDefault();
			await api.deep.math.add(1, 1);
		}

		// Get nested references
		const utilRef = api.deep?.util;
		const controllerRef = api.deep?.util?.controller;
		const getDefaultRef = api.deep?.util?.controller?.getDefault;
		const mathRef = api.deep?.math;
		const addFuncRef = api.deep?.math?.add;

		await api.reloadApi("deep");

		// Same references after reloadApi
		expect(api.deep?.util).toBe(utilRef);
		expect(api.deep?.util?.controller).toBe(controllerRef);
		expect(api.deep?.util?.controller?.getDefault).toBe(getDefaultRef);
		expect(api.deep?.math).toBe(mathRef);
		expect(api.deep?.math?.add).toBe(addFuncRef);
	});

	it("preserves mixed export references (default + named) across reloadApi()", async () => {
		api = await createApiInstance(config);
		await api.addApi("extra", TEST_DIRS.API_TEST, {}, { moduleId: "test-module" });

		// Mixed exports: default function + named exports as properties
		const mixedRef = api.extra?.mixed;
		const mixedNamedRef = api.extra?.mixed?.mixedNamed;
		const mixedAnotherRef = api.extra?.mixed?.mixedAnother;

		await api.reloadApi("extra");

		// Same references after reloadApi
		expect(api.extra?.mixed).toBe(mixedRef);
		expect(api.extra?.mixed?.mixedNamed).toBe(mixedNamedRef);
		expect(api.extra?.mixed?.mixedAnother).toBe(mixedAnotherRef);
	});

	it("preserves all reference types across reloadApi() in comprehensive test", async () => {
		api = await createApiInstance(config);
		await api.addApi("comprehensive", TEST_DIRS.API_TEST, {}, { moduleId: "comp-module" });

		// Capture references for ALL entity types
		const refs = {
			// Objects (namespaces)
			math: api.comprehensive?.math,
			util: api.comprehensive?.util,
			advanced: api.comprehensive?.advanced,

			// Functions (standalone)
			mathAdd: api.comprehensive?.math?.add,
			mathMultiply: api.comprehensive?.math?.multiply,

			// Nested objects
			controller: api.comprehensive?.util?.controller,
			nest2: api.comprehensive?.advanced?.nest2,

			// Nested functions
			getDefault: api.comprehensive?.util?.controller?.getDefault,
			alphaX: api.comprehensive?.advanced?.nest2?.alpha?.x,

			// Mixed exports
			mixed: api.comprehensive?.mixed,
			mixedNamed: api.comprehensive?.mixed?.mixedNamed,

			// Config object
			config: api.comprehensive?.config
		};

		await api.reloadApi("comprehensive");

		// Verify ALL references are preserved
		expect(api.comprehensive?.math).toBe(refs.math);
		expect(api.comprehensive?.util).toBe(refs.util);
		expect(api.comprehensive?.advanced).toBe(refs.advanced);
		expect(api.comprehensive?.math?.add).toBe(refs.mathAdd);
		expect(api.comprehensive?.math?.multiply).toBe(refs.mathMultiply);
		expect(api.comprehensive?.util?.controller).toBe(refs.controller);
		expect(api.comprehensive?.advanced?.nest2).toBe(refs.nest2);
		expect(api.comprehensive?.util?.controller?.getDefault).toBe(refs.getDefault);
		expect(api.comprehensive?.advanced?.nest2?.alpha?.x).toBe(refs.alphaX);
		expect(api.comprehensive?.mixed).toBe(refs.mixed);
		expect(api.comprehensive?.mixed?.mixedNamed).toBe(refs.mixedNamed);
		expect(api.comprehensive?.config).toBe(refs.config);
	});
});
