/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/type-generator.test.vitest.mjs
 *	@Date: 2026-02-22T18:20:44-08:00 (1771813244)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:56 -08:00 (1772425316)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Direct unit tests for the type-generator module.
 *
 * These tests import and call `generateTypes` directly — bypassing the
 * `child_process.fork()` path used during strict-mode type generation — so
 * that V8 coverage is captured for every line of
 * `src/lib/processors/type-generator.mjs`.
 */

import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { generateTypes } from "@cldmv/slothlet/processors/type-generator";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** Absolute path to the math.ts API fixture (has typed exports). */
const mathFilePath = path.resolve("api_tests/api_test_typescript/math.ts");

/** Absolute path to the string.ts API fixture. */
const stringFilePath = path.resolve("api_tests/api_test_typescript/string.ts");

/**
 * Build a minimal mock Slothlet API that looks like what the proxy exposes
 * after loading `api_tests/api_test_typescript/`.  Each function value carries
 * `__metadata.filePath` so that `extractTypesFromFile` is exercised.
 *
 * @returns {object} Mock API object
 */
function buildMockAPI() {
	function mockAdd(a, b) {
		return a + b;
	}
	mockAdd.__metadata = { filePath: mathFilePath };

	function mockSubtract(a, b) {
		return a - b;
	}
	mockSubtract.__metadata = { filePath: mathFilePath };

	function mockMultiply(a, b) {
		return a * b;
	}
	mockMultiply.__metadata = { filePath: mathFilePath };

	function mockCapitalize(str) {
		return str;
	}
	mockCapitalize.__metadata = { filePath: stringFilePath };

	return {
		math: {
			add: mockAdd,
			subtract: mockSubtract,
			multiply: mockMultiply
		},
		string: {
			capitalize: mockCapitalize
		}
	};
}

// ---------------------------------------------------------------------------
// Tmp directory helpers
// ---------------------------------------------------------------------------

const tmpBase = path.join("tmp", `slothlet-test-typegen-${Date.now()}`);
let tmpCounter = 0;

/**
 * Returns a unique output path inside the shared tmp directory for this run.
 * @returns {string} Unique .d.ts output path
 */
function nextOutputPath() {
	tmpCounter += 1;
	return path.join(tmpBase, `test-api-${tmpCounter}.d.ts`);
}

