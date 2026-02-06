/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-errors.test.vitest.mjs
 *	@Date: 2026-01-27T22:45:42-08:00 (1769582742)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-05 15:54:19 -08:00 (1770335659)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Hot reload error handling coverage.
 *
 * @description
 * Tests error conditions for hot reload operations: disabled reload rejections,
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

const NON_HOT_CONFIG = { ...getMatrixConfigs({})[0].config, dir: TEST_DIRS.API_TEST };
const DEFAULT_HOT_CONFIG = { ...getMatrixConfigs({})[0].config, dir: TEST_DIRS.API_TEST };

describe("Hot Reload Error Handling", () => {
	it("rejects reload() when api.mutations.reload is disabled", async () => {
		const api = await createApiInstance(NON_HOT_CONFIG);
		await expect(api.slothlet.reload()).rejects.toThrow("reload");
		await api.shutdown();
	});

	it("rejects invalid reloadApi arguments", async () => {
		const api = await createApiInstance(DEFAULT_HOT_CONFIG);

		await expect(api.slothlet.api.reload(123)).rejects.toThrow("must be a string");
		await expect(api.slothlet.api.reload("")).rejects.toThrow("non-empty");
		await expect(api.slothlet.api.reload("   ")).rejects.toThrow("non-whitespace");

		await api.shutdown();
	});

	it("rejects reloadApi when api.mutations.reload is disabled", async () => {
		const api = await createApiInstance(NON_HOT_CONFIG);
		await expect(api.slothlet.api.reload("test")).rejects.toThrow("reload");
		await api.shutdown();
	});

	it("allows reloadApi on non-existent paths without throwing", async () => {
		const api = await createApiInstance(DEFAULT_HOT_CONFIG);
		await expect(api.slothlet.api.reload("nonExistentPath")).resolves.toBeUndefined();
		await api.shutdown();
	});

	it("handles concurrent reloadApi operations", async () => {
		const api = await createApiInstance(DEFAULT_HOT_CONFIG);

		await api.slothlet.api.add("extra1", TEST_DIRS.API_TEST_MIXED, { moduleID: "module-1" });
		await api.slothlet.api.add("extra2", TEST_DIRS.API_TEST, { moduleID: "module-2" });

		await expect(Promise.all([api.slothlet.api.reload("extra1"), api.slothlet.api.reload("extra2")])).resolves.toBeDefined();

		expect(api.extra1?.mathCjs).toBeTypeOf("object");
		expect(api.extra2?.math?.add).toBeTypeOf("function");

		await api.shutdown();
	});
});
