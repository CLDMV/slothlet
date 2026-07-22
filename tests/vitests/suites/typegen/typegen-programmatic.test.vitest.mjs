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
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import ts from "typescript";
import { generateTypes } from "@cldmv/slothlet/typegen";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

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
	const root = await mkdtemp(path.join(tmpdir(), "slothlet-typegen-"));
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
		expect(content).toContain("declare const self");
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

// #213 — JSDoc `@param {T}` / `@returns {T}` types must be reflected into the generated signatures as
// PROPER, valid TypeScript. A normal slothlet module is plain `.mjs` with JSDoc-only types, and the
// generator previously read only inline annotation nodes, so every signature came out `any`. The fix
// resolves types through a real TypeScript Program + checker, so object shapes, optionals, unions, and
// generics come through. The acceptance test type-checks the generated `.d.ts` itself — the whole point
// of typegen is a declaration a consumer can run `tsc` against.
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

	// Compile the generated declaration under strict mode and return the diagnostic messages (empty =
	// valid, usable TypeScript). This is what actually proves "proper types" — a string match does not.
	function declarationDiagnostics(dtsPath) {
		const program = ts.createProgram([dtsPath], {
			noEmit: true,
			// Fully check the generated declaration itself — skipLibCheck:true would skip semantic
			// checking of every .d.ts (ours included), so a broken declaration could still read as []
			// and defeat the acceptance test. Lib-file noise is excluded by filtering to dtsPath below.
			skipLibCheck: false,
			strict: true,
			target: ts.ScriptTarget.Latest,
			moduleResolution: ts.ModuleResolutionKind.Bundler
		});
		const resolved = path.resolve(dtsPath);
		return ts
			.getPreEmitDiagnostics(program)
			.filter((d) => !d.file || path.resolve(d.file.fileName) === resolved)
			.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
	}

	it("reflects primitive @param / @returns types, and the declaration compiles", async () => {
		const { content, outPath } = await generateFromApi({
			"greet.mjs":
				"/**\n * @param {string} name\n * @param {number} times\n * @returns {string}\n */\nexport function greet(name, times) {\n\treturn name.repeat(times);\n}\n"
		});
		expect(content).toContain("greet(name: string, times: number): string");
		expect(declarationDiagnostics(outPath)).toEqual([]);
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
		// The compiled declaration is valid TypeScript — the real regression guard (raw JSDoc used to leak
		// in and break compilation).
		expect(declarationDiagnostics(outPath)).toEqual([]);
		expect(content).not.toMatch(/@param/); // no raw JSDoc leaked into the output
		// object shape resolved from the dotted @param tags (not `any`, not comment text)
		expect(content).toMatch(/build\(opts:\s*\{[^}]*name:\s*string/);
		expect(content).toMatch(/count\?:\s*number/); // optional sub-property
		expect(content).toMatch(/suffix\?:\s*string/); // bracket-optional param
		expect(content).toContain("lookup(id: string | number, tags: string[]): Promise<{ ok: boolean; }>");
		expect(content).toContain("toNum(flag: boolean): number"); // const-arrow export
	});

	it("falls back to a valid signature when a function has no JSDoc types", async () => {
		const { content, outPath } = await generateFromApi({
			"bare.mjs": "export function bare(a, b) {\n\treturn `${a}${b}`;\n}\n"
		});
		expect(content).toMatch(/bare\(a: any, b: any\):/); // untyped params → any (still valid)
		expect(declarationDiagnostics(outPath)).toEqual([]);
	});

	// A TypeScript leaf can reference a LOCAL named type (interface / type alias / enum) declared in
	// the same file. The checker prints that type by name, so the generated declaration referenced an
	// undefined name and failed to compile until the generator learned to emit the referenced local
	// type declarations alongside the interface.
	it("emits referenced local named types from a TypeScript leaf so the declaration compiles", async () => {
		const { content, outPath } = await generateFromApi({
			// `Meta` is referenced only *inside* `Shape` (never in a signature) — it must still be pulled
			// in transitively. `Unused` is referenced by nothing and must NOT appear.
			"geo.mts":
				'interface Point {\n\tx: number;\n\ty: number;\n\tlabel?: string;\n}\ninterface Meta {\n\ttag: string;\n}\ntype Shape = { origin: Point; kind: "box" | "circle"; meta: Meta };\nenum Unit {\n\tPx,\n\tEm\n}\ninterface Unused {\n\tz: number;\n}\nexport function build(p: Point, s: Shape): { shape: Shape; ok: boolean } {\n\treturn { shape: s, ok: p.x > 0 };\n}\nexport function ids(unit: Unit): Point[] {\n\treturn [];\n}\n'
		});
		// Directly-referenced local types are emitted…
		expect(content).toMatch(/interface Point/);
		expect(content).toMatch(/type Shape/);
		expect(content).toMatch(/enum Unit/);
		// …and so are ones referenced only transitively (Meta, reached through Shape).
		expect(content).toMatch(/interface Meta/);
		// And the signatures still reference them by name.
		expect(content).toMatch(/build\(p: Point, s: Shape\)/);
		expect(content).toMatch(/ids\(unit: Unit\): Point\[\]/);
		// A local type nothing references is NOT dragged in.
		expect(content).not.toMatch(/interface Unused/);
		// The whole declaration compiles under the strict acceptance check — the real regression guard
		// (an undefined `Point` / `Shape` / `Unit` / `Meta` used to make tsc report "Cannot find name").
		expect(declarationDiagnostics(outPath)).toEqual([]);
	});
});
