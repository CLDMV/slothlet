/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-test-remove-reload-isolated.test.vitest.mjs
 *	@Date: 2026-01-27T22:45:42-08:00 (1769582742)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:49 -08:00 (1770266389)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Isolated test for "does not restore removed APIs after reload"
 * Uses the SAME MATRIX as hot-reload-basic to reproduce the issue
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

async function createApiInstance(baseConfig, overrides = {}) {
	return slothlet({ ...baseConfig, debug: true, ...overrides });
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

describe.each(HOT_RELOAD_MATRIX)("Isolated: does not restore removed APIs - $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
		// Allow any pending module operations to complete
		await new Promise((resolve) => setTimeout(resolve, 100));
	});

	it("should not restore removed APIs after reload", async () => {
		api = await createApiInstance(config);
		await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "test-module" });
		expect(api.extra?.mathCjs).toBeTypeOf("object");

		await api.slothlet.api.remove("test-module");
		expect(api.extra).toBeUndefined();

		await api.slothlet.reload();
		expect(api.extra).toBeUndefined();
	});
});
