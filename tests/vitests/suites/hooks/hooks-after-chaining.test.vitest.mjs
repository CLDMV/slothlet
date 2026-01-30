/**
 * @fileoverview Vitest tests for after hook chaining scenarios.
 * @module tests/vitests/processed/hooks/hooks-after-chaining.test.vitest
 *
 * @description
 * Tests for after hooks chaining result transformations:
 * - Primitive result transformations
 * - Object result transformations
 * - Sequential hook execution
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs({ hook: { enabled: true } }))("Hooks After Chaining > Config: '$name'", ({ config }) => {
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

	test("should chain multiple after hooks for result transformations (primitives)", async () => {
		const transformations = [];

		api.slothlet.hook.on(
			"after:math.add",
			({ result }) => {
				transformations.push("hook1");
				return result * 2;
			},
			{ id: "hook1-double", priority: 300 }
		);

		api.slothlet.hook.on(
			"after:math.add",
			({ result }) => {
				transformations.push("hook2");
				return result + 10;
			},
			{ id: "hook2-add10", priority: 200 }
		);

		api.slothlet.hook.on(
			"after:math.add",
			({ result }) => {
				transformations.push("hook3");
				return -result;
			},
			{ id: "hook3-negate", priority: 100 }
		);

		const result = await api.math.add(2, 3);

		expect(transformations).toHaveLength(3);
		expect(transformations[0]).toBe("hook1");
		expect(transformations[1]).toBe("hook2");
		expect(transformations[2]).toBe("hook3");
		expect(result).toBe(-20);
	});

	test("should chain multiple after hooks for result transformations (objects)", async () => {
		api.slothlet.hook.on("after:math.add", ({ result }) => ({ value: result }), { id: "wrap-result", priority: 300 });

		api.slothlet.hook.on("after:math.add", ({ result }) => ({ ...result, meta: "processed" }), { id: "add-metadata", priority: 200 });

		api.slothlet.hook.on("after:math.add", ({ result }) => ({ ...result, timestamp: Date.now() }), { id: "add-timestamp", priority: 100 });

		const result = await api.math.add(2, 3);

		expect(result.value).toBe(5);
		expect(result.meta).toBe("processed");
		expect(typeof result.timestamp).toBe("number");
	});

	test("should transform result through 5 hooks in sequence", async () => {
		for (let i = 0; i < 5; i++) {
			api.slothlet.hook.on("after:math.add", ({ result }) => result * 2, {
				id: `transform-hook-${i}`,
				priority: 500 - i * 100
			});
		}

		const result = await api.math.add(2, 3);
		expect(result).toBe(160);
	});
});
