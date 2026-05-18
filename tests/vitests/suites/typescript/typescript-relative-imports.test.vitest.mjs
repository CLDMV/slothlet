/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-relative-imports.test.vitest.mjs
 *	@Date: 2026-05-17T20:30:00-07:00 (1779075000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-18 00:00:00 -07:00 (1779166800)
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
 * The 3.5.1 fix anchors relative specifiers at the original source directory:
 * relative imports of plain `.mjs`/`.cjs`/`.js` files become absolute `file://`
 * URLs, and relative imports of other `.ts`/`.mts` files are recursively transpiled
 * and linked to their cache files. This file covers the helpers directly (unit) and
 * end-to-end through a TypeScript API fixture.
 *
 * @module tests/vitests/suites/typescript/typescript-relative-imports.test.vitest
 */

import { describe, it, expect, afterEach, afterAll } from "vitest";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
	rewriteRelativeSpecifiers,
	resolveModuleFile,
	writeTransformedToCache,
	maskStringsAndComments
} from "@cldmv/slothlet/processors/typescript";
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

	it("routes specifiers through a custom resolve callback when provided", () => {
		const seen = [];
		const out = rewriteRelativeSpecifiers(`import { x } from "./dep.mjs";`, SRC, (absoluteTarget, suffix, specifier) => {
			seen.push({ absoluteTarget, suffix, specifier });
			return "RESOLVED";
		});
		expect(out).toBe(`import { x } from "RESOLVED";`);
		expect(seen).toEqual([{ absoluteTarget: path.resolve(path.dirname(SRC), "./dep.mjs"), suffix: "", specifier: "./dep.mjs" }]);
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

	it("does not rewrite a dynamic import() that lives inside a string literal", () => {
		const code = `const s = "import('./x.mjs')";`;
		expect(rewriteRelativeSpecifiers(code, SRC)).toBe(code);
	});

	it("does not rewrite import statements inside a block comment", () => {
		const code = `/*\nimport foo from "./bar.mjs";\n*/\nexport const ok = 1;\n`;
		expect(rewriteRelativeSpecifiers(code, SRC)).toBe(code);
	});

	it("does not rewrite a bare import inside a line comment", () => {
		const code = `// import "./setup.mjs";\nexport const ok = 1;\n`;
		expect(rewriteRelativeSpecifiers(code, SRC)).toBe(code);
	});

	it("rewrites a real import even when a string elsewhere contains import-shaped text", () => {
		const code = `import { x } from "./real.mjs";\nconst doc = "see import('./fake.mjs')";`;
		const out = rewriteRelativeSpecifiers(code, SRC);
		expect(out).toBe(`import { x } from "${expectedUrl("./real.mjs")}";\nconst doc = "see import('./fake.mjs')";`);
	});
});

// ─── unit: maskStringsAndComments ────────────────────────────────────────────

describe("maskStringsAndComments", () => {
	/**
	 * Render the mask as a string of `0`/`1` for compact assertions.
	 * @param {string} code - Source to scan.
	 * @returns {string} One digit per character.
	 */
	const maskString = (code) => Array.from(maskStringsAndComments(code)).join("");

	it("masks line comments to end of line, leaving the newline and following code", () => {
		expect(maskString("a// b\nc")).toBe("0111100");
	});

	it("masks a terminated block comment including its delimiters", () => {
		expect(maskString("a/* b */c")).toBe("011111110");
	});

	it("masks an unterminated block comment to end of input", () => {
		expect(maskString("a/* bc")).toBe("011111");
	});

	it("masks string contents including escaped quotes", () => {
		// a "x\"y" b  → the quoted span (indices 2-7, including the escape) is masked.
		expect(maskString('a "x\\"y" b')).toBe("0011111100");
	});

	it("masks an unterminated string to end of input", () => {
		expect(maskString('a "xyz')).toBe("001111");
	});

	it("masks template literals", () => {
		expect(maskString("a`xy`b")).toBe("011110");
	});

	it("leaves plain code unmasked", () => {
		expect(maskString("const x = 1;")).toBe("000000000000");
	});

	it("handles a trailing backslash at end of input without overrunning", () => {
		expect(maskString('"x\\')).toBe("111");
	});
});

// ─── unit: resolveModuleFile ─────────────────────────────────────────────────

