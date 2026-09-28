/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typegen/typegen-programmatic.test.vitest.mjs
 *	@Date: 2026-05-12 19:51:36 -07:00 (1778640696)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-12 19:58:07 -07:00 (1778641087)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for the programmatic `generateTypes()` API.
 *
 * Loads the existing TS regression fixture (`api_test_typescript_runtime`)
 * and asserts the generated `.d.ts` file:
 *   - exists at the requested path
 *   - declares an interface with the requested name
 *   - declares `self` typed as that interface
 *   - includes entries for the loaded modules (foo / bar / baz)
 */
import { describe, it, expect, afterAll, vi } from "vitest";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { generateTypes } from "@cldmv/slothlet/typegen";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

// Each test runs generateTypes (two `ts.Program`s — checker + declaration emit) and then compiles the
// generated declaration with `tsc` in the acceptance check. Under coverage instrumentation those tsc
// passes run well past vitest's default 10s/30s budgets (each is ~3s uninstrumented), so give the
// file the same 60s budget typescript-strict-mode uses for its forked-tsc boots.
vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });

const tempRoots = [];

afterAll(async () => {
	await Promise.allSettled(tempRoots.map((r) => rm(r, { recursive: true, force: true })));
});

async function freshTempDir() {
	const root = await makeTestTmpDir("typegen");
	tempRoots.push(root);
	return root;
}

describe("typegen programmatic API", () => {
	it("writes a .d.ts file describing the loaded API surface", async () => {
		const tmp = await freshTempDir();
		const output = path.join(tmp, "api.d.ts");

		const result = await generateTypes({
			dir: "./api_tests/api_test_typescript_runtime",
			output,
			interfaceName: "RuntimeApi"
		});

		expect(result.filePath).toBe(path.resolve(output));
		expect(existsSync(output)).toBe(true);

		const content = await readFile(output, "utf8");
		expect(content).toContain("interface RuntimeApi");
		expect(content).toContain("interface SlothletSelf extends RuntimeApi {}");
		expect(content).toContain("RuntimeApi");
		// All three fixture modules should appear somewhere in the declaration.
		expect(content).toMatch(/\bfoo\b/);
		expect(content).toMatch(/\bbar\b/);
		expect(content).toMatch(/\bbaz\b/);
	});

	it("rejects when dir is missing", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(generateTypes({ output: "/tmp/x.d.ts", interfaceName: "X" })).rejects.toThrow(/INVALID_CONFIG/);
		});
	});

	it("rejects when output is missing", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(generateTypes({ dir: "./api_tests/api_test_typescript_runtime", interfaceName: "X" })).rejects.toThrow(/INVALID_CONFIG/);
		});
	});

	it("rejects when interfaceName is missing", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(generateTypes({ dir: "./api_tests/api_test_typescript_runtime", output: "/tmp/x.d.ts" })).rejects.toThrow(
				/INVALID_CONFIG/
			);
		});
	});

	it("rejects when interfaceName is an empty string", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				generateTypes({ dir: "./api_tests/api_test_typescript_runtime", output: "/tmp/x.d.ts", interfaceName: "" })
			).rejects.toThrow(/INVALID_CONFIG/);
		});
	});

	it("rejects when options is null", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(generateTypes(null)).rejects.toThrow(/INVALID_CONFIG/);
		});
	});

	it("rejects when options is a primitive", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(generateTypes(true)).rejects.toThrow(/INVALID_CONFIG/);
		});
	});

	it("rejects when options is an array", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(generateTypes(["dir", "out", "Name"])).rejects.toThrow(/INVALID_CONFIG/);
		});
	});
});

