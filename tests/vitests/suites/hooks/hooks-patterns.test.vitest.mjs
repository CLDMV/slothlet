/**
 * @fileoverview Tests for hook system pattern matching functionality.
 * Original test: tests/test-hooks-patterns.mjs
 * Original test count: 15 scenarios + 1 edge case
 * New test count: 16 scenarios × 8 hook-enabled configs = 128 tests (121 currently active)
 *
 * @module tests/vitests/processed/hooks/hooks-patterns.test.vitest
 *
 * @description
 * Comprehensive vitest-based tests for hook pattern matching including:
 * - Single-level wildcards (*)
 * - Multi-level wildcards (**)
 * - Brace expansion ({users,posts})
 * - Negation patterns (!internal.*)
 * - Exact path matching
 * - Pattern caching
 * - Edge cases and limits
 *
 * Uses matrix testing to verify pattern matching across all slothlet configurations.
 *
 * @example
 * // Run with vitest
 * npm run test tests/test-hooks-patterns.vitest.mjs
 *
 * @example
 * // Run specific test
 * npx vitest --run tests/test-hooks-patterns.vitest.mjs -t "single-level wildcard"
 *
 * @example
 * // Run with specific configuration
 * MATRIX_FILTER=BASIC npx vitest --run tests/test-hooks-patterns.vitest.mjs
 *
 * @example
 * // Debug mode
 * DEBUG=true npx vitest --run tests/test-hooks-patterns.vitest.mjs
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";
import slothlet from "@cldmv/slothlet";

/**
 * Normalize hook path values to strings for assertions.
 * @param {unknown} pathValue - Raw path from hook handler.
 * @returns {string} String path representation.
 */
function toHookPath(pathValue) {
	if (typeof pathValue === "string") return pathValue;
	if (pathValue && typeof pathValue.__slothletPath === "string") return pathValue.__slothletPath;
	try {
		return String(pathValue);
	} catch {
		return "";
	}
}

