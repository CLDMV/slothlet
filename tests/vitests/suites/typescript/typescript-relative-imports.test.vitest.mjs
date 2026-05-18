/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-relative-imports.test.vitest.mjs
 *	@Date: 2026-05-17T20:30:00-07:00 (1779075000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-17 20:30:00 -07:00 (1779075000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Regression tests for relative imports inside TypeScript modules.
 *
 * @description
 * In 3.5.0 transformed `.ts`/`.mts` modules moved from `data:` URLs to project-local
 * cache files, fixing bare-specifier resolution. But the cache file is NOT co-located
 * with the original source, so relative specifiers (`./sibling.mjs`, `../shared/util.mjs`)
 * still resolved against the cache directory and failed with `Cannot find module`.
 *
 * The 3.5.1 fix anchors relative specifiers at the original source directory via
 * `rewriteRelativeSpecifiers` before the transformed code is cached. This file covers
 * that function directly (unit) and end-to-end through a TypeScript API fixture.
 *
 * @module tests/vitests/suites/typescript/typescript-relative-imports.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { rewriteRelativeSpecifiers } from "@cldmv/slothlet/processors/typescript";
import slothlet from "../../../../index.mjs";

/** Absolute path used as the synthetic "source" for unit tests. */
const SRC = path.resolve("/abs/project/api/alpha/alpha.mts");

/**
 * Build the absolute `file://` URL the rewrite is expected to produce for a
 * specifier relative to {@link SRC}.
 * @param {string} relative - A `./`/`../`-relative specifier.
 * @returns {string} The expected absolute file URL.
 */
function expectedUrl(relative) {
	return pathToFileURL(path.resolve(path.dirname(SRC), relative)).href;
}

// ─── unit: rewriteRelativeSpecifiers ─────────────────────────────────────────

describe("rewriteRelativeSpecifiers", () => {
	it("rewrites a relative `import … from` specifier to an absolute file URL", () => {
		const out = rewriteRelativeSpecifiers(`import { x } from "../helper.mjs";`, SRC);
		expect(out).toBe(`import { x } from "${expectedUrl("../helper.mjs")}";`);
	});

	it("rewrites a default import specifier", () => {
		const out = rewriteRelativeSpecifiers(`import helper from "./helper.mjs";`, SRC);
		expect(out).toBe(`import helper from "${expectedUrl("./helper.mjs")}";`);
	});

	it("rewrites `export … from` and `export * from` re-export specifiers", () => {
		const named = rewriteRelativeSpecifiers(`export { y } from "../shared/util.mjs";`, SRC);
		expect(named).toBe(`export { y } from "${expectedUrl("../shared/util.mjs")}";`);

		const star = rewriteRelativeSpecifiers(`export * from "./re.mjs";`, SRC);
		expect(star).toBe(`export * from "${expectedUrl("./re.mjs")}";`);
	});

	it("rewrites a bare side-effect import (`import \"./x\"`)", () => {
		const out = rewriteRelativeSpecifiers(`import "./side-effect.mjs";`, SRC);
		expect(out).toBe(`import "${expectedUrl("./side-effect.mjs")}";`);
	});

	it("rewrites a dynamic `import()` with a static string literal", () => {
		const out = rewriteRelativeSpecifiers(`const m = await import("../lazy.mjs");`, SRC);
		expect(out).toBe(`const m = await import("${expectedUrl("../lazy.mjs")}");`);
	});

	it("rewrites multi-line binding lists", () => {
		const code = `import {\n\ta,\n\tb\n} from "./multi.mjs";`;
		const out = rewriteRelativeSpecifiers(code, SRC);
		expect(out).toBe(`import {\n\ta,\n\tb\n} from "${expectedUrl("./multi.mjs")}";`);
	});

	it("preserves a ?query / #hash suffix on the specifier", () => {
		const query = rewriteRelativeSpecifiers(`import "./x.mjs?v=2";`, SRC);
		expect(query).toBe(`import "${expectedUrl("./x.mjs")}?v=2";`);

		const hash = rewriteRelativeSpecifiers(`import x from "./x.mjs#frag";`, SRC);
		expect(hash).toBe(`import x from "${expectedUrl("./x.mjs")}#frag";`);
	});

	it("leaves bare specifiers and absolute URLs untouched", () => {
		const bare = `import { self } from "@cldmv/slothlet/runtime";`;
		expect(rewriteRelativeSpecifiers(bare, SRC)).toBe(bare);

		const npm = `import path from "node:path";`;
		expect(rewriteRelativeSpecifiers(npm, SRC)).toBe(npm);

		const abs = `import x from "file:///already/absolute.mjs";`;
		expect(rewriteRelativeSpecifiers(abs, SRC)).toBe(abs);
	});

	it("does not rewrite relative-looking strings that are not import specifiers", () => {
		// `export const` declaration — line starts with `export` but has no `from`.
		const decl = `export const p = "./not-an-import.mjs";`;
		expect(rewriteRelativeSpecifiers(decl, SRC)).toBe(decl);

		// Mid-line string literal — not an import/export statement.
		const str = `const msg = "see ./guide.mjs for details";`;
		expect(rewriteRelativeSpecifiers(str, SRC)).toBe(str);
	});

	it("returns code unchanged when there are no relative specifiers", () => {
		const code = `export const value = 1;\n`;
		expect(rewriteRelativeSpecifiers(code, SRC)).toBe(code);
	});
});

// ─── integration: relative imports through the loader ────────────────────────

// The fixture's helper modules live in `external/`, a sibling of the slothlet
// API directory (`api/`), so slothlet never loads them as API modules — they
// are reached ONLY through the relative specifiers under test.
const RELATIVE_DIR = "./api_tests/api_test_typescript_relative/api";

describe("TypeScript relative-specifier imports (regression)", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
		api = undefined;
	});

	it("resolves .mjs imports (sibling + deeper path) from a .mts module (fast mode)", async () => {
		api = await slothlet({ dir: RELATIVE_DIR, typescript: "fast" });
		// alpha.mts imports ../../external/helper-mjs.mjs and ../../external/nested/value.mjs.
		expect(api.alpha.combined()).toBe("mjs-pong:nested-tag");
	});

	it("resolves a .cjs (CommonJS) relative import from a .ts module (fast mode)", async () => {
		api = await slothlet({ dir: RELATIVE_DIR, typescript: "fast" });
		// beta.ts imports ../../external/helper-cjs.cjs and ../../external/helper-mjs.mjs.
		expect(api.beta.betaCombined()).toBe("cjs-pong:mjs-pong");
	});

	it("resolves relative imports from TS modules in eager mode", async () => {
		api = await slothlet({ dir: RELATIVE_DIR, mode: "eager", typescript: true });
		expect(api.alpha.combined()).toBe("mjs-pong:nested-tag");
		expect(api.beta.betaCombined()).toBe("cjs-pong:mjs-pong");
	});
});
