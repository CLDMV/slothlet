/**
 * @fileoverview Vitest tests for hook short-circuit scenarios.
 * @module tests/vitests/processed/hooks/hooks-short-circuit.test.vitest
 *
 * @description
 * Tests for before hook short-circuit behavior with different value types:
 * - Number, string, object, null, 0, false
 * - Always hook execution after short-circuit
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs({ hooks: true }))("Hooks Short Circuit > Config: '$name'", ({ config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;

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

	test("should support before hook short-circuit with number", async () => {
		let functionCalled = false;
		let shortCircuitExecuted = false;

		api.hooks.on(
			"after",
			() => {
				functionCalled = true;
			},
			{ id: "detect-call", pattern: "math.add" }
		);

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

		api.hooks.on("before", () => 99, { id: "short-circuit", priority: 200, pattern: "math.add" });

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
				return 999;
			},
			{ id: "always-attempt-modify", pattern: "math.add" }
		);

		const result = await api.math.add(2, 3);
		expect(result).toBe(5);
	});
});
