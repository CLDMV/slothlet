/**
 * @fileoverview Vitest tests for comprehensive hook system scenarios.
 * @module tests/vitests/hooks-comprehensive
 *
 * @description
 * Exhaustive tests for hook system edge cases and advanced scenarios following
 * actual HookManager API: handler receives { path, args } or { path, result }.
 *
 * Tests cover:
 * - Multiple before hooks chaining argument modifications
 * - Multiple after hooks chaining result transformations
 * - Short-circuit verification with different value types
 * - Complex argument/result transformations
 * - Error handling in hook chains
 * - All mode/runtime combinations
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "./vitest-helper.mjs";

// Test each configuration in the matrix
describe.each(getMatrixConfigs({ hooks: true }))("Hooks Comprehensive > Config: '$name'", ({ config }) => {
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

	test("should chain multiple before hooks for argument modifications (primitives)", async () => {
		const modifications = [];

		// Hook 1: Double the first argument (priority 300)
		api.hooks.on(
			"before",
			({ args }) => {
				modifications.push("hook1");
				return [args[0] * 2, args[1]];
			},
			{ id: "hook1-double", priority: 300, pattern: "math.add" }
		);

		// Hook 2: Add 10 to second argument (priority 200)
		api.hooks.on(
			"before",
			({ args }) => {
				modifications.push("hook2");
				return [args[0], args[1] + 10];
			},
			{ id: "hook2-add10", priority: 200, pattern: "math.add" }
		);

		// Hook 3: Swap arguments (priority 100)
		api.hooks.on(
			"before",
			({ args }) => {
				modifications.push("hook3");
				return [args[1], args[0]];
			},
			{ id: "hook3-swap", priority: 100, pattern: "math.add" }
		);

		// Call with (2, 3)
		// After hook1: (4, 3)
		// After hook2: (4, 13)
		// After hook3: (13, 4)
		// Result: 13 + 4 = 17
		const result = await api.math.add(2, 3);

		expect(modifications).toHaveLength(3);
		expect(modifications[0]).toBe("hook1");
		expect(modifications[1]).toBe("hook2");
		expect(modifications[2]).toBe("hook3");
		expect(result).toBe(17);
	});

	test("should chain multiple before hooks for argument modifications (objects)", async () => {
		// Hook 1: Add property 'a'
		api.hooks.on(
			"before",
			({ args }) => {
				if (typeof args[0] === "object") {
					return [{ ...args[0], a: 1 }, ...args.slice(1)];
				}
				return undefined;
			},
			{ id: "add-a", priority: 300, pattern: "**" }
		);

		// Hook 2: Add property 'b'
		api.hooks.on(
			"before",
			({ args }) => {
				if (typeof args[0] === "object") {
					return [{ ...args[0], b: 2 }, ...args.slice(1)];
				}
				return undefined;
			},
			{ id: "add-b", priority: 200, pattern: "**" }
		);

		// Hook 3: Add property 'c'
		api.hooks.on(
			"before",
			({ args }) => {
				if (typeof args[0] === "object") {
					return [{ ...args[0], c: 3 }, ...args.slice(1)];
				}
				return undefined;
			},
			{ id: "add-c", priority: 100, pattern: "**" }
		);

		// Hook 4: Verify all properties (priority 50)
		let verified = false;
		api.hooks.on(
			"before",
			({ args }) => {
				if (typeof args[0] === "object") {
					verified = args[0].a === 1 && args[0].b === 2 && args[0].c === 3;
				}
			},
			{ id: "verify", priority: 50, pattern: "**" }
		);

		await api.math.add({ original: true }, 5);

		expect(verified).toBe(true);
	});

	test("should modify args through 5 hooks in sequence", async () => {
		// Create 5 hooks that each multiply by 2
		for (let i = 0; i < 5; i++) {
			api.hooks.on("before", ({ args }) => [args[0] * 2, args[1]], {
				id: `multiply-hook-${i}`,
				priority: 500 - i * 100,
				pattern: "math.add"
			});
		}

		// 1 * 2^5 = 32
		const result = await api.math.add(1, 0);
		expect(result).toBe(32);
	});

	test("should chain multiple after hooks for result transformations (primitives)", async () => {
		const transformations = [];

		// Hook 1: Double result (priority 300)
		api.hooks.on(
			"after",
			({ result }) => {
				transformations.push("hook1");
				return result * 2;
			},
			{ id: "hook1-double", priority: 300, pattern: "math.add" }
		);

		// Hook 2: Add 10 (priority 200)
		api.hooks.on(
			"after",
			({ result }) => {
				transformations.push("hook2");
				return result + 10;
			},
			{ id: "hook2-add10", priority: 200, pattern: "math.add" }
		);

		// Hook 3: Negate (priority 100)
		api.hooks.on(
			"after",
			({ result }) => {
				transformations.push("hook3");
				return -result;
			},
			{ id: "hook3-negate", priority: 100, pattern: "math.add" }
		);

		// Call 2 + 3 = 5
		// After hook1: 10
		// After hook2: 20
		// After hook3: -20
		const result = await api.math.add(2, 3);

		expect(transformations).toHaveLength(3);
		expect(transformations[0]).toBe("hook1");
		expect(transformations[1]).toBe("hook2");
		expect(transformations[2]).toBe("hook3");
		expect(result).toBe(-20);
	});

	test("should chain multiple after hooks for result transformations (objects)", async () => {
		// Hook 1: Wrap in object
		api.hooks.on("after", ({ result }) => ({ value: result }), {
			id: "wrap-result",
			priority: 300,
			pattern: "math.add"
		});

		// Hook 2: Add metadata
		api.hooks.on("after", ({ result }) => ({ ...result, meta: "processed" }), {
			id: "add-metadata",
			priority: 200,
			pattern: "math.add"
		});

		// Hook 3: Add timestamp
		api.hooks.on("after", ({ result }) => ({ ...result, timestamp: Date.now() }), {
			id: "add-timestamp",
			priority: 100,
			pattern: "math.add"
		});

		const result = await api.math.add(2, 3);

		expect(result.value).toBe(5);
		expect(result.meta).toBe("processed");
		expect(typeof result.timestamp).toBe("number");
	});

	test("should transform result through 5 hooks in sequence", async () => {
		// Create 5 hooks that each multiply by 2
		for (let i = 0; i < 5; i++) {
			api.hooks.on("after", ({ result }) => result * 2, {
				id: `transform-hook-${i}`,
				priority: 500 - i * 100,
				pattern: "math.add"
			});
		}

		// 5 * 2^5 = 160
		const result = await api.math.add(2, 3);
		expect(result).toBe(160);
	});

	test("should support before hook short-circuit with number", async () => {
		let functionCalled = false;
		let shortCircuitExecuted = false;

		// Hook to detect if function was called
		api.hooks.on(
			"after",
			() => {
				functionCalled = true;
			},
			{ id: "detect-call", pattern: "math.add" }
		);

		// Short-circuit hook
		api.hooks.on(
			"before",
			() => {
				shortCircuitExecuted = true;
				return 42;
			},
			{ id: "short-circuit", priority: 200, pattern: "math.add" }
		);

		const result = await api.math.add(2, 3);

		expect(shortCircuitExecuted).toBe(true);
		expect(functionCalled).toBe(false);
		expect(result).toBe(42);
	});

	test("should support before hook short-circuit with object", async () => {
		const shortCircuitValue = { data: "bypassed", computed: true };

		api.hooks.on("before", () => shortCircuitValue, {
			id: "short-circuit-obj",
			priority: 200,
			pattern: "math.add"
		});

		const result = await api.math.add(2, 3);
		expect(result).toEqual(shortCircuitValue);
	});

	test("should support before hook short-circuit with string", async () => {
		api.hooks.on("before", () => "intercepted", {
			id: "short-circuit-string",
			priority: 200,
			pattern: "math.add"
		});

		const result = await api.math.add(2, 3);
		expect(result).toBe("intercepted");
	});

	test("should support before hook short-circuit with null", async () => {
		api.hooks.on("before", () => null, {
			id: "short-circuit-null",
			priority: 200,
			pattern: "math.add"
		});

		const result = await api.math.add(2, 3);
		expect(result).toBeNull();
	});

	test("should support before hook short-circuit with 0", async () => {
		api.hooks.on("before", () => 0, { id: "short-circuit-zero", priority: 200, pattern: "math.add" });

		const result = await api.math.add(2, 3);
		expect(result).toBe(0);
	});

	test("should support before hook short-circuit with false", async () => {
		api.hooks.on("before", () => false, {
			id: "short-circuit-false",
			priority: 200,
			pattern: "math.add"
		});

		const result = await api.math.add(2, 3);
		expect(result).toBe(false);
	});

	test("should execute always hooks after short-circuit", async () => {
		let alwaysExecuted = false;

		// Short-circuit hook
		api.hooks.on("before", () => 99, { id: "short-circuit", priority: 200, pattern: "math.add" });

		// Always hook
		api.hooks.on(
			"always",
			({ result }) => {
				alwaysExecuted = true;
				expect(result).toBe(99);
			},
			{ id: "always-hook", pattern: "math.add" }
		);

		await api.math.add(2, 3);
		expect(alwaysExecuted).toBe(true);
	});

	test("should execute always hooks after normal completion", async () => {
		let alwaysExecuted = false;

		api.hooks.on(
			"always",
			({ result }) => {
				alwaysExecuted = true;
				expect(result).toBe(5);
			},
			{ id: "always-hook", pattern: "math.add" }
		);

		await api.math.add(2, 3);
		expect(alwaysExecuted).toBe(true);
	});

	test("should not allow always hooks to modify result", async () => {
		api.hooks.on(
			"always",
			() => {
				return 999; // This should be ignored
			},
			{ id: "always-attempt-modify", pattern: "math.add" }
		);

		const result = await api.math.add(2, 3);
		expect(result).toBe(5); // Original result preserved
	});

	test("should catch errors in before hooks with error handlers", async () => {
		let errorCaught = false;

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

		// Error-throwing before hook
		api.hooks.on(
			"before",
			() => {
				throw new Error("Before hook error");
			},
			{ id: "error-hook", priority: 200, pattern: "math.add" }
		);

		// Error handler
		api.hooks.on(
			"error",
			({ error }) => {
				errorCaught = true;
				expect(error.message).toBe("Before hook error");
			},
			{ id: "error-handler", pattern: "math.add" }
		);

		const result = await api.math.add(2, 3);

		expect(errorCaught).toBe(true);
		expect(result).toBeUndefined();
	});

	test("should execute multiple error hooks", async () => {
		const errorHandlers = [];

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

		// Error-throwing before hook
		api.hooks.on(
			"before",
			() => {
				throw new Error("Test error");
			},
			{ id: "error-hook", pattern: "math.add" }
		);

		// Multiple error handlers
		for (let i = 0; i < 3; i++) {
			api.hooks.on(
				"error",
				() => {
					errorHandlers.push(i);
				},
				{ id: `error-handler-${i}`, pattern: "math.add", priority: 100 - i * 10 }
			);
		}

		await api.math.add(2, 3);

		expect(errorHandlers).toHaveLength(3);
		expect(errorHandlers).toEqual([0, 1, 2]);
	});

	test("should handle mixed scenario: args modified, short-circuit, result transformed", async () => {
		// Modify args first
		api.hooks.on("before", ({ args }) => [args[0] * 2, args[1] * 2], {
			id: "modify-args",
			priority: 300,
			pattern: "math.add"
		});

		// Short-circuit with modified args
		api.hooks.on(
			"before",
			({ args }) => args[0] + args[1] + 100, // Should use modified args
			{ id: "short-circuit", priority: 200, pattern: "math.add" }
		);

		// After hook (won't execute due to short-circuit)
		api.hooks.on("after", ({ result }) => result * 10, {
			id: "transform-result",
			priority: 100,
			pattern: "math.add"
		});

		// Call with (1, 2)
		// After modify-args: (2, 4)
		// Short-circuit returns: 2 + 4 + 100 = 106
		const result = await api.math.add(1, 2);
		expect(result).toBe(106);
	});

	test("should handle before hooks modifying args with after hooks chaining transforms", async () => {
		// Before hook: multiply args
		api.hooks.on("before", ({ args }) => [args[0] * 3, args[1] * 3], {
			id: "multiply-args",
			priority: 200,
			pattern: "math.add"
		});

		// After hook 1: double result
		api.hooks.on("after", ({ result }) => result * 2, {
			id: "double-result",
			priority: 200,
			pattern: "math.add"
		});

		// After hook 2: add 10
		api.hooks.on("after", ({ result }) => result + 10, { id: "add-ten", priority: 100, pattern: "math.add" });

		// Call with (2, 3)
		// After multiply-args: (6, 9)
		// Function result: 15
		// After double-result: 30
		// After add-ten: 40
		const result = await api.math.add(2, 3);
		expect(result).toBe(40);
	});

	test("should work with hooks disabled initially", async () => {
		// Create new instance with hooks disabled
		await api.shutdown();
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hooks: {
				enabled: false
			}
		});

		let hookExecuted = false;

		api.hooks.on(
			"before",
			() => {
				hookExecuted = true;
			},
			{ id: "test-hook", pattern: "math.add" }
		);

		const result = await api.math.add(2, 3);

		expect(hookExecuted).toBe(false);
		expect(result).toBe(5); // Normal function result
	});

	test("should allow re-enabling hooks at runtime", async () => {
		// Create new instance with hooks disabled
		await api.shutdown();
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hooks: {
				enabled: false
			}
		});

		let hookExecuted = false;

		api.hooks.on(
			"before",
			() => {
				hookExecuted = true;
				return 42;
			},
			{ id: "test-hook", pattern: "math.add" }
		);

		// Hooks disabled
		let result = await api.math.add(2, 3);
		expect(hookExecuted).toBe(false);
		expect(result).toBe(5);

		// Enable hooks using the correct API
		api.hooks.enable();
		hookExecuted = false;

		// Hooks enabled
		result = await api.math.add(2, 3);
		expect(hookExecuted).toBe(true);
		expect(result).toBe(42);
	});

	test("should support pattern-specific hook enabling", async () => {
		api.hooks.on(
			"before",
			({ args }) => {
				return [args[0] * 10, args[1] * 10];
			},
			{ id: "pattern-test", priority: 100, pattern: "math.*" }
		);

		// Disable all hooks first
		api.hooks.disable();

		// Enable only math.* pattern
		api.hooks.enable("math.*");

		// Should work since pattern is enabled
		// (2 * 10) + (3 * 10) = 50
		const result = await api.math.add(2, 3);
		expect(result).toBe(50);
	});
});
