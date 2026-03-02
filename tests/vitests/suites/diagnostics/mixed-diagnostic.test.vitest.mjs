/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/diagnostics/mixed-diagnostic.test.vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:47 -08:00 (1772425307)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Mixed mode diagnostics test - validates API structure and reload availability
 * @module tests/vitests/processed/diagnostics/mixed-diagnostic.test.vitest
 * @memberof tests.vitests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs({}))("Mixed Diagnostic > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST_MIXED
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should have correct API type and structure", () => {
		expect(typeof api).toBe("object");
		expect(api).toBeDefined();
	});

	it("should expose reload() method on api.slothlet", () => {
		expect(typeof api.slothlet.reload).toBe("function");
	});

	it("should expose mathEsm API", () => {
		expect(typeof api.mathEsm).toBe("object");
		expect(api.mathEsm).toBeDefined();
	});

	it("should expose mathCjs API", () => {
		expect(typeof api.mathCjs).toBe("object");
		expect(api.mathCjs).toBeDefined();
	});

	it("should successfully execute reload()", async () => {
		await expect(api.slothlet.reload()).resolves.not.toThrow();
	});

	it("should maintain API structure after reload", async () => {
		const beforeKeys = Object.keys(api).filter((k) => k !== "slothlet");
		await api.slothlet.reload();
		const afterKeys = Object.keys(api).filter((k) => k !== "slothlet");

		expect(afterKeys.sort()).toEqual(beforeKeys.sort());
	});
});
