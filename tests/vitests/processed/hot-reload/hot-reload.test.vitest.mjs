/**
 * @fileoverview Hot reload functionality coverage using vitest matrix.
 *
 * @description
 * Migrates tests from tests/test-hot-reload.mjs to vitest with matrix coverage.
 * Validates reload()/reloadApi(), addApi/removeApi tracking, context/reference
 * preservation, nested reloads, and concurrency safety.
 *
 * @module tests/vitests/processed/hot-reload/hot-reload.test.vitest
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../vitest-helper.mjs";

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

const HOOKED_HOT_RELOAD_MATRIX = getMatrixConfigs({ hotReload: true, hooks: true }).flatMap(({ name, config }) =>
	BASE_DIRS.map(({ label, dir }) => ({
		name: `${name} | ${label}`,
		config: { ...config, dir }
	}))
);

const NON_HOT_CONFIG = { ...getMatrixConfigs({ hotReload: false })[0].config, dir: TEST_DIRS.API_TEST };
const DEFAULT_HOT_CONFIG = { ...getMatrixConfigs({ hotReload: true })[0].config, dir: TEST_DIRS.API_TEST };

describe.each(HOT_RELOAD_MATRIX)("Hot Reload Behavior - $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
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
