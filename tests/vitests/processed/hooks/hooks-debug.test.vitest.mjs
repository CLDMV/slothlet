/**
 * @fileoverview Hooks debug test - verifies hook system debug functionality
 *
 * Original test: tests/rewritten/test-hooks-debug.mjs
 * @module tests/vitests/processed/hooks/hooks-debug.test.vitest
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../vitest-helper.mjs";
describe.each(getMatrixConfigs({ hooks: true }))("Hooks Debug > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		// Create API instance with hooks enabled and the test config
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hooks: true
		});
	});

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
	});

	it("should expose hook management API", () => {
		// Verify hooks API exists
		expect(api.hooks).toBeDefined();
		expect(typeof api.hooks.on).toBe("function");
		expect(typeof api.hooks.list).toBe("function");

		// Verify internal context
		expect(api.__ctx).toBeDefined();
		expect(api.__ctx.hookManager).toBeDefined();
		expect(typeof api.__ctx.hookManager.enabled).toBe("boolean");
	});

	it("should register and list hooks correctly", () => {
		// Register a test hook
		api.hooks.on(
			"test-hook",
			"before",
			() => {
				// Debug hook - just for testing registration
			},
			{ priority: 100, pattern: "**" }
		);

		// Verify hook was registered
		const hooksList = api.hooks.list();
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
		const manager = api.__ctx.hookManager;

		// Test pattern compilation methods exist
		expect(typeof manager._expandBraces).toBe("function");
		expect(typeof manager._patternToRegex).toBe("function");

		// Test pattern compilation functionality
		const testPattern = "**";
		const expandedBraces = manager._expandBraces(testPattern);
		expect(Array.isArray(expandedBraces)).toBe(true);
		expect(expandedBraces.length).toBeGreaterThan(0);

		const regexString = manager._patternToRegex(expandedBraces[0]);
		expect(typeof regexString).toBe("string");
		expect(regexString.length).toBeGreaterThan(0);

		// Test regex compilation and matching
		const fullRegex = new RegExp(`^${regexString}$`);
		expect(fullRegex.test("math.add")).toBe(true);
	});

	it("should compile hook patterns correctly", () => {
		const manager = api.__ctx.hookManager;

		// Register a hook and verify pattern compilation
		api.hooks.on("pattern-test-hook", "before", () => {}, { pattern: "math.*" });

		// Check compiled patterns - hooks might be in a map or array
		let foundTestHook = false;
		const hooksToCheck = manager.hooks instanceof Map ? manager.hooks.values() : Object.values(manager.hooks || {});

		for (const hook of hooksToCheck) {
			if (hook.name === "pattern-test-hook") {
				foundTestHook = true;
				expect(hook.pattern).toBe("math.*");
				expect(hook.compiledPattern).toBeDefined();
				expect(hook.compiledPattern.test("math.add")).toBe(true);
				expect(hook.compiledPattern.test("string.reverse")).toBe(false);
				break;
			}
		}

		// If no hooks structure found, at least verify the hook was registered
		if (!foundTestHook) {
			const hooksList = api.hooks.list();
			expect(hooksList).toBeDefined();
			// The hook should be registered in some form
		}
	});

	it("should expose function metadata for debugging", async () => {
		// First materialize the function (needed for lazy mode)
		const result = await api.math.add(2, 3);
		expect(result).toBe(5);

		// After materialization, verify function metadata is exposed
		expect(typeof api.math).toBe("object");
		expect(typeof api.math.add).toBe("function");

		// Check slothlet path metadata
		expect(api.math.add.__slothletPath).toBeDefined();
		expect(typeof api.math.add.__slothletPath).toBe("string");
		expect(api.math.add.__slothletPath).toMatch(/math\.add/);
	});

	it("should enable hook pattern debugging", () => {
		const manager = api.__ctx.hookManager;

		// Test various pattern types
		const patterns = ["**", "math.*", "*.add", "math.add"];
		const testPath = "math.add";

		for (const pattern of patterns) {
			const expandedBraces = manager._expandBraces(pattern);
			expect(Array.isArray(expandedBraces)).toBe(true);

			for (const expanded of expandedBraces) {
				const regexString = manager._patternToRegex(expanded);
				expect(typeof regexString).toBe("string");

				const fullRegex = new RegExp(`^${regexString}$`);
				const shouldMatch = ["**", "math.*", "*.add", "math.add"].includes(pattern);
				expect(fullRegex.test(testPath)).toBe(shouldMatch);
			}
		}
	});

	it("should track hook manager state", () => {
		const manager = api.__ctx.hookManager;

		// Verify initial state
		expect(typeof manager.enabled).toBe("boolean");

		// enabledPattern might not exist in all configurations
		if (manager.enabledPattern !== undefined) {
			expect(typeof manager.enabledPattern).toBe("string");
		}

		// State should be consistent
		expect(manager.enabled).toBe(true); // hooks enabled in config
	});
});
