/**
 * @fileoverview Mixed mode diagnostics test - validates API structure and reload availability
 * @module tests/vitests/processed/diagnostics/mixed-diagnostic.test.vitest
 * @memberof tests.vitests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs({ hotReload: true }))("Mixed Diagnostic > Config: '$name'", ({ config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should have correct API type and structure", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST_MIXED
		});

		expect(typeof api).toBe("object");
		expect(api).toBeDefined();
	});

	it("should expose reload() method when hotReload is enabled", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST_MIXED
		});

		expect(typeof api.reload).toBe("function");
	});

	it("should expose mathEsm API", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST_MIXED
		});

		expect(typeof api.mathEsm).toBe("object");
		expect(api.mathEsm).toBeDefined();
	});

	it("should expose mathCjs API", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST_MIXED
		});

		expect(typeof api.mathCjs).toBe("object");
		expect(api.mathCjs).toBeDefined();
	});

	it("should successfully execute reload()", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST_MIXED
		});

		await expect(api.reload()).resolves.not.toThrow();
	});

	it("should maintain API structure after reload", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST_MIXED
		});

		const beforeKeys = Object.keys(api).filter((k) => k !== "instanceId");
		await api.reload();
		const afterKeys = Object.keys(api).filter((k) => k !== "instanceId");

		expect(afterKeys.sort()).toEqual(beforeKeys.sort());
	});
});