// #213 — JSDoc `@param {T}` / `@returns {T}` types must reach the generated declaration as PROPER,
// valid TypeScript. A normal slothlet module is plain `.mjs` with JSDoc-only types, and the generator
// once read only inline annotation nodes, so every signature came out `any`. The declaration now
// references each leaf's own export (#484), so TypeScript reads the JSDoc / annotations directly. The
// acceptance check compiles a probe against the generated declaration: calls that must type-check, plus
// `@ts-expect-error` lines proving each type is real — the whole point of typegen is a declaration a
// consumer can run `tsc` against.
describe("typegen JSDoc type reflection (#213)", () => {
	async function generateFromApi(files) {
		const tmp = await freshTempDir();
		const apiDir = path.join(tmp, "api");
		await mkdir(apiDir, { recursive: true });
		for (const [name, src] of Object.entries(files)) {
			await writeFile(path.join(apiDir, name), src, "utf8");
		}
		const outPath = path.join(tmp, "out.d.mts");
		const { content } = await generateTypes({ dir: apiDir, output: outPath, interfaceName: "DemoApi" });
		return { content, outPath };
	}

	// Compile a probe that imports `self` against the generated declaration, under strict mode with
	// `allowJs` (the declaration references the `.mjs` leaves directly) and the `slothlet-dev` condition
	// (so `@cldmv/slothlet/runtime` resolves to this checkout's declarations). Returns every diagnostic
	// outside node_modules — empty means the calls type-check AND every `@ts-expect-error` line is a real
	// error (an unused one is itself a diagnostic). skipLibCheck stays off: the generated file is a .d.mts.
	async function probeDiagnostics(dtsPath, probeSource) {
		const probePath = path.join(path.dirname(dtsPath), "probe.mts");
		await writeFile(probePath, `import { self } from "@cldmv/slothlet/runtime";\n${probeSource}`, "utf8");
		const program = ts.createProgram([dtsPath, probePath], {
			noEmit: true,
			skipLibCheck: false,
			strict: true,
			allowJs: true,
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.ESNext,
			moduleResolution: ts.ModuleResolutionKind.Bundler,
			customConditions: ["slothlet-dev"],
			types: ["node"]
		});
		return ts
			.getPreEmitDiagnostics(program)
			.filter((d) => !d.file || !d.file.fileName.includes(`${path.sep}node_modules${path.sep}`))
			.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
	}

	it("reflects primitive @param / @returns types, and the declaration compiles", async () => {
		const { outPath } = await generateFromApi({
			"greet.mjs":
				"/**\n * @param {string} name\n * @param {number} times\n * @returns {string}\n */\nexport function greet(name, times) {\n\treturn name.repeat(times);\n}\n"
		});
		const diagnostics = await probeDiagnostics(
			outPath,
			[
				'export const greeting: string = self.greet("hi", 2);',
				"// @ts-expect-error name is a string",
				"self.greet(1, 2);",
				"// @ts-expect-error times is a number",
				'self.greet("hi", "2");',
				"// @ts-expect-error returns a string",
				'export const wrong: number = self.greet("hi", 2);',
				""
			].join("\n")
		);
		expect(diagnostics).toEqual([]);
	});

	it("resolves object params (dotted @param), optionals, unions, arrays, generics, and const-arrow exports into valid TS", async () => {
		const { content, outPath } = await generateFromApi({
			// object param with dotted sub-params + a bracket-optional param; also a non-exported helper.
			"build.mjs":
				'/**\n * @param {object} opts\n * @param {string} opts.name\n * @param {number} [opts.count]\n * @param {string} [suffix]\n * @returns {string}\n */\nexport function build(opts, suffix) {\n\treturn `${opts.name}${suffix ?? ""}`;\n}\n\nfunction internalHelper(x) {\n\treturn x;\n}\n',
			"lookup.mjs":
				"/**\n * @param {string|number} id\n * @param {string[]} tags\n * @returns {Promise<{ ok: boolean }>}\n */\nexport async function lookup(id, tags) {\n\treturn { ok: tags.includes(String(id)) };\n}\n",
			// exported const arrow + a non-function const export (exercises the variable-statement path).
			"misc.mjs":
				'/**\n * @param {boolean} flag\n * @returns {number}\n */\nexport const toNum = (flag) => (flag ? 1 : 0);\nexport const LABEL = "x";\n'
		});
		expect(content).not.toMatch(/@param/); // no raw JSDoc leaked into the output
		const diagnostics = await probeDiagnostics(
			outPath,
			[
				// object shape resolved from the dotted @param tags; optional sub-property and optional param
				'export const built: string = self.build({ name: "n" });',
				'export const builtFull: string = self.build({ name: "n", count: 2 }, "-s");',
				"// @ts-expect-error opts.name is required",
				"self.build({ count: 2 });",
				"// @ts-expect-error opts.count is a number",
				'self.build({ name: "n", count: "2" });',
				"// @ts-expect-error suffix is a string",
				'self.build({ name: "n" }, 3);',
				// union + array params, generic return
				'export const found: Promise<{ ok: boolean }> = self.lookup("a", ["x"]);',
				"export const foundByNumber: Promise<{ ok: boolean }> = self.lookup(1, []);",
				"// @ts-expect-error id is string | number",
				'self.lookup(true, ["x"]);',
				"// @ts-expect-error tags is string[]",
				'self.lookup("a", [1]);',
				"// @ts-expect-error the generic resolves to Promise<{ ok: boolean }>",
				'export const wrongGeneric: Promise<{ ok: string }> = self.lookup("a", []);',
				// const-arrow export
				"export const asNumber: number = self.misc.toNum(true);",
				"// @ts-expect-error flag is a boolean",
				'self.misc.toNum("yes");',
				""
			].join("\n")
		);
		expect(diagnostics).toEqual([]);
	});

	it("falls back to accepting any arguments when a function has no JSDoc types", async () => {
		const { outPath } = await generateFromApi({
			"bare.mjs": "export function bare(a, b) {\n\treturn `${a}${b}`;\n}\n"
		});
		// untyped params → any: calls with arbitrary argument types compile
		const diagnostics = await probeDiagnostics(
			outPath,
			[
				'self.bare(1, "x");',
				"self.bare({}, [true]);",
				"self.bare(null, undefined);",
				// …while self itself is typed (not `any`): an unknown member is still an error
				"// @ts-expect-error missing member",
				"self.nope();",
				""
			].join("\n")
		);
		expect(diagnostics).toEqual([]);
	});

	// A TypeScript leaf can reference a LOCAL named type (interface / type alias / enum) declared in the
	// same file. The declaration references the leaf's export, so TypeScript resolves those local types
	// in the leaf itself — including ones reached only transitively (Meta, through Shape).
	it("resolves referenced local named types from a TypeScript leaf so the declaration compiles", async () => {
		const { outPath } = await generateFromApi({
			// `Meta` is referenced only *inside* `Shape` (never in a signature). `Unused` is referenced by nothing.
			"geo.mts":
				'interface Point {\n\tx: number;\n\ty: number;\n\tlabel?: string;\n}\ninterface Meta {\n\ttag: string;\n}\ntype Shape = { origin: Point; kind: "box" | "circle"; meta: Meta };\nenum Unit {\n\tPx,\n\tEm\n}\ninterface Unused {\n\tz: number;\n}\nexport function build(p: Point, s: Shape): { shape: Shape; ok: boolean } {\n\treturn { shape: s, ok: p.x > 0 };\n}\nexport function ids(unit: Unit): Point[] {\n\treturn [];\n}\n'
		});
		const diagnostics = await probeDiagnostics(
			outPath,
			[
				"const point = { x: 1, y: 2 };",
				'const shape = { origin: point, kind: "box" as const, meta: { tag: "t" } };',
				"export const result: { shape: { kind: string }; ok: boolean } = self.geo.build(point, shape);",
				"export const points: { x: number; y: number; label?: string }[] = self.geo.ids(0);",
				"// @ts-expect-error Point requires y",
				"self.geo.build({ x: 1 }, shape);",
				'// @ts-expect-error Shape.kind is "box" | "circle"',
				'self.geo.build(point, { ...shape, kind: "triangle" });',
				"// @ts-expect-error Meta (reached through Shape) requires tag",
				"self.geo.build(point, { ...shape, meta: {} });",
				"// @ts-expect-error Unit is an enum, not a string",
				'self.geo.ids("px");',
				""
			].join("\n")
		);
		expect(diagnostics).toEqual([]);
	});
});
