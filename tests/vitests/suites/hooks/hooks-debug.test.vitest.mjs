/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hooks-debug.test.vitest.mjs
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
 * @fileoverview Hooks debug test - verifies hook system debug functionality
 *
 * Original test: tests/rewritten/test-hooks-debug.mjs
 * @module tests/vitests/processed/hooks/hooks-debug.test.vitest
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs({ hook: { enabled: true }, diagnostics: true }))("Hooks Debug > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		// Create API instance with hooks enabled, diagnostics, and the test config
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			diagnostics: true,
			collision: { initial: "replace", api: "replace" } // Use folder version, ignore file collisions
		});
	});

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
	});

	it("should expose hook diagnostic API when diagnostics enabled", () => {
		// Verify hooks API exists
		expect(api.slothlet.hook).toBeDefined();
		expect(typeof api.slothlet.hook.on).toBe("function");
		expect(typeof api.slothlet.hook.list).toBe("function");

		// Verify diagnostics context
		expect(api.slothlet.diag).toBeDefined();
		expect(api.slothlet.diag.hook).toBeDefined();
		expect(typeof api.slothlet.diag.hook.enabled).toBe("boolean");
		expect(typeof api.slothlet.diag.hook.compilePattern).toBe("function");

		// Register a hook to test functionality
		api.slothlet.hook.on(
			"before:math.add",
			() => {
				// Debug hook - just for testing registration
			},
			{ id: "test-hook", priority: 100 }
		);

		// Verify hook was registered
		const hooksList = api.slothlet.hook.list();
		expect(hooksList).toBeDefined();
		expect(Array.isArray(hooksList) || typeof hooksList === "object").toBe(true);

		// Should have at least our test hook
		if (Array.isArray(hooksList)) {
			expect(hooksList.length).toBeGreaterThan(0);
		} else {
			expect(Object.keys(hooksList).length).toBeGreaterThan(0);
		}
	});

	it("should expose hook manager internal methods", () => {
		const diag = api.slothlet.diag.hook;

		// Test pattern compilation method exists
		expect(typeof diag.compilePattern).toBe("function");

		// Test basic patterns
		const matcher = diag.compilePattern("math.*");
		expect(typeof matcher).toBe("function");
		expect(matcher("math.add")).toBe(true);
		expect(matcher("math.sub")).toBe(true);
		expect(matcher("user.login")).toBe(false);

		// Test pattern compilation functionality with globstar
		const globMatcher = diag.compilePattern("**");
		expect(typeof globMatcher).toBe("function");
		expect(globMatcher("math.add")).toBe(true);
		expect(globMatcher("any.deep.path")).toBe(true);
	});

	it("should compile hook patterns correctly", () => {
		const diag = api.slothlet.diag.hook;

		// Register a hook and verify pattern compilation
		api.slothlet.hook.on("before:math.*", () => {}, { id: "pattern-test" });

		// Test wildcard patterns
		const singleWildcard = diag.compilePattern("math.*");
		expect(singleWildcard("math.add")).toBe(true);
		expect(singleWildcard("math.sub")).toBe(true);
		expect(singleWildcard("user.login")).toBe(false);

		// Test double wildcard patterns
		const doubleWildcard = diag.compilePattern("**");
		expect(doubleWildcard("math.add")).toBe(true);
		expect(doubleWildcard("user.login")).toBe(true);
		expect(doubleWildcard("deep.nested.path")).toBe(true);

		// Test question mark pattern
		const questionMark = diag.compilePattern("tes?");
		expect(questionMark("test")).toBe(true);
		expect(questionMark("test2")).toBe(false);

		// Verify the hook was registered (list should contain it)
		const hooksList = api.slothlet.hook.list();
		expect(hooksList).toBeDefined();
	});

	it("should expose function metadata for debugging", async () => {
		// First materialize the function (needed for lazy mode)
		const result = await api.math.add(2, 3);
		expect(result).toBe(5);

		// After materialization, verify function metadata is exposed
		// In lazy mode with hooks, api.math wrapper is a function until accessed
		// Just check that the function exists and works
		expect(api.math).toBeDefined();
		expect(typeof api.math.add).toBe("function");

		// Check slothlet path metadata
		expect(api.math.add.__slothletPath).toBeDefined();
		expect(typeof api.math.add.__slothletPath).toBe("string");
		expect(api.math.add.__slothletPath).toMatch(/math\.add/);
	});

	it("should enable hook pattern debugging", () => {
		const diag = api.slothlet.diag.hook;

		// Test various pattern types
		const globPattern = diag.compilePattern("*.add");
		expect(globPattern("math.add")).toBe(true);
		expect(globPattern("user.add")).toBe(true);
		expect(globPattern("math.sub")).toBe(false);

		const deepPattern = diag.compilePattern("*.*.*");
		expect(deepPattern("a.b.c")).toBe(true);
		// Pattern *.*.* requires exactly 3 dot-separated segments
		expect(deepPattern("a.b")).toBe(false);
		expect(deepPattern("a")).toBe(false);

		// Test multiple patterns
		const patterns = ["**", "math.*", "*.add", "math.add"];
		const testPath = "math.add";

		for (const pattern of patterns) {
			const matcher = diag.compilePattern(pattern);
			expect(typeof matcher).toBe("function");

			// All these patterns should match "math.add"
			const shouldMatch = ["**", "math.*", "*.add", "math.add"].includes(pattern);
			expect(matcher(testPath)).toBe(shouldMatch);
		}
	});

	it("should track hook manager state", () => {
		const diag = api.slothlet.diag.hook;

		// Verify initial state
		expect(typeof diag.enabled).toBe("boolean");
		expect(diag.enabled).toBe(true); // Hooks are enabled in test config

		// Register hooks and verify they're tracked
		api.slothlet.hook.on("before:test", () => {}, { id: "state-test-1" });
		api.slothlet.hook.on("after:test", () => {}, { id: "state-test-2" });

		const hooks = api.slothlet.hook.list();
		// list() returns {registeredHooks: [...]} object, not array
		expect(hooks.registeredHooks.length).toBeGreaterThanOrEqual(2);

		// State should be consistent - hooks are enabled
		expect(diag.enabled).toBe(true);
	});
});
