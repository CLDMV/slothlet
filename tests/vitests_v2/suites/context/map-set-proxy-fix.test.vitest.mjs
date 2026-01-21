/**
 * @fileoverview Map/Set proxy behavior validation across slothlet configurations.
 *
 * @description
 * Migrates tests/test-map-set-proxy-fix.mjs to vitest with matrix coverage.
 * Ensures Map and Set instances exposed through slothlet proxies behave correctly
 * (iteration, accessors, membership) in all modes/runtimes/hook/hotReload combinations.
 *
 * @module tests/vitests/processed/map-set-proxy-fix/map-set-proxy-fix.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Create a slothlet API instance for the collections fixture.
 * @param {object} baseConfig - Matrix configuration.
 * @returns {Promise<object>} Initialized API.
 */
async function createApi(baseConfig) {
	return slothlet({ ...baseConfig, dir: TEST_DIRS.API_TEST_COLLECTIONS });
}

describe.each(getMatrixConfigs({}))("Map/Set Proxy - $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
	});

	it("supports Map operations via proxy", async () => {
		api = await createApi(config);

		const testMap = api.collections?.testMap;
		expect(testMap).toBeDefined();
		expect(typeof testMap.size).toBe("number");
		expect(testMap.has("key1")).toBe(true);
		expect(testMap.get("key1")).toBe("value1");

		const keys = Array.from(testMap.keys());
		const values = Array.from(testMap.values());
		const entries = Array.from(testMap.entries());
		let forEachCount = 0;
		testMap.forEach(() => {
			forEachCount++;
		});

		expect(keys.length).toBeGreaterThan(0);
		expect(values.length).toBe(keys.length);
		expect(entries.length).toBe(keys.length);
		expect(forEachCount).toBeGreaterThan(0);
	});

	it("supports Set operations via proxy", async () => {
		api = await createApi(config);

		const testSet = api.collections?.testSet;
		expect(testSet).toBeDefined();
		expect(typeof testSet.size).toBe("number");
		expect(testSet.has("item1")).toBe(true);

		const values = Array.from(testSet.values());
		const keys = Array.from(testSet.keys());
		const entries = Array.from(testSet.entries());
		let forEachCount = 0;
		testSet.forEach(() => {
			forEachCount++;
		});

		expect(values.length).toBeGreaterThan(0);
		expect(keys.length).toBe(values.length);
		expect(entries.length).toBe(values.length);
		expect(forEachCount).toBeGreaterThan(0);
	});
});