afterEach(() => {
	// Best-effort cleanup of all tmp artefacts created during this test run.
	if (fs.existsSync(tmpBase)) {
		fs.rmSync(tmpBase, { recursive: true, force: true });
	}
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateTypes – direct unit tests", () => {
	describe("Validation errors", () => {
		it("should throw when options.output is missing", async () => {
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(async () => generateTypes(buildMockAPI(), { interfaceName: "TestAPI" })).rejects.toThrow("types.output");
			});
		});

		it("should throw when options.output is an empty string", async () => {
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(async () => generateTypes(buildMockAPI(), { output: "", interfaceName: "TestAPI" })).rejects.toThrow("types.output");
			});
		});

		it("should throw when options.interfaceName is missing", async () => {
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(async () => generateTypes(buildMockAPI(), { output: nextOutputPath() })).rejects.toThrow("types.interfaceName");
			});
		});

		it("should throw when options.interfaceName is an empty string", async () => {
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(async () => generateTypes(buildMockAPI(), { output: nextOutputPath(), interfaceName: "" })).rejects.toThrow(
					"types.interfaceName"
				);
			});
		});
	});

	describe("Successful generation", () => {
		it("should return an object with output (string) and filePath (string)", async () => {
			const outputPath = nextOutputPath();

			const result = await generateTypes(buildMockAPI(), {
				output: outputPath,
				interfaceName: "TestAPI"
			});

			expect(result).toBeTypeOf("object");
			expect(result.output).toBeTypeOf("string");
			expect(result.filePath).toBeTypeOf("string");
		});

		it("should write the .d.ts file to disk at the requested path", async () => {
			const outputPath = nextOutputPath();

			const result = await generateTypes(buildMockAPI(), {
				output: outputPath,
				interfaceName: "TestAPI"
			});

			expect(fs.existsSync(result.filePath)).toBe(true);
		});

		it("should create intermediate output directories if they do not exist", async () => {
			const deepOutputPath = path.join(tmpBase, "deep", "nested", "api.d.ts");

			await generateTypes(buildMockAPI(), {
				output: deepOutputPath,
				interfaceName: "TestAPI"
			});

			expect(fs.existsSync(deepOutputPath)).toBe(true);
		});

		it("should include the export interface declaration", async () => {
			const outputPath = nextOutputPath();

			const { output } = await generateTypes(buildMockAPI(), {
				output: outputPath,
				interfaceName: "MySlothletAPI"
			});

			expect(output).toContain("export interface MySlothletAPI");
		});

		it("should include the 'declare const self' line", async () => {
			const outputPath = nextOutputPath();

			const { output } = await generateTypes(buildMockAPI(), {
				output: outputPath,
				interfaceName: "MySlothletAPI"
			});

			expect(output).toContain("declare const self: MySlothletAPI");
		});

		it("should include a @generated header comment", async () => {
			const outputPath = nextOutputPath();

			const { output } = await generateTypes(buildMockAPI(), {
				output: outputPath,
				interfaceName: "TestAPI"
			});

			expect(output).toContain("@generated");
		});

		it("should include function signatures extracted from TypeScript source files", async () => {
			const outputPath = nextOutputPath();

			const { output } = await generateTypes(buildMockAPI(), {
				output: outputPath,
				interfaceName: "TestAPI"
			});

			// math.ts exports: add(a: number, b: number): number  (first export in AST)
			// The generator uses exports[0] from each file; math.ts has 'add' first.
			expect(output).toContain("math");
		});

		it("should produce output whose content matches the written file", async () => {
			const outputPath = nextOutputPath();

			const result = await generateTypes(buildMockAPI(), {
				output: outputPath,
				interfaceName: "TestAPI"
			});

			const written = fs.readFileSync(result.filePath, "utf8");
			expect(written).toBe(result.output);
		});
	});

	describe("TypeScript module caching (getTypeScript)", () => {
		it("should reuse the cached TypeScript instance across multiple calls", async () => {
			const path1 = nextOutputPath();
			const path2 = nextOutputPath();

			// Two sequential calls; the second one must hit the typescriptInstance cache.
			// Both should produce valid output without errors.
			const result1 = await generateTypes(buildMockAPI(), {
				output: path1,
				interfaceName: "API1"
			});

			const result2 = await generateTypes(buildMockAPI(), {
				output: path2,
				interfaceName: "API2"
			});

			expect(result1.output).toContain("export interface API1");
			expect(result2.output).toContain("export interface API2");
		});
	});

	describe("Edge cases - API shape variations", () => {
		it("should handle an empty API object", async () => {
			const outputPath = nextOutputPath();

			const { output } = await generateTypes(
				{},
				{
					output: outputPath,
					interfaceName: "EmptyAPI"
				}
			);

			expect(output).toContain("export interface EmptyAPI");
			expect(output).toContain("declare const self: EmptyAPI");
		});

		it("should skip API keys starting with _ (private/internal)", async () => {
			function hidden() {}
			const apiWithPrivate = {
				_private: hidden,
				__internal: hidden
			};

			const outputPath = nextOutputPath();
			const { output } = await generateTypes(apiWithPrivate, {
				output: outputPath,
				interfaceName: "TestAPI"
			});

			expect(output).not.toContain("_private");
			expect(output).not.toContain("__internal");
		});

		it("should skip the 'slothlet', 'shutdown', and 'destroy' reserved keys", async () => {
			function noop() {}
			const apiWithReserved = {
				slothlet: noop,
				shutdown: noop,
				destroy: noop,
				myFunc: noop
			};

			const outputPath = nextOutputPath();
			const { output } = await generateTypes(apiWithReserved, {
				output: outputPath,
				interfaceName: "TestAPI"
			});

			expect(output).not.toContain("slothlet:");
			expect(output).not.toContain("shutdown:");
			expect(output).not.toContain("destroy:");
		});

		it("should handle functions with no __metadata (no filePath) without throwing", async () => {
			// traverseAPI still collects these nodes; extractTypesFromFile is skipped.
			// The function now appears with a generic (...args: any[]): any signature.
			function plainFn() {}

			const apiNoMeta = { plainFn };

			const outputPath = nextOutputPath();
			const { output } = await generateTypes(apiNoMeta, {
				output: outputPath,
				interfaceName: "TestAPI"
			});

			// Generation must complete without error.
			expect(output).toContain("export interface TestAPI");
			// No filePath — falls back to generic signature.
			expect(output).toContain("plainFn(...args: any[]): any");
		});

		it("should not recurse into circular references in the API", async () => {
			const circular = {};
			circular.self = circular; // circular reference

			const outputPath = nextOutputPath();

			// Must complete without stack overflow or error.
			await expect(generateTypes(circular, { output: outputPath, interfaceName: "TestAPI" })).resolves.not.toThrow();
		});

		it("should use generic signature when __metadata.filePath does not exist (catch branch)", async () => {
			// Points to a file that doesn't exist — fs.readFileSync throws, catch returns { exports: [] }.
			// No name match is possible so the function gets (...args: any[]): any.
			function ghostFn() {}
			ghostFn.__metadata = { filePath: "/nonexistent/path/that/does/not/exist.ts" };

			const outputPath = nextOutputPath();

			const { output } = await generateTypes(
				{ ghostFn },
				{
					output: outputPath,
					interfaceName: "TestAPI"
				}
			);

			expect(output).toContain("export interface TestAPI");
			// ghostFn has no extracted exports (catch returned []) so falls back to generic.
			expect(output).toContain("ghostFn(...args: any[]): any");
		});

		it("should use 'any' fallback for untyped function parameters and return types", async () => {
			const untypedFilePath = path.resolve("api_tests/api_test_typescript_typegen/untyped.ts");

			function identity(value) {
				return value;
			}
			identity.__metadata = { filePath: untypedFilePath };

			const outputPath = nextOutputPath();
			const { output } = await generateTypes(
				{ identity },
				{
					output: outputPath,
					interfaceName: "TestAPI"
				}
			);

			// The untyped.ts file exports `identity` with no param/return types —
			// extractFunctionSignature should fall back to "any" for both.
			expect(output).toContain("export interface TestAPI");
			// identity should appear with (value: any): any signature
			expect(output).toContain("identity");
		});

		it("should handle deeply nested API objects", async () => {
			function leaf() {}
			leaf.__metadata = { filePath: mathFilePath };

			const deepAPI = {
				a: {
					b: {
						c: {
							leaf
						}
					}
				}
			};

			const outputPath = nextOutputPath();
			const { output } = await generateTypes(deepAPI, {
				output: outputPath,
				interfaceName: "DeepAPI"
			});

			expect(output).toContain("export interface DeepAPI");
		});
	});

	describe("Arrow function and function expression exports", () => {
		/** Absolute path to the arrow-functions.ts API fixture. */
		const arrowFilePath = path.resolve("api_tests/api_test_typescript_typegen/arrow-functions.ts");

		it("should extract signatures from arrow function exports (export const fn = (...) => ...)", async () => {
			function double(x) {
				return x * 2;
			}
			double.__metadata = { filePath: arrowFilePath };

			const outputPath = nextOutputPath();
			const { output } = await generateTypes(
				{ double },
				{
					output: outputPath,
					interfaceName: "TestAPI"
				}
			);

			// Arrow export `double` has a typed signature — must appear in the interface
			expect(output).toContain("double");
			expect(output).toContain("number");
		});

		it("should extract signatures from function expression exports (export const fn = function(...))", async () => {
			function negate(value) {
				return !value;
			}
			negate.__metadata = { filePath: arrowFilePath };

			const outputPath = nextOutputPath();
			const { output } = await generateTypes(
				{ negate },
				{
					output: outputPath,
					interfaceName: "TestAPI"
				}
			);

			expect(output).toContain("negate");
			expect(output).toContain("boolean");
		});

		it("should include all arrow-function exports from a file alongside function declarations", async () => {
			function double(x) {
				return x * 2;
			}
			double.__metadata = { filePath: arrowFilePath };

			function formatName(first, last) {
				return `${first} ${last}`;
			}
			formatName.__metadata = { filePath: arrowFilePath };

			function negate(value) {
				return !value;
			}
			negate.__metadata = { filePath: arrowFilePath };

			const outputPath = nextOutputPath();
			const { output } = await generateTypes(
				{ double, formatName, negate },
				{
					output: outputPath,
					interfaceName: "ArrowAPI"
				}
			);

			expect(output).toContain("double");
			expect(output).toContain("formatName");
			expect(output).toContain("negate");
		});
	});

	describe("Correct name-based signature matching", () => {
		it("should assign each function its own signature, not the first export's", async () => {
			// math.ts exports: add(a, b): number   subtract(a, b): number   multiply(a, b): number
			// Previously the generator used exports[0] for all — every function got add's signature.
			function mockAdd(a, b) {
				return a + b;
			}
			mockAdd.__metadata = { filePath: mathFilePath };

			function mockSubtract(a, b) {
				return a - b;
			}
			mockSubtract.__metadata = { filePath: mathFilePath };

			function mockMultiply(a, b) {
				return a * b;
			}
			mockMultiply.__metadata = { filePath: mathFilePath };

			const outputPath = nextOutputPath();
			const { output } = await generateTypes(
				{ add: mockAdd, subtract: mockSubtract, multiply: mockMultiply },
				{
					output: outputPath,
					interfaceName: "MathAPI"
				}
			);

			// All three names must appear
			expect(output).toContain("add");
			expect(output).toContain("subtract");
			expect(output).toContain("multiply");

			// Each must have the correct signature — math.ts uses `number` everywhere
			// Previously subtract and multiply would get add's signature; now each matches by name
			const addLine = output.split("\n").find((l) => l.includes("add("));
			const subtractLine = output.split("\n").find((l) => l.includes("subtract("));
			const multiplyLine = output.split("\n").find((l) => l.includes("multiply("));

			expect(addLine).toContain("add(");
			expect(subtractLine).toContain("subtract(");
			expect(multiplyLine).toContain("multiply(");
		});

		it("should use a generic (...args: any[]): any signature when no export name matches the API key", async () => {
			// API exposes the function as 'sum' but math.ts only exports 'add', 'subtract', 'multiply'.
			// Should not steal add's signature — must fall back to the safe generic.
			function sum(a, b) {
				return a + b;
			}
			sum.__metadata = { filePath: mathFilePath };

			const outputPath = nextOutputPath();
			const { output } = await generateTypes(
				{ sum },
				{
					output: outputPath,
					interfaceName: "TestAPI"
				}
			);

			// Must appear with the safe generic signature, not add's (a: number, b: number): number
			expect(output).toContain("sum(...args: any[]): any");
			// Must NOT have stolen add's typed signature
			expect(output).not.toContain("sum(a: number");
		});
	});
});