describe("resolveModuleFile", () => {
	/** @type {string[]} */
	const tempRoots = [];

	afterAll(async () => {
		await Promise.allSettled(tempRoots.map((r) => rm(r, { recursive: true, force: true })));
	});

	/**
	 * Create a temp directory pre-populated with the given empty files.
	 * @param {string[]} files - File names to create under the temp directory.
	 * @returns {Promise<string>} The temp directory path.
	 */
	async function fixtureDir(files) {
		const root = await mkdtemp(path.join(tmpdir(), "slothlet-resolve-"));
		tempRoots.push(root);
		await Promise.all(files.map((f) => writeFile(path.join(root, f), "", "utf8")));
		return root;
	}

	it("classifies an existing .mts / .ts file as TypeScript", async () => {
		const root = await fixtureDir(["a.mts", "b.ts"]);
		expect(resolveModuleFile(path.join(root, "a.mts"))).toEqual({ path: path.join(root, "a.mts"), isTS: true });
		expect(resolveModuleFile(path.join(root, "b.ts"))).toEqual({ path: path.join(root, "b.ts"), isTS: true });
	});

	it("classifies an existing .mjs file as non-TypeScript", async () => {
		const root = await fixtureDir(["c.mjs"]);
		expect(resolveModuleFile(path.join(root, "c.mjs"))).toEqual({ path: path.join(root, "c.mjs"), isTS: false });
	});

	it("remaps a missing .mjs specifier to a sibling .mts source", async () => {
		const root = await fixtureDir(["d.mts"]);
		expect(resolveModuleFile(path.join(root, "d.mjs"))).toEqual({ path: path.join(root, "d.mts"), isTS: true });
	});

	it("remaps a missing .js specifier to a sibling .ts source", async () => {
		const root = await fixtureDir(["e.ts"]);
		expect(resolveModuleFile(path.join(root, "e.js"))).toEqual({ path: path.join(root, "e.ts"), isTS: true });
	});

	it("resolves an extensionless specifier to a .mts then a .ts source", async () => {
		const root = await fixtureDir(["f.mts", "g.ts"]);
		// f.mts is found by the first extension candidate.
		expect(resolveModuleFile(path.join(root, "f"))).toEqual({ path: path.join(root, "f.mts"), isTS: true });
		// g has no .mts — the second candidate (.ts) matches.
		expect(resolveModuleFile(path.join(root, "g"))).toEqual({ path: path.join(root, "g.ts"), isTS: true });
	});

	it("leaves a specifier with no resolvable file untouched and non-TypeScript", async () => {
		const root = await fixtureDir([]);
		// .cjs extension — not a remap candidate.
		expect(resolveModuleFile(path.join(root, "missing.cjs"))).toEqual({ path: path.join(root, "missing.cjs"), isTS: false });
		// .mjs extension but no .mts sibling either.
		expect(resolveModuleFile(path.join(root, "missing.mjs"))).toEqual({ path: path.join(root, "missing.mjs"), isTS: false });
	});
});

// ─── unit: writeTransformedToCache without a transform callback ───────────────

describe("writeTransformedToCache — no transform callback", () => {
	/** @type {string[]} */
	const cacheDirs = [];

	afterAll(async () => {
		await Promise.allSettled(cacheDirs.map((d) => rm(d, { recursive: true, force: true })));
	});

	it("leaves a relative .ts/.mts import at its source path when no transform is supplied", async () => {
		// Without a transform callback the dependency graph is not followed, so a
		// relative `.ts`/`.mts` target stays an absolute file:// URL at its source.
		const root = await mkdtemp(path.join(tmpdir(), "slothlet-wttc-"));
		cacheDirs.push(root);
		const sibling = path.join(root, "sibling.mts");
		await writeFile(sibling, "export const s = 1;\n", "utf8");
		const entry = path.join(root, "entry.mts");

		const { url, cacheDir } = await writeTransformedToCache(entry, `import { s } from "./sibling.mts";\n`, `wttc-${process.pid}`);
		cacheDirs.push(cacheDir);

		const written = await readFile(new URL(url), "utf8");
		expect(written).toContain(pathToFileURL(sibling).href);
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

	it("resolves .mjs imports and a .mts → .mts import from a .mts module (fast mode)", async () => {
		api = await slothlet({ dir: RELATIVE_DIR, typescript: "fast" });
		// alpha.mts relatively imports helper-mjs.mjs, nested/value.mjs, and ts-shared.mts.
		expect(api.alpha.combined()).toBe("mjs-pong:nested-tag:shared-mts");
	});

	it("resolves a .cjs import and a transitive .ts → .ts → .mts chain from a .ts module (fast mode)", async () => {
		api = await slothlet({ dir: RELATIVE_DIR, typescript: "fast" });
		// beta.ts imports helper-cjs.cjs and ts-util.ts; ts-util.ts imports ts-shared.mts.
		expect(api.beta.betaCombined()).toBe("cjs-pong|util-ts(shared-mts)");
	});

	it("resolves a circular .mts ⇄ .mts relative-import pair (fast mode)", async () => {
		api = await slothlet({ dir: RELATIVE_DIR, typescript: "fast" });
		// gamma.mts → cycle-one.mts ⇄ cycle-two.mts.
		expect(api.gamma.gammaCheck()).toBe("one:two");
	});

	it("resolves every relative-import form from TS modules in eager mode", async () => {
		api = await slothlet({ dir: RELATIVE_DIR, mode: "eager", typescript: true });
		expect(api.alpha.combined()).toBe("mjs-pong:nested-tag:shared-mts");
		expect(api.beta.betaCombined()).toBe("cjs-pong|util-ts(shared-mts)");
		expect(api.gamma.gammaCheck()).toBe("one:two");
	});
});
