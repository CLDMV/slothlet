/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/type-generator.test.vitest.mjs
 *	@Date: 2026-02-22T18:20:44-08:00 (1771813244)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:04:41 -07:00 (1791083081)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Direct unit tests for the type-generator module.
 *
 * These tests import and call `generateTypes` directly — bypassing the
 * `child_process.fork()` path used during strict-mode type generation — so
 * that V8 coverage is captured for every line of
 * `src/lib/processors/type-generator.mjs`.
 */

import { describe, it, expect, afterEach, afterAll, vi } from "vitest";
import fs from "fs";
import path from "path";
import ts from "typescript";
import slothlet from "@cldmv/slothlet";
import { generateTypes } from "@cldmv/slothlet/processors/type-generator";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

// The real-instance cases compile a probe against the generated declaration (a full TypeScript program
// over slothlet's own declarations), which runs well past vitest's default budget under load.
vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 });

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
// Real-instance helpers (a composed api built from a small fixture written to a test tmp dir)
// ---------------------------------------------------------------------------

const fixtureRoots = [];

afterAll(() => {
	for (const root of fixtureRoots) fs.rmSync(root, { recursive: true, force: true });
});

/**
 * Write `files` into `<tmp>/api`, compose them with slothlet (eager), and generate types for that live
 * instance into `<tmp>/api.d.mts`.
 * @param {Record<string, string>} files - File name → source.
 * @param {string} [interfaceName="TestAPI"] - Generated interface name.
 * @returns {Promise<{output: string, outputPath: string}>} The declaration and where it was written.
 */
async function generateForFixture(files, interfaceName = "TestAPI") {
	const root = await makeTestTmpDir("type-generator");
	fixtureRoots.push(root);
	const apiDir = path.join(root, "api");
	fs.mkdirSync(apiDir, { recursive: true });
	for (const [name, source] of Object.entries(files)) {
		fs.writeFileSync(path.join(apiDir, name), source, "utf8");
	}
	const outputPath = path.join(root, "api.d.mts");
	const api = await slothlet({ base: apiDir, mode: "eager", silent: true });
	try {
		const { output } = await generateTypes(api, { output: outputPath, interfaceName });
		return { output, outputPath };
	} finally {
		await api.slothlet.shutdown();
	}
}

/**
 * Compile a probe (importing `self`) against a generated declaration and return every diagnostic outside
 * node_modules. Empty means the probe's calls type-check and each `@ts-expect-error` line is a real error.
 * @param {string} dtsPath - Generated declaration.
 * @param {string[]} probeLines - Probe body lines (after the `self` import).
 * @returns {Promise<string[]>} Diagnostic messages.
 */
