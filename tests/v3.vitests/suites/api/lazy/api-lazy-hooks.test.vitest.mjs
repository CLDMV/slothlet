/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/processed/api/lazy/api-lazy-hooks.test.vitest.mjs
 *	@Date: 2026-01-12 18:06:09 -08:00 (1768269969)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-12 18:11:06 -08:00 (1768270266)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */


import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { callNestedFunction, testConfig, getMatrixConfigs, TEST_DIRS } from "../../../setup/vitest-helper.mjs";

/**
 * Mock MD5 function for testing reference functionality
 * @param {string} input - String to hash
 * @returns {string} Mock MD5 hash
 */
function mockMd5(input) {
	return "mock-md5-hash-" + input.length;
}

// LAZY configs with hooks (LAZY_HOOKS, LAZY_HOT_HOOKS)
const matrixConfigs = getMatrixConfigs({ mode: "lazy", hooks: true, runtime: "async" });
const { apiTests } = testConfig.testConfig;

describe("API (lazy-hooks)", () => {
	describe.each(matrixConfigs)("Config: $name", ({ config }) => {
		let api;
		const isLazy = true;

		beforeEach(async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				api_mode: "function",
				reference: { md5: mockMd5 }
			});
		});

		afterEach(async () => {
			if (api && typeof api.shutdown === "function") {
				await api.shutdown();
			}
			api = null;
		});

		apiTests.forEach((section) => {
			describe(section.section, () => {
				section.calls.forEach((call) => {
					it(call.label, async () => {
						const shouldAwait = isLazy || call.async;
						const result = await callNestedFunction(api, call.path, call.args, shouldAwait);

						if (!shouldAwait && call.async && typeof result?.then === "function") {
							const resolvedResult = await result;
							expect(resolvedResult).toBe(call.expected);
						} else {
							expect(result).toBe(call.expected);
						}
					});
				});
			});
		});

		describe("Additional functions", () => {
			it("md5 reference function", () => {
				expect(typeof api.md5).toBe("function");
				const result = api.md5("test");
				expect(result).toBe("mock-md5-hash-4");
			});

			it("describe function", () => {
				expect(typeof api.describe).toBe("function");
			});

			it("shutdown function", () => {
				expect(typeof api.shutdown).toBe("function");
			});
		});
	});
});
