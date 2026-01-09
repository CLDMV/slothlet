/**
 * @fileoverview Function name preservation tests across all matrix configurations
 *
 * @description
 * Tests to verify function names are preserved after transformation in both eager and lazy modes.
 * Validates function name preference (e.g., autoIP vs autoIp) and proper name retention
 * after materialization.
 *
 * Original test: tests/test-function-name-preservation.mjs
 * New test count: 120 tests (6 test cases × 20 matrix configs)
 *
 * @module tests/vitests/function-name-preservation.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "./vitest-helper.mjs";

describe("Function Name Preservation", () => {
	let api;

	// Test for each matrix configuration
	describe.each(getMatrixConfigs({}))("Config: '$name'", ({ config }) => {
		let api;

		beforeEach(async () => {
			// Use dynamic import to avoid module caching issues
			const { default: slothlet } = await import("@cldmv/slothlet");
			api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				...config,
				debug: false // Disable debug output for cleaner testing
			});
		});

		afterEach(async () => {
			if (api?.shutdown) {
				await api.shutdown();
				api = null;
			}
		});

		test("should have root API as callable function", async () => {
			expect(typeof api, `${config.mode}: Root API should be callable function`).toBe("function");
		});

		test("should preserve root function names correctly", async () => {
			expect(api.rootFunctionShout?.name, `${config.mode}: rootFunctionShout should have correct name`).toBe("rootFunctionShout");
			expect(api.rootFunctionWhisper?.name, `${config.mode}: rootFunctionWhisper should have correct name`).toBe("rootFunctionWhisper");
		});

		test("should preserve math function names after materialization", async () => {
			// For lazy mode, materialize functions first
			if (config.mode === "lazy") {
				await api.math.add(2, 3);
				await api.math.multiply(4, 5);
			}

			expect(api.math?.add?.name, `${config.mode}: math.add should have correct name`).toBe("add");
			expect(api.math?.multiply?.name, `${config.mode}: math.multiply should have correct name`).toBe("multiply");
		});

		test("should use function name preference over sanitized filename", async () => {
			// For lazy mode, materialize function first
			if (config.mode === "lazy") {
				await api.task.autoIP();
			}

			// Function name should be "autoIP" (from the actual function) not "autoIp" (from sanitized filename)
			expect(api.task?.autoIP?.name, `${config.mode}: task.autoIP should use function name preference`).toBe("autoIP");
		});

		test("should preserve multi-defaults function names", async () => {
			// For lazy mode, materialize functions first
			if (config.mode === "lazy") {
				await api.multi_defaults.key("TEST");
				await api.multi_defaults.power();
				await api.multi_defaults.volume(50);
			}

			expect(api.multi_defaults?.key?.name, `${config.mode}: multi_defaults.key should use function name`).toBe("key");
			expect(api.multi_defaults?.power?.name, `${config.mode}: multi_defaults.power should use function name`).toBe("power");
			expect(api.multi_defaults?.volume?.name, `${config.mode}: multi_defaults.volume should use function name`).toBe("volume");
		});

		test("should maintain function identity after multiple calls", async () => {
			// Test that function names remain stable after multiple invocations
			if (config.mode === "lazy") {
				await api.math.add(1, 2);
				await api.math.add(3, 4);
				await api.task.autoIP();
				await api.task.autoIP();
			}

			expect(api.math?.add?.name, `${config.mode}: function name should remain stable after multiple calls`).toBe("add");
			expect(api.task?.autoIP?.name, `${config.mode}: function name should remain stable after multiple calls`).toBe("autoIP");
		});
	});
});
