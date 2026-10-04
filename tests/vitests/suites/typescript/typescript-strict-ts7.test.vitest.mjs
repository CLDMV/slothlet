/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-strict-ts7.test.vitest.mjs
 *	@Date: 2026-09-28T00:00:00-07:00 (1790578800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:04:45 -07:00 (1791083085)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Regression coverage for #510 — TypeScript 7's current npm release exposes no
 * compiler API (only `{ default, "module.exports", version, versionMajorMinor }`), which crashed
 * strict mode with a raw `Cannot read properties of undefined (reading 'ES3')` instead of a clear
 * SlothletError. Simulates that shape via `vi.doMock("typescript", …)` rather than installing
 * TypeScript 7 into the shared node_modules.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

/**
 * The shape TypeScript 7's current npm release actually resolves to via `await import("typescript")`
 * — no compiler API, just package metadata. Mirrors the issue's verified `{ default,
 * "module.exports", version, versionMajorMinor }` namespace.
 *
 * `createProgram`/`ScriptTarget` are listed explicitly (as `undefined`) rather than simply
 * omitted: Vitest 5's `vi.mock`/`vi.doMock` wraps the factory's return in a Proxy that throws its
 * own "No '<prop>' export is defined on the mock" error for any accessed key the factory didn't
 * return at all (`!(prop in target)`), which would misrepresent the source's plain-JS
 * `typeof ts.createProgram === "function"` feature-detection as a test-harness failure instead of
 * exercising it. A real, un-mocked TypeScript 7 import simply yields `undefined` for these — this
 * mock reproduces that value while staying inside Vitest's export-validation guard.
 * @param {string} version - Fake installed version to report.
 * @returns {object} A `vi.doMock` factory return value simulating the TS7 namespace.
 */
function ts7NamespaceShape(version) {
	const metadata = { version, versionMajorMinor: version.split(".").slice(0, 2).join(".") };
	return {
		default: metadata,
		"module.exports": metadata,
		version: metadata.version,
		versionMajorMinor: metadata.versionMajorMinor,
		createProgram: undefined,
		ScriptTarget: undefined
	};
}

describe("TypeScript strict mode vs. a compiler-API-less 'typescript' install (#510)", () => {
	const tempRoots = [];

	afterEach(async () => {
		vi.doUnmock("typescript");
		vi.resetModules();
		await Promise.allSettled(tempRoots.map((r) => rm(r, { recursive: true, force: true })));
		tempRoots.length = 0;
	});

	it("getTypeScript() throws TYPESCRIPT_STRICT_REQUIRES_TS6 naming the installed version, with a typescript@6 hint", async () => {
		vi.resetModules();
		vi.doMock("typescript", () => ts7NamespaceShape("7.0.0-simulated"));

		const { getTypeScript } = await import("@cldmv/slothlet/processors/typescript");

		let caught;
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await getTypeScript();
			} catch (error) {
				caught = error;
			}
		});

		expect(caught).toBeDefined();
		expect(caught.code).toBe("TYPESCRIPT_STRICT_REQUIRES_TS6");
		expect(caught.message).toContain("7.0.0-simulated");
		expect(caught.message).not.toContain("Cannot read properties of undefined");
		expect(caught.hint).toMatch(/typescript@6/);
	});

	it("getTypeScript() resolves the compiler API from a default-only namespace (interop shape)", async () => {
		vi.resetModules();
		const fakeCompilerApi = {
			createProgram: () => ({}),
			ScriptTarget: { ES2020: 7, Latest: 99 },
			ModuleKind: { ESNext: 99 },
			flattenDiagnosticMessageText: () => "",
			version: "6.9.9-default-only"
		};
		// createProgram/ScriptTarget are declared (as undefined) for the same reason noted on
		// ts7NamespaceShape() above — Vitest's mock-export Proxy guard needs the top-level key to
		// exist even when its value is absent, to distinguish "absent" from "typo'd export name".
		vi.doMock("typescript", () => ({
			default: fakeCompilerApi,
			version: "6.9.9-default-only",
			createProgram: undefined,
			ScriptTarget: undefined
		}));

		const { getTypeScript } = await import("@cldmv/slothlet/processors/typescript");
		const ts = await getTypeScript();

		expect(ts).toBe(fakeCompilerApi);
		expect(typeof ts.createProgram).toBe("function");
	});

	it("getTypeScript() still resolves the real TypeScript 6 compiler API unmodified (no mock)", async () => {
		vi.resetModules();

		const { getTypeScript } = await import("@cldmv/slothlet/processors/typescript");
		const ts = await getTypeScript();

		expect(typeof ts.createProgram).toBe("function");
		expect(ts.ScriptTarget).toBeDefined();
		expect(typeof ts.flattenDiagnosticMessageText).toBe("function");
	});

	it("transformTypeScriptStrict() surfaces TYPESCRIPT_STRICT_REQUIRES_TS6 instead of crashing on ts.ScriptTarget.ES3", async () => {
		vi.resetModules();
		vi.doMock("typescript", () => ts7NamespaceShape("7.0.0-simulated"));

		const { transformTypeScriptStrict } = await import("@cldmv/slothlet/processors/typescript");

		const root = await makeTestTmpDir("ts7-strict");
		tempRoots.push(root);
		const tsFile = path.join(root, "widget.ts");
		await writeFile(tsFile, "export const widget: number = 1;\n", "utf8");

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(transformTypeScriptStrict(tsFile, {})).rejects.toMatchObject({
				code: "TYPESCRIPT_STRICT_REQUIRES_TS6"
			});
		});
	});

	it("fast mode (esbuild) still transforms .ts source when 'typescript' lacks the compiler API", async () => {
		vi.resetModules();
		vi.doMock("typescript", () => ts7NamespaceShape("7.0.0-simulated"));

		const { transformTypeScript } = await import("@cldmv/slothlet/processors/typescript");

		const root = await makeTestTmpDir("ts7-fast");
		tempRoots.push(root);
		const tsFile = path.join(root, "widget.ts");
		await writeFile(tsFile, "export const widget: number = 1;\nexport function double(n: number): number { return n * 2; }\n", "utf8");

		const code = await transformTypeScript(tsFile);
		expect(code).toContain("widget");
		expect(code).toContain("double");
	});
});