async function probeDiagnostics(dtsPath, probeLines) {
	const probePath = path.join(path.dirname(dtsPath), "probe.mts");
	fs.writeFileSync(probePath, ['import { self } from "@cldmv/slothlet/runtime";', ...probeLines, ""].join("\n"), "utf8");
	const program = ts.createProgram([dtsPath, probePath], {
		noEmit: true,
		skipLibCheck: false,
		strict: true,
		allowJs: true,
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.NodeNext,
		moduleResolution: ts.ModuleResolutionKind.NodeNext,
		customConditions: ["slothlet-dev"],
		types: ["node"]
	});
	return ts
		.getPreEmitDiagnostics(program)
		.filter((d) => !d.file || !d.file.fileName.includes(`${path.sep}node_modules${path.sep}`))
		.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
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

		it("should extend SlothletSelf from @cldmv/slothlet/runtime with the interface", async () => {
			const outputPath = nextOutputPath();

			const { output } = await generateTypes(buildMockAPI(), {
				output: outputPath,
				interfaceName: "MySlothletAPI"
			});

			expect(output).toContain('declare module "@cldmv/slothlet/runtime" {');
			expect(output).toContain("interface SlothletSelf extends MySlothletAPI {}");
			expect(output).not.toContain("declare const self");
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
			expect(output).toContain("interface SlothletSelf extends EmptyAPI {}");
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
			// traverseAPI still collects these nodes; a node slothlet did not compose has no module origin.
			function plainFn() {}

			const apiNoMeta = { plainFn };

			const outputPath = nextOutputPath();
			const { output } = await generateTypes(apiNoMeta, {
				output: outputPath,
				interfaceName: "TestAPI"
			});

			// Generation must complete without error.
			expect(output).toContain("export interface TestAPI");
			// No module origin — typed unknown, with the explanatory comment.
			expect(output).toMatch(/\/\*\* No module origin: [^\n]*\*\/\n\tplainFn: unknown;/);
		});

		it("should not recurse into circular references in the API", async () => {
			const circular = {};
			circular.self = circular; // circular reference

			const outputPath = nextOutputPath();

			// Must complete without stack overflow or error.
			await expect(generateTypes(circular, { output: outputPath, interfaceName: "TestAPI" })).resolves.not.toThrow();
		});

		it("should emit unknown when __metadata.filePath does not exist", async () => {
			// Points to a file that doesn't exist — the path in __metadata is not a module origin, so the
			// function is typed unknown rather than from any file, and generation does not throw.
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
			expect(output).toMatch(/\/\*\* No module origin: [^\n]*\*\/\n\tghostFn: unknown;/);
			expect(output).not.toContain("does/not/exist");
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

		it("should type arrow function exports (export const fn = (...) => ...)", async () => {
			const { output, outputPath } = await generateForFixture({
				"arrows.mjs":
					"/**\n * @param {number} x\n * @returns {number}\n */\nexport const double = (x) => x * 2;\n\n/**\n * @param {boolean} value\n * @returns {boolean}\n */\nexport const negate = function (value) {\n\treturn !value;\n};\n"
			});

			// Arrow export `double` references its own export — and that export's type is number → number.
			expect(output).toMatch(/double: typeof import\("\.\/api\/arrows\.mjs"\)\["double"\];/);
			expect(
				await probeDiagnostics(outputPath, [
					"export const doubled: number = self.arrows.double(2);",
					"// @ts-expect-error x is a number",
					'self.arrows.double("2");'
				])
			).toEqual([]);
		});

		it("should type function expression exports (export const fn = function(...))", async () => {
			const { output, outputPath } = await generateForFixture({
				"arrows.mjs":
					"/**\n * @param {number} x\n * @returns {number}\n */\nexport const double = (x) => x * 2;\n\n/**\n * @param {boolean} value\n * @returns {boolean}\n */\nexport const negate = function (value) {\n\treturn !value;\n};\n"
			});

			expect(output).toMatch(/negate: typeof import\("\.\/api\/arrows\.mjs"\)\["negate"\];/);
			expect(
				await probeDiagnostics(outputPath, [
					"export const negated: boolean = self.arrows.negate(true);",
					"// @ts-expect-error value is a boolean",
					"self.arrows.negate(1);"
				])
			).toEqual([]);
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
		it("should assign each function its own type, not the first export's", async () => {
			// Three exports of one file with three different signatures: each api member must reference
			// its own export — previously every function could inherit the first export's signature.
			const { output, outputPath } = await generateForFixture({
				"calc.mjs":
					"/**\n * @param {number} a\n * @param {number} b\n * @returns {number}\n */\nexport function add(a, b) {\n\treturn a + b;\n}\n\n/**\n * @param {string} text\n * @returns {string}\n */\nexport function label(text) {\n\treturn text;\n}\n\n/**\n * @param {boolean} on\n * @returns {boolean}\n */\nexport function toggle(on) {\n\treturn !on;\n}\n"
			});

			expect(output).toMatch(/add: typeof import\("\.\/api\/calc\.mjs"\)\["add"\];/);
			expect(output).toMatch(/label: typeof import\("\.\/api\/calc\.mjs"\)\["label"\];/);
			expect(output).toMatch(/toggle: typeof import\("\.\/api\/calc\.mjs"\)\["toggle"\];/);
			expect(
				await probeDiagnostics(outputPath, [
					"export const sum: number = self.calc.add(1, 2);",
					'export const text: string = self.calc.label("x");',
					"export const flipped: boolean = self.calc.toggle(true);",
					"// @ts-expect-error label takes a string, not add's numbers",
					"self.calc.label(1);",
					"// @ts-expect-error toggle takes a boolean",
					'self.calc.toggle("on");'
				])
			).toEqual([]);
		});

		it("should emit unknown when the api key has no module origin, not borrow another export's type", async () => {
			// API exposes the function as 'sum', and it carries a filePath to math.ts — but a node slothlet
			// did not compose has no module origin, so nothing is matched by name against that file.
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

			// Typed unknown with the explanatory comment, never another export's type.
			expect(output).toMatch(/\/\*\* No module origin: [^\n]*\*\/\n\tsum: unknown;/);
			expect(output).not.toContain("typeof import");
		});
	});
});

// ─── traverseAPI — primitive values are typed from their export ──────────────

describe("traverseAPI — primitive value in API typed from its export", () => {
	it("types primitive values (number) from their export in generated output", async () => {
		const { output, outputPath } = await generateForFixture(
			{
				"counts.mjs": 'export const count = 42;\nexport const label = "hello";\nexport const flag = true;\n'
			},
			"PrimitiveAPI"
		);

		expect(output).toContain("export interface PrimitiveAPI");
		expect(output).toMatch(/count: typeof import\("\.\/api\/counts\.mjs"\)\["count"\];/);
		expect(output).toMatch(/label: typeof import\("\.\/api\/counts\.mjs"\)\["label"\];/);
		expect(output).toMatch(/flag: typeof import\("\.\/api\/counts\.mjs"\)\["flag"\];/);
		expect(
			await probeDiagnostics(outputPath, [
				"export const count: 42 = self.counts.count;",
				'export const label: "hello" = self.counts.label;',
				"// @ts-expect-error count is the number literal 42",
				"export const wrong: string = self.counts.count;"
			])
		).toEqual([]);
	});
});

// ─── extractTypesFromFile — mixed-export fixture (L189/L191/L193/L194 branches) ──

describe("extractTypesFromFile — mixed-exports.ts fixture exercises visit() branches", () => {
	const mixedFilePath = path.resolve("api_tests/api_test_typescript_typegen/mixed-exports.ts");

	it("handles non-exported var (L189 arm1), destructuring (L191 arm0), non-fn const (L194 arm1), ambient (L193 arm0)", async () => {
		// handler is the only arrow-fn export in the fixture — it gets a typed signature.
		// count/strLen/ambient trigger the non-function init / no-init / destructuring paths.
		function handler(x) {
			return x * 2;
		}
		handler.__metadata = { filePath: mixedFilePath };

		const outputPath = nextOutputPath();
		const { output } = await generateTypes(
			{ handler },
			{
				output: outputPath,
				interfaceName: "MixedAPI"
			}
		);

		// The fixture file is successfully parsed — generation completes without error
		expect(output).toContain("export interface MixedAPI");
		// The arrow-function export "handler" should appear
		expect(output).toContain("handler");
	});
});
