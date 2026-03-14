/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-basic.test.vitest.mjs
 *	@Date: 2026-01-27T22:45:42-08:00 (1769582742)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:42 -08:00 (1772425302)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Hot reload basic functionality coverage using vitest matrix.
 *
 * @description
 * Tests basic hot reload operations: reload(), instanceId regeneration,
 * api.slothlet.api.add preservation, removeApi tracking, and reference identity.
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

const HOT_RELOAD_MATRIX = getMatrixConfigs({}).flatMap(({ name, config }) =>
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
		// V3: Default collision mode prefers FILE over FOLDER, so math.add returns 1005
		const expected = config.dir === TEST_DIRS.API_TEST ? 1005 : 5;
		expect(await mathAdd(2, 3)).toBe(expected);

		const originalInstanceId = api.slothlet.instanceID;
		await api.slothlet.reload();
		expect(api.slothlet.instanceID).not.toBe(originalInstanceId);

		const mathAddAfter = getMathAdd(api, config.dir);
		expect(mathAddAfter).toBeTypeOf("function");
		// V3: After reload, same collision behavior
		const expectedAfter = config.dir === TEST_DIRS.API_TEST ? 1009 : 9;
		expect(await mathAddAfter(4, 5)).toBe(expectedAfter);
	});

	it("preserves api.slothlet.api.add modules with moduleID across reloads", async () => {
		api = await createApiInstance(config);
		await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, { moduleID: "extra-module" });
		expect(api.extra?.mathCjs).toBeTypeOf("object");

		await api.slothlet.reload();

		expect(getMathAdd(api, config.dir)).toBeTypeOf("function");
		expect(api.extra?.mathCjs).toBeTypeOf("object");
	});

	it("preserves api.slothlet.api.add modules without moduleID across reloads", async () => {
		api = await createApiInstance(config);
		await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED);
		expect(api.extra?.mathCjs).toBeTypeOf("object");

		await api.slothlet.reload();

		expect(getMathAdd(api, config.dir)).toBeTypeOf("function");
		expect(api.extra?.mathCjs).toBeTypeOf("object");
	});

	it("does not restore removed APIs after reload", async () => {
		api = await createApiInstance(config);
		await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, { moduleID: "test-module" });
		expect(api.extra?.mathCjs).toBeTypeOf("object");

		await api.slothlet.api.remove("test-module");
		expect(api.extra).toBeUndefined();

		await api.slothlet.reload();
		expect(api.extra).toBeUndefined();
	});

	it("preserves API reference identity across reloads", async () => {
		api = await createApiInstance(config);
		const reference = api;

		await api.slothlet.reload();

		expect(api).toBe(reference);
	});

	it("keeps multiple api.slothlet.api.add modules registered after reload", async () => {
		api = await createApiInstance(config);
		await api.slothlet.api.add("extra1", TEST_DIRS.API_TEST_MIXED, { moduleID: "module-1" });
		await api.slothlet.api.add("extra2", TEST_DIRS.API_TEST_MIXED, { moduleID: "module-2" });

		await api.slothlet.reload();

		expect(api.extra1?.mathCjs).toBeTypeOf("object");
		expect(api.extra2?.mathCjs).toBeTypeOf("object");
	});

	// TODO: allowAddApiOverwrite isn't in v3...
	it("reloads using the latest api.slothlet.api.add overwrite", async () => {
		api = await createApiInstance(config, { allowAddApiOverwrite: true });
		await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, { moduleID: "module-x" });
		await api.slothlet.api.add("extra", TEST_DIRS.API_TEST, { moduleID: "module-x" });

		await api.slothlet.reload();

		expect(api.extra?.math?.add).toBeTypeOf("function");
	});
});
