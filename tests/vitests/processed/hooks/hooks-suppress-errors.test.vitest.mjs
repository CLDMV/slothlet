/**
 * @fileoverview Validates hook suppressErrors behavior across hook-enabled matrix configs.
 *
 * Original test: tests/test-hooks-suppress-errors.mjs
 * @module tests/vitests/processed/hooks/hooks-suppress-errors.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const describe_each_matrix = getMatrixConfigs({ hooks: true });

describe.each(describe_each_matrix)("Hooks Suppress Errors > Config: '$name'", ({ config }) => {
	let api;

	/**
	 * Creates a slothlet instance for the current matrix config with hook overrides.
	 * @param {object} hooksConfig - Hook configuration overrides.
	 * @returns {Promise<object>} Bound API instance.
	 */
	async function createApi(hooksConfig = {}) {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hooks: { enabled: true, pattern: "**", ...hooksConfig }
		});
		return api;
	}

	/**
	 * Registers an error hook that captures the latest error context.
	 * @returns {{flags: {called: boolean}, lastContext: {current: any}}}
	 */
	function registerErrorHook() {
		const flags = { called: false };
		const lastContext = { current: null };
		api.hooks.on(
			"error",
			(errorContext) => {
				flags.called = true;
				lastContext.current = errorContext;
			},
			{ id: "error-monitor", pattern: "**" }
		);
		return { flags, lastContext };
	}

	afterEach(async () => {
		if (api?.shutdown) {
			try {
				await api.shutdown();
			} catch {
				// Ignore shutdown errors during cleanup
			}
		}
		api = null;
	});

	it("throws errors when suppressErrors is false", async () => {
		await createApi({ suppressErrors: false });

		const { flags } = registerErrorHook();

		api.hooks.on(
			"before",
			() => {
				throw new Error("Before hook failed");
			},
			{ id: "failing-before", pattern: "math.add" }
		);

		await expect(async () => await api.math.add(2, 3)).rejects.toThrow("Before hook failed");
		expect(flags.called).toBe(true);
	});

	it("suppresses before hook errors when enabled", async () => {
		await createApi({ suppressErrors: true });

		const { flags, lastContext } = registerErrorHook();

		api.hooks.on(
			"before",
			() => {
				throw new Error("Before hook failed");
			},
			{ id: "failing-before", pattern: "math.add" }
		);

		const result = await api.math.add(2, 3);

		expect(result).toBeUndefined();
		expect(flags.called).toBe(true);
		expect(lastContext.current?.source?.type).toBe("before");
		expect(lastContext.current?.error?.message).toBe("Before hook failed");
	});

	it("suppresses function errors when enabled", async () => {
		await createApi({ suppressErrors: true });

		const { flags, lastContext } = registerErrorHook();

		api.hooks.on(
			"before",
			() => {
				throw new Error("Function execution failed");
			},
			{ id: "inject-error", pattern: "math.multiply" }
		);

		const result = await api.math.multiply(3, 4);

		expect(result).toBeUndefined();
		expect(flags.called).toBe(true);
		expect(lastContext.current?.error?.message).toBe("Function execution failed");
	});

	it("suppresses after hook errors when enabled", async () => {
		await createApi({ suppressErrors: true });

		const { flags, lastContext } = registerErrorHook();

		api.hooks.on(
			"after",
			() => {
				throw new Error("After hook failed");
			},
			{ id: "failing-after", pattern: "math.add" }
		);

		const result = await api.math.add(2, 3);

		expect(result).toBeUndefined();
		expect(flags.called).toBe(true);
		expect(lastContext.current?.source?.type).toBe("after");
		expect(lastContext.current?.error?.message).toBe("After hook failed");
	});

	it("does not throw for always hook errors when suppressErrors is enabled", async () => {
		await createApi({ suppressErrors: true });

		const { flags } = registerErrorHook();

		api.hooks.on(
			"always",
			() => {
				throw new Error("Always hook failed");
			},
			{ id: "failing-always", pattern: "math.add" }
		);

		const result = await api.math.add(2, 3);

		expect(result).toBe(5);
		expect(flags.called).toBe(true);
	});

	it("returns actual result when no errors occur under suppression", async () => {
		await createApi({ suppressErrors: true });

		const result = await api.math.add(10, 20);
		expect(result).toBe(30);
	});

	it("suppresses failures while allowing other calls to succeed", async () => {
		await createApi({ suppressErrors: true });

		const errors = [];

		api.hooks.on(
			"error",
			(context) => {
				errors.push({ path: context.path, message: context.error.message });
			},
			{ id: "error-collector", pattern: "**" }
		);

		api.hooks.on(
			"before",
			({ path }) => {
				if (path === "math.add") {
					throw new Error("Add failed");
				}
			},
			{ id: "fail-add", pattern: "**" }
		);

		const result1 = await api.math.add(2, 3);
		const result2 = await api.math.multiply(2, 3);

		expect(result1).toBeUndefined();
		expect(result2).toBe(6);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toEqual({ path: "math.add", message: "Add failed" });
	});

	it("respects hooks enable/disable toggling with suppressErrors", async () => {
		await createApi({ suppressErrors: true });

		api.hooks.on(
			"before",
			() => {
				throw new Error("Test");
			},
			{ id: "fail", pattern: "**" }
		);

		const suppressed = await api.math.add(1, 2);
		expect(suppressed).toBeUndefined();

		api.hooks.disable();
		const normal = await api.math.add(1, 2);
		expect(normal).toBe(3);

		api.hooks.enable();
		const suppressedAgain = await api.math.add(1, 2);
		expect(suppressedAgain).toBeUndefined();
	});

	it("delivers errors to multiple error hooks when suppressed", async () => {
		await createApi({ suppressErrors: true });

		const flags = { all: [] };

		api.hooks.on(
			"error",
			() => {
				flags.all.push("h1");
			},
			{ id: "error1", pattern: "**" }
		);
		api.hooks.on(
			"error",
			() => {
				flags.all.push("h2");
			},
			{ id: "error2", pattern: "math.*" }
		);
		api.hooks.on(
			"error",
			() => {
				flags.all.push("h3");
			},
			{ id: "error3", pattern: "math.add" }
		);

		api.hooks.on(
			"before",
			() => {
				throw new Error("Test");
			},
			{ id: "fail", pattern: "math.add" }
		);

		const result = await api.math.add(1, 2);

		expect(result).toBeUndefined();
		expect(flags.all.sort()).toEqual(["h1", "h2", "h3"]);
	});
});
