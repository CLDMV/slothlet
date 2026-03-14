/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hooks-short-circuit.test.vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:50 -08:00 (1772425310)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

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

describe.each(getMatrixConfigs({ hook: { enabled: true } }))("Hooks Short Circuit > Config: '$name'", ({ config }) => {
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

	test("should support before hook short-circuit with number", async () => {
		let functionCalled = false;
		let shortCircuitExecuted = false;

		api.slothlet.hook.on(
			"after:math.add",
			() => { functionCalled = true;
			},
			{ id: "detect-call" }
		);

		api.slothlet.hook.on(
			"before:math.add",
			() => { shortCircuitExecuted = true;
				return 42;
			},
			{ id: "short-circuit", priority: 200 }
		);

		const result = await api.math.add(2, 3);

		expect(shortCircuitExecuted).toBe(true);
		expect(functionCalled).toBe(false);
		expect(result).toBe(42);
	});

	test("should support before hook short-circuit with object", async () => {
		const shortCircuitValue = { data: "bypassed", computed: true };

		api.slothlet.hook.on("before:math.add", () => shortCircuitValue, { id: "short-circuit-obj",
			priority: 200 });

		const result = await api.math.add(2, 3);
		expect(result).toEqual(shortCircuitValue);
	});

	test("should support before hook short-circuit with string", async () => {
		api.slothlet.hook.on("before:math.add", () => "intercepted", { id: "short-circuit-string",
			priority: 200 });

		const result = await api.math.add(2, 3);
		expect(result).toBe("intercepted");
	});

	test("should support before hook short-circuit with null", async () => {
		api.slothlet.hook.on("before:math.add", () => null, { id: "short-circuit-null",
			priority: 200 });

		const result = await api.math.add(2, 3);
		expect(result).toBeNull();
	});

	test("should support before hook short-circuit with 0", async () => {
		api.slothlet.hook.on("before:math.add", () => 0, { id: "short-circuit-zero", priority: 200 });

		const result = await api.math.add(2, 3);
		expect(result).toBe(0);
	});

	test("should support before hook short-circuit with false", async () => {
		api.slothlet.hook.on("before:math.add", () => false, { id: "short-circuit-false",
			priority: 200 });

		const result = await api.math.add(2, 3);
		expect(result).toBe(false);
	});

	test("should execute always hooks after short-circuit", async () => {
		let alwaysExecuted = false;

		api.slothlet.hook.on("before:math.add", () => 99, { id: "short-circuit", priority: 200 });

		api.slothlet.hook.on(
			"always:math.add",
			({ result }) => {
				alwaysExecuted = true;
				expect(result).toBe(99);
			},
			{ id: "always-hook" }
		);

		await api.math.add(2, 3);
		expect(alwaysExecuted).toBe(true);
	});

	test("should execute always hooks after normal completion", async () => {
		let alwaysExecuted = false;

		api.slothlet.hook.on(
			"always:math.add",
			({ result }) => {
				alwaysExecuted = true;
				expect(result).toBe(5);
			},
			{ id: "always-hook" }
		);

		await api.math.add(2, 3);
		expect(alwaysExecuted).toBe(true);
	});

	test("should not allow always hooks to modify result", async () => {
		api.slothlet.hook.on(
			"always:math.add",
			() => { return 999;
			},
			{ id: "always-attempt-modify" }
		);

		const result = await api.math.add(2, 3);
		expect(result).toBe(5);
	});
});
