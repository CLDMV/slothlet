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

const HOT_RELOAD_MATRIX = getMatrixConfigs({ hotReload: true }).flatMap(({ name, config }) =>
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
		await api.addApi("extra", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "test-module" });
		expect(api.extra?.mathCjs).toBeTypeOf("object");

		await api.removeApi({ moduleId: "test-module" });
		expect(api.extra).toBeUndefined();

		await api.reload();
		expect(api.extra).toBeUndefined();
	});
});