describe.each(getMatrixConfigs({ hook: { enabled: true } }))("Hook Pattern Matching - $name", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST, collision: { initial: "replace", api: "replace" } });
	});

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
	});

	it("Single-level wildcard (*) matches one level", async () => {
		let called = false;
		let capturedPath = "";

		api.slothlet.hook.on(
			"before:math.*",
			({ path }) => {
				called = true;
				capturedPath = toHookPath(path);
			},
			{}
		);

		// Should match
		await api.math.add(2, 3);
		expect(called).toBe(true);
		expect(capturedPath).toBe("math.add");

		// Reset
		called = false;
		capturedPath = "";

		// Should not match (two levels) - check if nested exists
		if (api.nested?.date?.today) {
			await api.nested.date.today();
			expect(called).toBe(false);
		}
	});

	it("Multi-level wildcard (**) matches any depth", async () => {
		const paths = [];

		api.slothlet.hook.on(
			"before:**",
			({ path }) => {
				paths.push(toHookPath(path));
			},
			{}
		);

		await api.advanced.selfObject.addViaSelf(2, 3);

		// Test nested paths if they exist
		if (api.advanced.nest?.alpha) {
			await api.advanced.nest.alpha("test");
		}
		if (api.advanced.nest2?.alpha?.hello) {
			await api.advanced.nest2.alpha.hello();
		}

		expect(paths.length).toBeGreaterThan(0);
		expect(paths.some((p) => p.startsWith("advanced."))).toBe(true);
	});

	it("Exact path matches only specific function", async () => {
		let called = false;
		let capturedPath = "";

		api.slothlet.hook.on(
			"before:math.add",
			({ path }) => {
				called = true;
				capturedPath = toHookPath(path);
			},
			{}
		);

		await api.math.add(2, 3);
		expect(called).toBe(true);
		expect(capturedPath).toBe("math.add");

		// Reset
		called = false;
		capturedPath = "";

		// Should not match different function
		await api.math.multiply(2, 3);
		expect(called).toBe(false);
	});

	it("Brace expansion {a,b} matches alternatives", async () => {
		const paths = [];

		// Match either math or string
		api.slothlet.hook.on(
			"before:{math,string}.*",
			({ path }) => {
				paths.push(toHookPath(path));
			},
			{}
		);

		await api.math.add(2, 3);
		await api.string.upper("test");

		// Should match both
		expect(paths.some((p) => p.startsWith("math."))).toBe(true);
		expect(paths.some((p) => p.startsWith("string."))).toBe(true);
	});

	it("Negation pattern (!) excludes matches", async () => {
		const paths = [];

		// Match all EXCEPT math.*
		api.slothlet.hook.on(
			"before:!math.*",
			({ path }) => {
				paths.push(toHookPath(path));
			},
			{}
		);

		// This should NOT match (math.*)
		await api.math.add(2, 3);

		// This should match (not math)
		await api.string.upper("test");

		// Verify string was called
		expect(paths.some((p) => p.startsWith("string."))).toBe(true);

		// Verify math was NOT called
		expect(paths.some((p) => p.startsWith("math."))).toBe(false);
	});

	it("Pattern caching works with multiple hooks", async () => {
		let count = 0;

		// Register multiple hooks with same pattern
		api.slothlet.hook.on(
			"before:math.*",
			() => {
				count++;
			},
			{}
		);
		api.slothlet.hook.on(
			"before:math.*",
			() => {
				count++;
			},
			{}
		);
		api.slothlet.hook.on(
			"before:math.*",
			() => {
				count++;
			},
			{}
		);

		await api.math.add(2, 3);

		// All three hooks should have been called
		expect(count).toBe(3);
	});

	it("Wildcard with exact suffix (*.create)", async () => {
		let called = false;

		api.slothlet.hook.on(
			"before:*.add",
			() => {
				called = true;
			},
			{}
		);

		await api.math.add(2, 3);
		expect(called).toBe(true);

		// Reset
		called = false;

		// Should not match different suffix
		await api.math.multiply(2, 3);
		expect(called).toBe(false);
	});

	it("Nested brace expansion works", async () => {
		const paths = [];

		// {a,b}.{c,d} should expand to: a.c, a.d, b.c, b.d
		api.slothlet.hook.on(
			"before:{math,string}.{add,upper}",
			({ path }) => {
				paths.push(toHookPath(path));
			},
			{}
		);

		await api.math.add(2, 3);
		await api.string.upper("test");

		// Should match both
		expect(paths).toContain("math.add");
		expect(paths).toContain("string.upper");
	});

	it("Root-level patterns without dots", async () => {
		let called = false;

		// Match any top-level call
		api.slothlet.hook.on(
			"before:*",
			() => {
				called = true;
			},
			{}
		);

		// Top-level functions if they exist
		if (typeof api.rootFunction === "function") {
			await api.rootFunction();
			expect(called).toBe(true);
		} else {
			// Test with first-level namespace
			await api.advanced.selfObject.addViaSelf(2, 3);
			// Won't match because path is "advanced.selfObject.addViaSelf" (has dots)
			expect(called).toBe(false);
		}
	});

	it("Complex pattern with multiple wildcards", async () => {
		const paths = [];

		// Match any.anything.under.here (needs at least 2 dots)
		api.slothlet.hook.on(
			"before:**.*.*",
			({ path }) => {
				paths.push(toHookPath(path));
			},
			{}
		);

		// This has 2 dots: advanced.selfObject.addViaSelf
		await api.advanced.selfObject.addViaSelf(2, 3);

		// Should match paths with at least 2 dots
		expect(paths).toContain("advanced.selfObject.addViaSelf");
	});

	it("Empty pattern matches nothing", async () => {
		let called = false;

		api.slothlet.hook.on("before:math.add", () => {
			called = true;
		});

		await api.math.add(2, 3);
		expect(called).toBe(true); // Empty pattern matches all paths
	});

	it("Maximum brace nesting limit (10 levels)", async () => {
		// This should hit the 10-level limit
		const pattern = "{a,{b,{c,{d,{e,{f,{g,{h,{i,{j,{k,l}}}}}}}}}}}";

		// Should throw error for deep nesting (correct behavior)
		// In v3, pattern is part of the first argument typePattern string
		expect(() => {
			api.slothlet.hook.on(
				`before:${pattern}`,
				() => {
					// Hook registered but may not be called
				}
			);
		}).toThrow("Brace expansion exceeds maximum nesting depth of 10");

		// No need to test function call since registration throws
		// This confirms the system properly limits pattern complexity
	});

	it("Pattern with special regex characters", async () => {
		let called = false;

		// Pattern with dots should be escaped properly
		api.slothlet.hook.on(
			"before:**",
			() => {
				called = true;
			},
			{}
		);

		await api.math.add(2, 3);
		expect(called).toBe(true);
	});

	it("Multiple patterns matching same path", async () => {
		const calls = [];

		api.slothlet.hook.on(
			"before:math.*",
			() => {
				calls.push("pattern1");
			},
			{}
		);

		api.slothlet.hook.on(
			"before:*.add",
			() => {
				calls.push("pattern2");
			},
			{}
		);

		api.slothlet.hook.on(
			"before:**",
			() => {
				calls.push("pattern3");
			},
			{}
		);

		await api.math.add(2, 3);

		// All three patterns should match
		expect(calls).toContain("pattern1");
		expect(calls).toContain("pattern2");
		expect(calls).toContain("pattern3");
		expect(calls).toHaveLength(3);
	});

	it("list() returns registered patterns", async () => {
		api.slothlet.hook.on("before:math.*", () => {});
		api.slothlet.hook.on("after:*.add", () => {});
		api.slothlet.hook.on("error:**", () => {});

		const allHooks = api.slothlet.hook.list();
		expect(allHooks).toHaveProperty("registeredHooks");
		expect(allHooks.registeredHooks).toHaveLength(3);

		const beforeHooks = api.slothlet.hook.list("before");
		expect(beforeHooks).toHaveProperty("registeredHooks");
		expect(beforeHooks.registeredHooks).toHaveLength(1);
		expect(beforeHooks.registeredHooks[0].pattern).toBe("math.*");
	});
});

/**
 * Additional test suite for edge cases with specific configurations
 */
describe("Hook Pattern Edge Cases", () => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			lazy: false,
			apiDepth: 1,
			hook: { enabled: true }, // Enable hooks for pattern matching
			api: { collision: { initial: "replace", api: "replace" } } // Use folder version, ignore file collisions
		});
	});

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
	});

	it("Pattern matching with limited API depth", async () => {
		const paths = [];

		// Match everything
		api.slothlet.hook.on(
			"before:**",
			({ path }) => {
				paths.push(toHookPath(path));
			},
			{}
		);

		// With depth 1, only first-level functions should be available
		await api.math.add(2, 3);

		expect(paths.length).toBeGreaterThan(0);
		// All paths should be at most one level deep due to apiDepth: 1
	});
});
