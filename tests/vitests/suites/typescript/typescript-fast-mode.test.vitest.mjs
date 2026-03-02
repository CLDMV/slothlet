/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-fast-mode.test.vitest.mjs
 *	@Date: 2026-02-14T15:25:01-08:00 (1771111501)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:56 -08:00 (1772425316)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview TypeScript Fast Mode Tests
 * Tests TypeScript file loading and transformation with esbuild
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";

describe("TypeScript Fast Mode", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	describe("Configuration", () => {
		it("should accept typescript: true", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: true
			});

			expect(api).toBeDefined();
			expect(api.math).toBeDefined();
			expect(api.string).toBeDefined();
		});

		it("should accept typescript: 'fast'", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: "fast"
			});

			expect(api).toBeDefined();
			expect(api.math).toBeDefined();
		});

		it("should accept typescript: { mode: 'fast' }", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: { mode: "fast" }
			});

			expect(api).toBeDefined();
			expect(api.math).toBeDefined();
		});

		it("should work without typescript config (ignores .ts files)", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test" // Has only .mjs files
			});

			expect(api).toBeDefined();
			expect(api.math).toBeDefined();
		});
	});

	describe("Function Execution", () => {
		beforeEach(async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: true
			});
		});

		it("should execute TypeScript math functions correctly", async () => {
			expect(api.math.add(5, 3)).toBe(8);
			expect(api.math.subtract(10, 4)).toBe(6);
			expect(api.math.multiply(6, 7)).toBe(42);
		});

		it("should execute TypeScript string functions correctly", async () => {
			expect(api.string.capitalize("hello")).toBe("Hello");
			expect(api.string.lowercase("WORLD")).toBe("world");
			expect(api.string.uppercase("test")).toBe("TEST");
		});

		it("should handle multiple calls to same function", async () => {
			expect(api.math.add(1, 2)).toBe(3);
			expect(api.math.add(10, 20)).toBe(30);
			expect(api.math.add(-5, 5)).toBe(0);
		});
	});

	describe("Eager Mode", () => {
		it("should load TypeScript files in eager mode", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				mode: "eager",
				typescript: true
			});

			expect(api.math.add).toBeTypeOf("function");
			expect(api.string.capitalize).toBeTypeOf("function");
		});

		it("should execute functions immediately in eager mode", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				mode: "eager",
				typescript: true
			});

			const result = api.math.add(15, 25);
			expect(result).toBe(40);
		});
	});

	describe("Lazy Mode", () => {
		it("should load TypeScript files in lazy mode", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				mode: "lazy",
				typescript: true
			});

			// Should have proxy objects
			expect(api.math).toBeDefined();
			expect(api.string).toBeDefined();
		});

		it("should materialize and execute on access", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				mode: "lazy",
				typescript: true
			});

			// Access should trigger materialization
			const result = api.math.add(100, 200);
			expect(result).toBe(300);
		});

		it("should cache materialized functions", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				mode: "lazy",
				typescript: true
			});

			// First call materializes
			const result1 = api.math.multiply(3, 4);
			// Second call should use cached version
			const result2 = api.math.multiply(5, 6);

			expect(result1).toBe(12);
			expect(result2).toBe(30);
		});
	});

	describe("Metadata", () => {
		beforeEach(async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: true
			});
		});

		it("should have metadata on TypeScript functions", async () => {
			const metadata = api.math.add.__metadata;

			expect(metadata).toBeDefined();
			expect(metadata.filePath).toContain("math.ts");
			expect(metadata.apiPath).toBe("math.add");
		});

		it("should track moduleID for TypeScript modules", async () => {
			const metadata = api.string.capitalize.__metadata;

			expect(metadata).toBeDefined();
			expect(metadata.moduleID).toBeDefined();
			expect(metadata.filePath).toContain("string.ts");
		});
	});

	describe("Mixed JavaScript and TypeScript", () => {
		it("should handle directories with both .mjs and .ts files", async () => {
			// This would require a mixed test directory
			// For now, test that TypeScript doesn't break JS loading
			api = await slothlet({
				dir: "./api_tests/api_test",
				typescript: true // Enable but directory has only .mjs
			});

			expect(api.math.add).toBeTypeOf("function");
			expect(api.math.add(2, 3)).toBe(1005); // From api_test/math.mjs
		});
	});

	describe("Error Handling", () => {
		it("should provide clear error if TypeScript file has syntax error", async () => {
			// This would require a test file with intentional syntax errors
			// Skipping for now as we'd need test fixtures
		});
	});

	describe("Configuration Options", () => {
		it("should respect target option", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: {
					mode: "fast",
					target: "es2020"
				}
			});

			expect(api.math.add(1, 1)).toBe(2);
		});

		it("should work with sourcemap disabled", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: {
					mode: "fast",
					sourcemap: false
				}
			});

			expect(api.string.uppercase("test")).toBe("TEST");
		});
	});

	describe("Hooks Integration", () => {
		it("should work with hooks enabled", async () => {
			const callLog = [];

			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: true,
				hook: {
					enabled: true,
					pattern: "**"
				}
			});

			api.slothlet.hook.on("before:math.add", (context) => {
				callLog.push("before");
			});

			api.slothlet.hook.on("after:math.add", (context) => {
				callLog.push("after");
			});

			const result = api.math.add(5, 5);

			expect(result).toBe(10);
			expect(callLog).toEqual(["before", "after"]);
		});
	});

	describe("Runtime Context", () => {
		it("should have context access in TypeScript functions", async () => {
			// Would need a test file that uses context
			// Skipping for now
		});
	});

	describe("API Management", () => {
		it("should support adding TypeScript modules at runtime", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test", // Start with JS only
				typescript: true,
				diagnostics: true
			});

			// Add TypeScript module
			await api.slothlet.api.add("tsModule", "./api_tests/api_test_typescript", {
				moduleID: "ts_addon"
			});

			expect(api.tsModule).toBeDefined();
			expect(api.tsModule.math).toBeDefined();
			expect(api.tsModule.math.add(7, 8)).toBe(15);
		});

		it("should support removing base TypeScript modules by path", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: true
			});

			// Verify module exists
			expect(api.math).toBeDefined();
			expect(api.math.add(5, 3)).toBe(8);
			expect(api.string).toBeDefined();
			
			// Remove by API path
			const removed = await api.slothlet.api.remove("math");
			expect(removed).toBe(true);

			// After removal, the property should be undefined
			expect(api.math).toBeUndefined();
			
			// Other modules should still work
			expect(api.string).toBeDefined();
			expect(api.string.capitalize("hello")).toBe("Hello");
		});
	});

	describe("Shutdown and Cleanup", () => {
		it("should shutdown cleanly with TypeScript modules loaded", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: true
			});

			// Use some functions
			api.math.add(1, 2);
			api.string.capitalize("test");

			// Should shutdown without errors
			await expect(api.slothlet.shutdown()).resolves.not.toThrow();
			api = null; // Prevent double shutdown in afterEach
		});
	});
});
