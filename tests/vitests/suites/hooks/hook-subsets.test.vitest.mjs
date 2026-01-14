/**
 * @fileoverview Hook subset system comprehensive test coverage using vitest matrix.
 *
 * @description
 * Tests hook subset execution order (before → primary → after) across all hook types.
 * Verifies that within each subset, priority and registration order are respected.
 *
 * @module tests/vitests/suites/hooks/hook-subsets.test.vitest
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Create a slothlet API instance for a given configuration.
 * @param {object} baseConfig - Base configuration from the matrix.
 * @param {object} [overrides] - Additional overrides for the slothlet config.
 * @returns {Promise<object>} Initialized slothlet API instance.
 */
async function createApiInstance(baseConfig, overrides = {}) {
	return slothlet({ ...baseConfig, ...overrides });
}

// All configurations with hooks enabled
const HOOK_SUBSET_MATRIX = getMatrixConfigs({ hooks: true }).map(({ name, config }) => ({
	name,
	config: { ...config, dir: TEST_DIRS.API_TEST }
}));

describe.each(HOOK_SUBSET_MATRIX)("Hook Subsets - $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
	});

	it("debug: check hook configuration", async () => {
		api = await createApiInstance(config);
		console.log("Config:", config);
		console.log("HookManager enabled (__ctx):", api.__ctx?.hookManager?.enabled);
		console.log("Hooks API available:", !!api.hooks);
		console.log("math.add has __slothletPath:", !!api.math.add.__slothletPath);
		console.log("math.add.__slothletPath:", api.math.add.__slothletPath);
		expect(api.hooks).toBeDefined();
	});

	describe("Before Hooks Subset Ordering", () => {
		it("executes subsets in order: before → primary → after", async () => {
			api = await createApiInstance(config);

			// Verify hooks are enabled
			expect(api.hooks).toBeDefined();
			expect(api.hooks.list).toBeTypeOf("function");

			const executionOrder = [];

			// Register hooks in reverse order to test sorting
			api.hooks.on(
				"before",
				({ args }) => {
					executionOrder.push("after-subset");
					return args;
				},
				{ subset: "after", priority: 1000 }
			);

			api.hooks.on(
				"before",
				({ args }) => {
					executionOrder.push("primary-subset");
					return args;
				},
				{ subset: "primary", priority: 1000 }
			);

			api.hooks.on(
				"before",
				({ args }) => {
					executionOrder.push("before-subset");
					return args;
				},
				{ subset: "before", priority: 1000 }
			);

			await api.math.add(2, 3);

			expect(executionOrder).toEqual(["before-subset", "primary-subset", "after-subset"]);
		});

		it("respects priority within each subset", async () => {
			api = await createApiInstance(config);

			const executionOrder = [];

			// Before subset with different priorities
			api.hooks.on(
				"before",
				() => {
					executionOrder.push("before-low");
				},
				{ subset: "before", priority: 100 }
			);
			api.hooks.on(
				"before",
				() => {
					executionOrder.push("before-high");
				},
				{ subset: "before", priority: 1000 }
			);

			// Primary subset with different priorities
			api.hooks.on(
				"before",
				() => {
					executionOrder.push("primary-low");
				},
				{ subset: "primary", priority: 100 }
			);
			api.hooks.on(
				"before",
				() => {
					executionOrder.push("primary-high");
				},
				{ subset: "primary", priority: 1000 }
			);

			// After subset with different priorities
			api.hooks.on(
				"before",
				() => {
					executionOrder.push("after-low");
				},
				{ subset: "after", priority: 100 }
			);
			api.hooks.on(
				"before",
				() => {
					executionOrder.push("after-high");
				},
				{ subset: "after", priority: 1000 }
			);

			await api.math.add(2, 3);

			expect(executionOrder).toEqual(["before-high", "before-low", "primary-high", "primary-low", "after-high", "after-low"]);
		});

		it("respects registration order within same subset and priority", async () => {
			api = await createApiInstance(config);

			const executionOrder = [];

			// All same subset and priority - should execute in registration order
			api.hooks.on(
				"before",
				() => {
					executionOrder.push("first");
				},
				{ subset: "primary", priority: 1000 }
			);
			api.hooks.on(
				"before",
				() => {
					executionOrder.push("second");
				},
				{ subset: "primary", priority: 1000 }
			);
			api.hooks.on(
				"before",
				() => {
					executionOrder.push("third");
				},
				{ subset: "primary", priority: 1000 }
			);

			await api.math.add(2, 3);

			expect(executionOrder).toEqual(["first", "second", "third"]);
		});

		it("defaults to primary subset when not specified", async () => {
			api = await createApiInstance(config);

			const executionOrder = [];

			api.hooks.on(
				"before",
				() => {
					executionOrder.push("before-subset");
				},
				{ subset: "before" }
			);
			api.hooks.on("before", () => {
				executionOrder.push("no-subset");
			}); // Should default to primary
			api.hooks.on(
				"before",
				() => {
					executionOrder.push("after-subset");
				},
				{ subset: "after" }
			);

			await api.math.add(2, 3);

			expect(executionOrder).toEqual(["before-subset", "no-subset", "after-subset"]);
		});

		it("allows argument modification across subsets", async () => {
			api = await createApiInstance(config);

			// Before subset: add 10 to first arg
			api.hooks.on(
				"before",
				({ args }) => {
					return [args[0] + 10, args[1]];
				},
				{ subset: "before" }
			);

			// Primary subset: multiply first arg by 2
			api.hooks.on(
				"before",
				({ args }) => {
					return [args[0] * 2, args[1]];
				},
				{ subset: "primary" }
			);

			// After subset: add 1 to first arg
			api.hooks.on(
				"before",
				({ args }) => {
					return [args[0] + 1, args[1]];
				},
				{ subset: "after" }
			);

			const result = await api.math.add(1, 5);

			// (1 + 10) * 2 + 1 = 23
			// 23 + 5 = 28
			expect(result).toBe(28);
		});

		it("short-circuits execution regardless of subset", async () => {
			api = await createApiInstance(config);

			const executionOrder = [];

			// Before subset hook short-circuits
			api.hooks.on(
				"before",
				() => {
					executionOrder.push("before-subset");
					return 999; // Short-circuit
				},
				{ subset: "before" }
			);

			// These should never execute
			api.hooks.on(
				"before",
				() => {
					executionOrder.push("primary-subset");
				},
				{ subset: "primary" }
			);
			api.hooks.on(
				"before",
				() => {
					executionOrder.push("after-subset");
				},
				{ subset: "after" }
			);

			const result = await api.math.add(2, 3);

			expect(result).toBe(999);
			expect(executionOrder).toEqual(["before-subset"]);
		});
	});

	describe("After Hooks Subset Ordering", () => {
		it("executes subsets in order: before → primary → after", async () => {
			api = await createApiInstance(config);

			const executionOrder = [];

			api.hooks.on(
				"after",
				({ result }) => {
					executionOrder.push("after-subset");
					return result;
				},
				{ subset: "after" }
			);

			api.hooks.on(
				"after",
				({ result }) => {
					executionOrder.push("primary-subset");
					return result;
				},
				{ subset: "primary" }
			);

			api.hooks.on(
				"after",
				({ result }) => {
					executionOrder.push("before-subset");
					return result;
				},
				{ subset: "before" }
			);

			await api.math.add(2, 3);

			expect(executionOrder).toEqual(["before-subset", "primary-subset", "after-subset"]);
		});

		it("chains result transformations across subsets", async () => {
			api = await createApiInstance(config);

			// Before subset: add 10
			api.hooks.on("after", ({ result }) => result + 10, { subset: "before" });

			// Primary subset: multiply by 2
			api.hooks.on("after", ({ result }) => result * 2, { subset: "primary" });

			// After subset: add 5
			api.hooks.on("after", ({ result }) => result + 5, { subset: "after" });

			const result = await api.math.add(1, 2);

			// (1 + 2) = 3
			// 3 + 10 = 13
			// 13 * 2 = 26
			// 26 + 5 = 31
			expect(result).toBe(31);
		});

		it("respects priority within subsets for result transformation", async () => {
			api = await createApiInstance(config);

			const executionOrder = [];

			// Before subset with different priorities
			api.hooks.on(
				"after",
				({ result }) => {
					executionOrder.push("before-high");
					return result + 1;
				},
				{ subset: "before", priority: 1000 }
			);

			api.hooks.on(
				"after",
				({ result }) => {
					executionOrder.push("before-low");
					return result + 2;
				},
				{ subset: "before", priority: 100 }
			);

			const result = await api.math.add(10, 0);

			// 10 + 1 = 11 (before-high)
			// 11 + 2 = 13 (before-low)
			expect(result).toBe(13);
			expect(executionOrder).toEqual(["before-high", "before-low"]);
		});
	});

	describe("Always Hooks Subset Ordering", () => {
		it("executes subsets in order: before → primary → after", async () => {
			api = await createApiInstance(config);

			const executionOrder = [];

			api.hooks.on(
				"always",
				() => {
					executionOrder.push("after-subset");
				},
				{ subset: "after" }
			);
			api.hooks.on(
				"always",
				() => {
					executionOrder.push("primary-subset");
				},
				{ subset: "primary" }
			);
			api.hooks.on(
				"always",
				() => {
					executionOrder.push("before-subset");
				},
				{ subset: "before" }
			);

			await api.math.add(2, 3);

			expect(executionOrder).toEqual(["before-subset", "primary-subset", "after-subset"]);
		});

		it("executes all subsets even when function throws", async () => {
			api = await createApiInstance(config);

			const executionOrder = [];

			api.hooks.on(
				"always",
				() => {
					executionOrder.push("before");
				},
				{ subset: "before" }
			);
			api.hooks.on(
				"always",
				() => {
					executionOrder.push("primary");
				},
				{ subset: "primary" }
			);
			api.hooks.on(
				"always",
				() => {
					executionOrder.push("after");
				},
				{ subset: "after" }
			);

			// Add a before hook that throws
			api.hooks.on("before", () => {
				throw new Error("Test error");
			});

			try {
				await api.math.add(2, 3);
			} catch (error) {
				// Expected
			}

			expect(executionOrder).toEqual(["before", "primary", "after"]);
		});

		it("provides error context to all subsets when function fails", async () => {
			api = await createApiInstance(config);

			const contexts = [];

			api.hooks.on("always", (ctx) => contexts.push({ subset: "before", hasError: ctx.hasError }), { subset: "before" });
			api.hooks.on("always", (ctx) => contexts.push({ subset: "primary", hasError: ctx.hasError }), { subset: "primary" });
			api.hooks.on("always", (ctx) => contexts.push({ subset: "after", hasError: ctx.hasError }), { subset: "after" });

			api.hooks.on("before", () => {
				throw new Error("Test error");
			});

			try {
				await api.math.add(2, 3);
			} catch (error) {
				// Expected
			}

			expect(contexts).toEqual([
				{ subset: "before", hasError: true },
				{ subset: "primary", hasError: true },
				{ subset: "after", hasError: true }
			]);
		});
	});

	describe("Error Hooks Subset Ordering", () => {
		it("executes subsets in order: before → primary → after", async () => {
			api = await createApiInstance(config);

			const executionOrder = [];

			api.hooks.on(
				"error",
				() => {
					executionOrder.push("after-subset");
				},
				{ subset: "after" }
			);
			api.hooks.on(
				"error",
				() => {
					executionOrder.push("primary-subset");
				},
				{ subset: "primary" }
			);
			api.hooks.on(
				"error",
				() => {
					executionOrder.push("before-subset");
				},
				{ subset: "before" }
			);

			// Trigger error
			api.hooks.on("before", () => {
				throw new Error("Test error");
			});

			try {
				await api.math.add(2, 3);
			} catch (error) {
				// Expected
			}

			expect(executionOrder).toEqual(["before-subset", "primary-subset", "after-subset"]);
		});

		it("all subsets receive error context with source info", async () => {
			api = await createApiInstance(config);

			const errorContexts = [];

			api.hooks.on(
				"error",
				(ctx) =>
					errorContexts.push({
						subset: "before",
						errorType: ctx.errorType,
						sourceType: ctx.source.type
					}),
				{ subset: "before" }
			);

			api.hooks.on(
				"error",
				(ctx) =>
					errorContexts.push({
						subset: "primary",
						errorType: ctx.errorType,
						sourceType: ctx.source.type
					}),
				{ subset: "primary" }
			);

			api.hooks.on(
				"error",
				(ctx) =>
					errorContexts.push({
						subset: "after",
						errorType: ctx.errorType,
						sourceType: ctx.source.type
					}),
				{ subset: "after" }
			);

			// Trigger error in before hook
			api.hooks.on(
				"before",
				() => {
					throw new Error("Test error");
				},
				{ id: "test-hook" }
			);

			try {
				await api.math.add(2, 3);
			} catch (error) {
				// Expected
			}

			expect(errorContexts).toEqual([
				{ subset: "before", errorType: "Error", sourceType: "before" },
				{ subset: "primary", errorType: "Error", sourceType: "before" },
				{ subset: "after", errorType: "Error", sourceType: "before" }
			]);
		});

		it("respects priority within subsets for error handling", async () => {
			api = await createApiInstance(config);

			const executionOrder = [];

			api.hooks.on(
				"error",
				() => {
					executionOrder.push("before-high");
				},
				{ subset: "before", priority: 1000 }
			);
			api.hooks.on(
				"error",
				() => {
					executionOrder.push("before-low");
				},
				{ subset: "before", priority: 100 }
			);
			api.hooks.on(
				"error",
				() => {
					executionOrder.push("primary-high");
				},
				{ subset: "primary", priority: 1000 }
			);
			api.hooks.on(
				"error",
				() => {
					executionOrder.push("primary-low");
				},
				{ subset: "primary", priority: 100 }
			);

			api.hooks.on("before", () => {
				throw new Error("Test error");
			});

			try {
				await api.math.add(2, 3);
			} catch (error) {
				// Expected
			}

			expect(executionOrder).toEqual(["before-high", "before-low", "primary-high", "primary-low"]);
		});
	});

	describe("Cross-Hook-Type Subset Behavior", () => {
		it("maintains subset ordering across all hook types in single call", async () => {
			api = await createApiInstance(config);

			const executionLog = [];

			// Before hooks with subsets
			api.hooks.on(
				"before",
				() => {
					executionLog.push("before:before");
				},
				{ subset: "before" }
			);
			api.hooks.on(
				"before",
				() => {
					executionLog.push("before:primary");
				},
				{ subset: "primary" }
			);
			api.hooks.on(
				"before",
				() => {
					executionLog.push("before:after");
				},
				{ subset: "after" }
			);

			// After hooks with subsets
			api.hooks.on(
				"after",
				({ result }) => {
					executionLog.push("after:before");
					return result;
				},
				{ subset: "before" }
			);
			api.hooks.on(
				"after",
				({ result }) => {
					executionLog.push("after:primary");
					return result;
				},
				{ subset: "primary" }
			);
			api.hooks.on(
				"after",
				({ result }) => {
					executionLog.push("after:after");
					return result;
				},
				{ subset: "after" }
			);

			// Always hooks with subsets
			api.hooks.on(
				"always",
				() => {
					executionLog.push("always:before");
				},
				{ subset: "before" }
			);
			api.hooks.on(
				"always",
				() => {
					executionLog.push("always:primary");
				},
				{ subset: "primary" }
			);
			api.hooks.on(
				"always",
				() => {
					executionLog.push("always:after");
				},
				{ subset: "after" }
			);

			await api.math.add(2, 3);

			expect(executionLog).toEqual([
				// Before hook subsets
				"before:before",
				"before:primary",
				"before:after",
				// After hook subsets
				"after:before",
				"after:primary",
				"after:after",
				// Always hook subsets
				"always:before",
				"always:primary",
				"always:after"
			]);
		});

		it("complex scenario with mixed priorities and subsets", async () => {
			api = await createApiInstance(config);

			const executionLog = [];

			// Before hooks: mix of subsets and priorities
			api.hooks.on(
				"before",
				() => {
					executionLog.push("before:before:high");
				},
				{ subset: "before", priority: 2000 }
			);
			api.hooks.on(
				"before",
				() => {
					executionLog.push("before:before:low");
				},
				{ subset: "before", priority: 500 }
			);
			api.hooks.on(
				"before",
				() => {
					executionLog.push("before:primary:high");
				},
				{ subset: "primary", priority: 1500 }
			);
			api.hooks.on(
				"before",
				() => {
					executionLog.push("before:primary:low");
				},
				{ subset: "primary", priority: 800 }
			);
			api.hooks.on(
				"before",
				() => {
					executionLog.push("before:after:high");
				},
				{ subset: "after", priority: 1000 }
			);
			api.hooks.on(
				"before",
				() => {
					executionLog.push("before:after:low");
				},
				{ subset: "after", priority: 100 }
			);

			await api.math.add(2, 3);

			expect(executionLog).toEqual([
				// Before subset (highest priority first)
				"before:before:high",
				"before:before:low",
				// Primary subset (highest priority first)
				"before:primary:high",
				"before:primary:low",
				// After subset (highest priority first)
				"before:after:high",
				"before:after:low"
			]);
		});
	});

	describe("Subset Validation", () => {
		it("throws error for invalid subset value", async () => {
			api = await createApiInstance(config);

			expect(() => {
				api.hooks.on("before", () => {}, { subset: "invalid" });
			}).toThrow('Invalid hook subset "invalid". Must be "before", "primary", or "after".');
		});

		it("accepts valid subset values", async () => {
			api = await createApiInstance(config);

			expect(() => {
				api.hooks.on("before", () => {}, { subset: "before" });
				api.hooks.on("before", () => {}, { subset: "primary" });
				api.hooks.on("before", () => {}, { subset: "after" });
			}).not.toThrow();
		});
	});

	describe("Subset with Pattern Matching", () => {
		it("applies subsets correctly with pattern filtering", async () => {
			api = await createApiInstance(config);

			const mathLog = [];
			const stringLog = [];

			// Math-specific hooks with subsets
			api.hooks.on(
				"before",
				() => {
					mathLog.push("before");
				},
				{ pattern: "math.*", subset: "before" }
			);
			api.hooks.on(
				"before",
				() => {
					mathLog.push("primary");
				},
				{ pattern: "math.*", subset: "primary" }
			);
			api.hooks.on(
				"before",
				() => {
					mathLog.push("after");
				},
				{ pattern: "math.*", subset: "after" }
			);

			// String-specific hooks with subsets
			api.hooks.on(
				"before",
				() => {
					stringLog.push("before");
				},
				{ pattern: "string.*", subset: "before" }
			);
			api.hooks.on(
				"before",
				() => {
					stringLog.push("primary");
				},
				{ pattern: "string.*", subset: "primary" }
			);
			api.hooks.on(
				"before",
				() => {
					stringLog.push("after");
				},
				{ pattern: "string.*", subset: "after" }
			);

			await api.math.add(2, 3);
			await api.string.upper("test");

			expect(mathLog).toEqual(["before", "primary", "after"]);
			expect(stringLog).toEqual(["before", "primary", "after"]);
		});
	});

	describe("Subset Listing and Management", () => {
		it("includes subset in hook list output", async () => {
			api = await createApiInstance(config);

			api.hooks.on("before", () => {}, { id: "hook1", subset: "before", priority: 1000 });
			api.hooks.on("before", () => {}, { id: "hook2", subset: "primary", priority: 500 });
			api.hooks.on("before", () => {}, { id: "hook3", subset: "after", priority: 100 });

			const list = api.hooks.list("before");

			expect(list.registeredHooks).toHaveLength(3);
			expect(list.registeredHooks[0].subset).toBe("before");
			expect(list.registeredHooks[1].subset).toBe("primary");
			expect(list.registeredHooks[2].subset).toBe("after");
		});

		it("removes hooks by ID regardless of subset", async () => {
			api = await createApiInstance(config);

			const executionLog = [];

			api.hooks.on(
				"before",
				() => {
					executionLog.push("before");
				},
				{ id: "hook1", subset: "before" }
			);
			api.hooks.on(
				"before",
				() => {
					executionLog.push("primary");
				},
				{ id: "hook2", subset: "primary" }
			);
			api.hooks.on(
				"before",
				() => {
					executionLog.push("after");
				},
				{ id: "hook3", subset: "after" }
			);

			// Remove primary subset hook
			api.hooks.off("hook2");

			await api.math.add(2, 3);

			expect(executionLog).toEqual(["before", "after"]); // "primary" not present
		});
	});
});
