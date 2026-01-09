/**
 * @fileoverview Vitest tests for always hooks receiving full execution context with error information.
 * @module tests/vitests/hooks-always-error-context
 *
 * @description
 * Verifies that always hooks receive complete context including:
 * - path: Function path
 * - result: Final result (undefined if error)
 * - hasError: Boolean indicating if errors occurred
 * - errors: Array of Error objects
 *
 * This allows a single always hook to handle both success and error scenarios
 * for unified logging, metrics, and monitoring.
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "./vitest-helper.mjs";

// Test each configuration in the matrix
describe.each(getMatrixConfigs({ hooks: true }))("Hooks Always Error Context > Config: '$name'", ({ config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		// Dynamic import of slothlet
		const slothletModule = await import("../../index.mjs");
		slothlet = slothletModule.default;

		// Create API instance with the test config
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hooks: config.hooks || true
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		slothlet = null;
	});

	test("should provide empty errors array on success execution", async () => {
		let alwaysContext = null;

		api.hooks.on(
			"always",
			({ path, result, hasError, errors }) => {
				alwaysContext = { path, result, hasError, errors };
			},
			{ id: "observe-execution", pattern: "math.add" }
		);

		const result = await api.math.add(2, 3);

		expect(result).toBe(5);
		expect(alwaysContext).not.toBeNull();
		expect(alwaysContext.path).toBe("math.add");
		expect(alwaysContext.result).toBe(5);
		expect(alwaysContext.hasError).toBe(false);
		expect(Array.isArray(alwaysContext.errors)).toBe(true);
		expect(alwaysContext.errors).toHaveLength(0);
	});

	test("should provide empty errors array on short-circuit execution", async () => {
		let alwaysContext = null;

		// Before hook short-circuits
		api.hooks.on(
			"before",
			() => {
				return 99; // Short-circuit
			},
			{ id: "short-circuit", pattern: "math.add", priority: 200 }
		);

		api.hooks.on(
			"always",
			({ result, hasError, errors }) => {
				alwaysContext = { result, hasError, errors };
			},
			{ id: "observe-execution", pattern: "math.add" }
		);

		const result = await api.math.add(2, 3);

		expect(result).toBe(99);
		expect(alwaysContext).not.toBeNull();
		expect(alwaysContext.result).toBe(99);
		expect(alwaysContext.hasError).toBe(false);
		expect(alwaysContext.errors).toHaveLength(0);
	});

	test("should provide error in errors array when function error occurs", async () => {
		let alwaysContext = null;

		// Create new instance with suppressErrors for this test
		await api.shutdown();
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hooks: {
				enabled: true,
				suppressErrors: true
			}
		});

		api.hooks.on(
			"always",
			({ path, result, hasError, errors }) => {
				alwaysContext = { path, result, hasError, errors };
			},
			{ id: "observe-execution", pattern: "math.divide" }
		);

		// Divide by zero should throw
		const result = await api.math.divide(10, 0);

		expect(result).toBeUndefined();
		expect(alwaysContext).not.toBeNull();
		expect(alwaysContext.path).toBe("math.divide");
		expect(alwaysContext.result).toBeUndefined();
		expect(alwaysContext.hasError).toBe(true);
		expect(Array.isArray(alwaysContext.errors)).toBe(true);
		expect(alwaysContext.errors).toHaveLength(1);
		expect(alwaysContext.errors[0]).toBeInstanceOf(Error);
		expect(alwaysContext.errors[0].message).toContain("divide by zero");
	});

	test("should support unified logging with single always hook", async () => {
		const logs = [];

		// Create new instance with suppressErrors for this test
		await api.shutdown();
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hooks: {
				enabled: true,
				suppressErrors: true
			}
		});

		// Single always hook handles both success and error logging
		api.hooks.on(
			"always",
			({ path, result, hasError, errors }) => {
				if (hasError) {
					logs.push({
						type: "error",
						path: path,
						errorCount: errors.length,
						errorMessages: errors.map((e) => e.message)
					});
				} else {
					logs.push({
						type: "success",
						path: path,
						result: result
					});
				}
			},
			{ id: "unified-logger", pattern: "math.*" }
		);

		// Success case
		await api.math.add(2, 3);

		// Error case
		await api.math.divide(10, 0);

		// Another success case
		await api.math.multiply(4, 5);

		expect(logs).toHaveLength(3);

		// Verify first log (success)
		expect(logs[0].type).toBe("success");
		expect(logs[0].path).toBe("math.add");
		expect(logs[0].result).toBe(5);

		// Verify second log (error)
		expect(logs[1].type).toBe("error");
		expect(logs[1].path).toBe("math.divide");
		expect(logs[1].errorCount).toBe(1);
		expect(logs[1].errorMessages[0]).toContain("divide by zero");

		// Verify third log (success)
		expect(logs[2].type).toBe("success");
		expect(logs[2].path).toBe("math.multiply");
		expect(logs[2].result).toBe(20);
	});

	test("should propagate error context when suppressErrors is false", async () => {
		let alwaysContext = null;

		// Use default config (suppressErrors: false)
		await api.shutdown();
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hooks: true
			// suppressErrors: false (default)
		});

		api.hooks.on(
			"always",
			({ path, result, hasError, errors, self, context }) => {
				alwaysContext = { path, result, hasError, errors, self, context };
			},
			{ id: "observe-execution", pattern: "math.divide" }
		);

		let caughtError = null;
		try {
			await api.math.divide(10, 0);
		} catch (error) {
			caughtError = error;
		}

		expect(caughtError).not.toBeNull();
		expect(alwaysContext).not.toBeNull();
		expect(alwaysContext.hasError).toBe(true);
		expect(alwaysContext.errors).toHaveLength(1);
		expect(alwaysContext.errors[0]).toBe(caughtError);
	});

	test("should support metrics tracking with error rates", async () => {
		const metrics = {
			calls: 0,
			successes: 0,
			errors: 0
		};

		// Create new instance with suppressErrors for this test
		await api.shutdown();
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hooks: {
				enabled: true,
				suppressErrors: true
			}
		});

		api.hooks.on(
			"always",
			({ hasError }) => {
				metrics.calls++;
				if (hasError) {
					metrics.errors++;
				} else {
					metrics.successes++;
				}
			},
			{ id: "metrics-tracker", pattern: "**" }
		);

		// Execute various operations
		await api.math.add(2, 3); // success
		await api.math.multiply(4, 5); // success
		await api.math.divide(10, 0); // error
		await api.math.add(7, 8); // success
		await api.math.divide(20, 0); // error

		expect(metrics.calls).toBe(5);
		expect(metrics.successes).toBe(3);
		expect(metrics.errors).toBe(2);

		const errorRate = (metrics.errors / metrics.calls) * 100;
		expect(errorRate).toBe(40);
	});

	test("should support error correlation tracking", async () => {
		const errorLog = [];

		// Create new instance with suppressErrors for this test
		await api.shutdown();
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hooks: {
				enabled: true,
				suppressErrors: true
			}
		});

		api.hooks.on(
			"always",
			({ path, hasError, errors }) => {
				if (hasError) {
					errorLog.push({
						path: path,
						timestamp: Date.now(),
						errorTypes: errors.map((e) => e.constructor.name),
						errorMessages: errors.map((e) => e.message)
					});
				}
			},
			{ id: "error-correlator", pattern: "**" }
		);

		// Generate some errors
		await api.math.divide(10, 0);
		await api.math.divide(20, 0);

		expect(errorLog).toHaveLength(2);
		expect(errorLog[0].path).toBe("math.divide");
		expect(errorLog[1].path).toBe("math.divide");
		expect(errorLog[0].errorTypes[0]).toBe("Error");
		expect(errorLog[0].errorMessages[0]).toContain("divide by zero");
	});
});
