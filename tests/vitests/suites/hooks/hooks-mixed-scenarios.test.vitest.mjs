/**
 * @fileoverview Vitest tests for complex mixed hook scenarios.
 * @module tests/vitests/processed/hooks/hooks-mixed-scenarios.test.vitest
 *
 * @description
 * Tests for complex interactions between hooks:
 * - Before + after chaining
 * - Mixed modifications with short-circuit
 * - Error handling
 * - Runtime enable/disable
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs({ hook: { enabled: true } }))("Hooks Mixed Scenarios > Config: '$name'", ({ config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;

		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			collision: { initial: "replace", api: "replace" } // Use folder version, ignore file collisions
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		slothlet = null;
	});

	test("should catch errors in before hooks with error handlers", async () => {
		let errorCaught = false;

		await api.shutdown();
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hook: {
				enabled: true,
				suppressErrors: true
			},
			collision: { initial: "replace", api: "replace" } // Use folder version, ignore file collisions
		});

		api.slothlet.hook.on(
			"before:math.add",
			() => {
				throw new Error("Before hook error");
			},
			{ id: "error-hook", priority: 200 }
		);

		api.slothlet.hook.on(
			"error:math.add",
			({ error }) => {
				errorCaught = true;
				expect(error.message).toBe("Before hook error");
			},
			{ id: "error-handler" }
		);

		const result = await api.math.add(2, 3);

		expect(errorCaught).toBe(true);
		expect(result).toBeUndefined();
	});

	test("should execute multiple error hooks", async () => {
		const errorHandlers = [];

		await api.shutdown();
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hook: {
				enabled: true,
				suppressErrors: true
			},
			collision: { initial: "replace", api: "replace" } // Use folder version, ignore file collisions
		});

		api.slothlet.hook.on(
			"before:math.add",
			() => {
				throw new Error("Test error");
			},
			{ id: "error-hook" }
		);

		for (let i = 0; i < 3; i++) {
			api.slothlet.hook.on(
				"error:math.add",
				() => {
					errorHandlers.push(i);
				},
				{ id: `error-handler-${i}`, priority: 100 - i * 10 }
			);
		}

		await api.math.add(2, 3);

		expect(errorHandlers).toHaveLength(3);
		expect(errorHandlers).toEqual([0, 1, 2]);
	});

	test("should handle mixed scenario: args modified, short-circuit, result transformed", async () => {
		api.slothlet.hook.on("before:math.add", ({ args }) => [args[0] * 2, args[1] * 2], { id: "modify-args", priority: 300 });

		api.slothlet.hook.on("before:math.add", ({ args }) => args[0] + args[1] + 100, { id: "short-circuit", priority: 200 });

		api.slothlet.hook.on("after:math.add", ({ result }) => result * 10, { id: "transform-result", priority: 100 });

		const result = await api.math.add(1, 2);
		expect(result).toBe(106);
	});

	test("should handle before hooks modifying args with after hooks chaining transforms", async () => {
		api.slothlet.hook.on("before:math.add", ({ args }) => [args[0] * 3, args[1] * 3], { id: "multiply-args", priority: 200 });

		api.slothlet.hook.on("after:math.add", ({ result }) => result * 2, { id: "double-result", priority: 200 });

		api.slothlet.hook.on("after:math.add", ({ result }) => result + 10, { id: "add-ten", priority: 100 });

		const result = await api.math.add(2, 3);
		expect(result).toBe(40);
	});

	test("should work with hooks disabled initially", async () => {
		await api.shutdown();
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hook: {
				enabled: false
			},
			collision: { initial: "replace", api: "replace" } // Use folder version, ignore file collisions
		});

		let hookExecuted = false;

		api.slothlet.hook.on(
			"before:math.add",
			() => {
				hookExecuted = true;
			},
			{ id: "test-hook" }
		);

		const result = await api.math.add(2, 3);

		expect(hookExecuted).toBe(false);
		expect(result).toBe(5);
	});

	test("should allow re-enabling hooks at runtime", async () => {
		await api.shutdown();
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hook: {
				enabled: false
			},
			collision: { initial: "replace", api: "replace" } // Use folder version, ignore file collisions
		});

		let hookExecuted = false;

		api.slothlet.hook.on(
			"before:math.add",
			() => {
				hookExecuted = true;
				return 42;
			},
			{ id: "test-hook" }
		);

		let result = await api.math.add(2, 3);
		expect(hookExecuted).toBe(false);
		expect(result).toBe(5);

		api.slothlet.hook.enable();
		hookExecuted = false;

		result = await api.math.add(2, 3);
		expect(hookExecuted).toBe(true);
		expect(result).toBe(42);
	});

	test("should support pattern-specific hook enabling", async () => {
		api.slothlet.hook.on(
			"before:math.*",
			({ args }) => {
				return [args[0] * 10, args[1] * 10];
			},
			{ id: "pattern-test", priority: 100 }
		);

		api.slothlet.hook.disable();
		api.slothlet.hook.enable("math.*");

		const result = await api.math.add(2, 3);
		expect(result).toBe(50);
	});
});
