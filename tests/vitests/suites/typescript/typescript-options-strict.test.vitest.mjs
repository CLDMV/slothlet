/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-options-strict.test.vitest.mjs
 *	@Date: 2026-09-28T00:00:00-07:00 (1790578800)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:04:44 -07:00 (1791083084)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Strict mode honours `typescript.strict`, `typescript.module` and
 * `typescript.compilerOptions` (#499).
 *
 * @description
 * Each option is driven through the real `slothlet({...})` config path and proven to reach the
 * type check by a leaf whose diagnostics depend on it:
 *
 * - `strict: false` — an implicit-`any` parameter (TS7006) is rejected by default and accepted
 *   once strict checking is turned off.
 * - `compilerOptions: { noUnusedLocals: true }` — an unused local (TS6133) passes by default and
 *   is rejected once the flag is set.
 * - `module: "commonjs"` (and the tsconfig-style `compilerOptions: { module: "commonjs" }`) —
 *   `import.meta` (TS1343) passes under the default ESNext module and is rejected under CommonJS.
 *
 * Every boot forks strict mode's type-generation pass, so the file runs solo
 * (SOLO_RUN_PATTERNS in run-all-vitest.mjs) with a generous timeout.
 *
 * @module tests/vitests/suites/typescript/typescript-options-strict.test.vitest
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import path from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import slothlet from "../../../../index.mjs";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

vi.setConfig({ testTimeout: 90000, hookTimeout: 90000 });

let root;
let api;

/**
 * Write a one-leaf API directory under the test root.
 * @param {string} name - Directory name.
 * @param {string} leaf - Leaf name; the file `<leaf>.ts` exports a function of the same name, so
 *   it flattens to `api.<leaf>`.
 * @param {string} source - TypeScript source of the leaf.
 * @returns {Promise<string>} The API directory.
 */
async function apiDir(name, leaf, source) {
	const dir = path.join(root, name);
	await mkdir(dir, { recursive: true });
	await writeFile(path.join(dir, `${leaf}.ts`), source, "utf8");
	return dir;
}

/**
 * Boot slothlet in strict TypeScript mode.
 * @param {string} dir - API directory.
 * @param {object} [options] - Extra `typescript` options.
 * @returns {Promise<object>} The api.
 */
async function boot(dir, options = {}) {
	api = await slothlet({
		dir,
		mode: "eager",
		silent: true,
		typescript: {
			mode: "strict",
			types: { output: path.join(root, `${path.basename(dir)}-${Date.now()}.d.ts`), interfaceName: "OptionsAPI" },
			...options
		}
	});
	return api;
}

/**
 * Assert that booting rejects with an error whose message names the given error code and detail.
 * An eager boot wraps a leaf's load failure in MODULE_IMPORT_FAILED, so the inner code is matched
 * in the message rather than on `error.code`.
 * @param {string} dir - API directory.
 * @param {object} options - Extra `typescript` options.
 * @param {string} code - Expected SlothletError code.
 * @param {string} detail - Text the message must also contain (e.g. the TypeScript diagnostic).
 * @returns {Promise<void>}
 */
async function expectBootRejects(dir, options, code, detail) {
	await withSuppressedSlothletErrorOutput(async () => {
		const error = await boot(dir, options).then(
			() => null,
			(err) => err
		);
		expect(error).not.toBeNull();
		expect(error.message).toContain(code);
		expect(error.message).toContain(detail);
	});
}

let implicitAnyDir;
let unusedLocalDir;
let importMetaDir;

beforeAll(async () => {
	root = await makeTestTmpDir("ts-options-strict");
	implicitAnyDir = await apiDir("implicit-any", "echo", "export function echo(value) {\n\treturn value;\n}\n");
	unusedLocalDir = await apiDir(
		"unused-local",
		"double",
		"export function double(value: number): number {\n\tconst unused = 1;\n\treturn value * 2;\n}\n"
	);
	importMetaDir = await apiDir("import-meta", "where", "export function where(): string {\n\treturn import.meta.url;\n}\n");
});

afterEach(async () => {
	if (api?.slothlet?.shutdown) await api.slothlet.shutdown().catch(() => {});
	api = null;
});

afterAll(async () => {
	if (root) await rm(root, { recursive: true, force: true });
});

describe("typescript.strict", () => {
	it("rejects an implicit-any parameter by default", async () => {
		await expectBootRejects(implicitAnyDir, {}, "TS_TYPE_CHECK_ERRORS", "implicitly has an 'any' type");
	});

	it("accepts an implicit-any parameter with strict: false", async () => {
		await boot(implicitAnyDir, { strict: false });
		expect(await api.echo(7)).toBe(7);
	});
});

describe("typescript.compilerOptions", () => {
	it("accepts an unused local by default", async () => {
		await boot(unusedLocalDir);
		expect(await api.double(4)).toBe(8);
	});

	it("rejects an unused local with compilerOptions.noUnusedLocals", async () => {
		await expectBootRejects(unusedLocalDir, { compilerOptions: { noUnusedLocals: true } }, "TS_TYPE_CHECK_ERRORS", "'unused' is declared");
	});

	it('applies tsconfig-style string values (compilerOptions.module: "commonjs" rejects import.meta)', async () => {
		await expectBootRejects(importMetaDir, { compilerOptions: { module: "commonjs" } }, "TS_TYPE_CHECK_ERRORS", "import.meta");
	});

	it("rejects an unknown compiler option with INVALID_CONFIG", async () => {
		await expectBootRejects(
			unusedLocalDir,
			{ compilerOptions: { notARealCompilerOption: true } },
			"INVALID_CONFIG",
			"notARealCompilerOption"
		);
	});
});

describe("typescript.module", () => {
	it("accepts import.meta under the default module", async () => {
		await boot(importMetaDir);
		expect(await api.where()).toMatch(/^file:/);
	});

	it('rejects import.meta with module: "commonjs"', async () => {
		await expectBootRejects(importMetaDir, { module: "commonjs" }, "TS_TYPE_CHECK_ERRORS", "import.meta");
	});
});
