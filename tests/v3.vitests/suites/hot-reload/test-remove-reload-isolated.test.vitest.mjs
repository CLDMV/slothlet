/**
 * Isolated test for "does not restore removed APIs after reload"
 * Uses the SAME MATRIX as hot-reload-basic to reproduce the issue
 */

// TODO(v3): Verify hot reload removal behavior with v3 helpers.

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

async function createApiInstance(baseConfig, overrides = {}) {
	return slothlet({ ...baseConfig, diagnostics: true, debug: true, ...overrides });
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
		await api.slothlet.api.add({ apiPath: "extra", folderPath: TEST_DIRS.API_TEST_MIXED, options: { moduleId: "test-module" } });
		expect(api.extra?.mathCjs).toBeTypeOf("object");

		await api.slothlet.api.remove({ moduleId: "test-module" });
		expect(api.extra).toBeUndefined();

		await api.slothlet.api.reload("extra");
		expect(api.extra).toBeUndefined();
	});
});
