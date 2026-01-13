/**
 * @fileoverview Vitest tests for before hook chaining scenarios.
 * @module tests/vitests/processed/hooks/hooks-before-chaining.test.vitest
 *
 * @description
 * Tests for before hooks chaining argument modifications:
 * - Primitive argument modifications
 * - Object argument modifications
 * - Sequential hook execution
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs({ hooks: true }))("Hooks Before Chaining > Config: '$name'", ({ config }) => {
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

	test("should chain multiple before hooks for argument modifications (primitives)", async () => {
		const modifications = [];

		api.hooks.on(
			"before",
			({ args }) => {
				modifications.push("hook1");
				return [args[0] * 2, args[1]];
			},
			{ id: "hook1-double", priority: 300, pattern: "math.add" }
		);

		api.hooks.on(
			"before",
			({ args }) => {
				modifications.push("hook2");
				return [args[0], args[1] + 10];
			},
			{ id: "hook2-add10", priority: 200, pattern: "math.add" }
		);

		api.hooks.on(
			"before",
			({ args }) => {
				modifications.push("hook3");
				return [args[1], args[0]];
			},
			{ id: "hook3-swap", priority: 100, pattern: "math.add" }
		);

		const result = await api.math.add(2, 3);

		expect(modifications).toHaveLength(3);
		expect(modifications[0]).toBe("hook1");
		expect(modifications[1]).toBe("hook2");
		expect(modifications[2]).toBe("hook3");
		expect(result).toBe(17);
	});

	test("should chain multiple before hooks for argument modifications (objects)", async () => {
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
		for (let i = 0; i < 5; i++) {
			api.hooks.on("before", ({ args }) => [args[0] * 2, args[1]], {
				id: `multiply-hook-${i}`,
				priority: 500 - i * 100,
				pattern: "math.add"
			});
		}

		const result = await api.math.add(1, 0);
		expect(result).toBe(32);
	});
});
