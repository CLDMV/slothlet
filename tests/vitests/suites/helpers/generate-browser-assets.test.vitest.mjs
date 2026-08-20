/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/generate-browser-assets.test.vitest.mjs
 *	@Date: 2026-05-31T08:04:06-07:00 (1780239846)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-03 21:18:06 -07:00 (1780546686)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for generateBrowserAssets / generateImportMap (#123 browser importmap).
 *
 * @description
 * Covers the one-call browser-asset generator: it returns both the API manifest and slothlet's
 * own importmap, with the importmap rebased onto a configurable `slothletBase` (default the
 * conventional node_modules location). Verifies the default, overrides, the string guard, the
 * i18n locale enumeration, and that `generateManifest` still returns the bare manifest.
 *
 * @module tests/vitests/suites/helpers/generate-browser-assets.test.vitest
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	generateBrowserAssets,
	generateImportMap,
	generateManifest,
	collectSlothletSpecifiers,
	collectPackageSpecifiers
} from "@cldmv/slothlet/helpers/generate-manifest";

const API_DIR = "api_tests/api_test_browser";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("generateBrowserAssets (#123)", () => {
	it("returns both the API manifest and slothlet's own importmap", async () => {
		const { manifest, importmap } = await generateBrowserAssets(API_DIR);

		// Manifest is the API-directory tree.
		expect(Array.isArray(manifest.files)).toBe(true);
		expect(Array.isArray(manifest.directories)).toBe(true);
		expect(manifest.files.length).toBeGreaterThan(0);

		// Importmap covers slothlet's own modules.
		expect(importmap.imports["@cldmv/slothlet"]).toBeDefined();
		expect(importmap.imports["@cldmv/slothlet/helpers/config"]).toBeDefined();
		// Every entry is a real module/locale URL.
		for (const url of Object.values(importmap.imports)) {
			expect(url.endsWith(".mjs") || url.endsWith(".json")).toBe(true);
		}
	});

	it("defaults slothletBase to the conventional node_modules location", async () => {
		const { importmap } = await generateBrowserAssets(API_DIR);
		expect(importmap.imports["@cldmv/slothlet"]).toMatch(/^\/node_modules\/@cldmv\/slothlet\//);
	});

	it("rebases every entry onto an explicit slothletBase ('/')", async () => {
		const { importmap } = await generateBrowserAssets(API_DIR, { slothletBase: "/" });
		expect(importmap.imports["@cldmv/slothlet"]).toBe("/index.mjs");
		for (const url of Object.values(importmap.imports)) {
			expect(url.startsWith("/")).toBe(true);
			expect(url.startsWith("/node_modules/")).toBe(false);
		}
	});

	it("rebases onto a CDN base and normalizes a missing trailing slash", async () => {
		const base = "https://cdn.example.com/@cldmv/slothlet@3"; // no trailing slash
		const { importmap } = await generateBrowserAssets(API_DIR, { slothletBase: base });
		expect(importmap.imports["@cldmv/slothlet"]).toBe(`${base}/index.mjs`);
	});

	it("includes every shipped i18n locale", async () => {
		const { importmap } = await generateBrowserAssets(API_DIR, { slothletBase: "/" });
		const locales = Object.keys(importmap.imports).filter((k) => k.startsWith("@cldmv/slothlet/i18n/language/"));
		expect(locales.length).toBeGreaterThanOrEqual(10);
		expect(importmap.imports["@cldmv/slothlet/i18n/language/en-us.json"]).toMatch(/en-us\.json$/);
	});

	it("throws when slothletBase is provided but not a string", async () => {
		await expect(generateBrowserAssets(API_DIR, { slothletBase: 42 })).rejects.toThrow(/slothletBase must be a string/);
	});
});

describe("generateImportMap (#123)", () => {
	it("uses the default base when none is passed", async () => {
		const { imports } = await generateImportMap();
		expect(imports["@cldmv/slothlet"]).toMatch(/^\/node_modules\/@cldmv\/slothlet\//);
	});

	it("rebases onto an explicit base", async () => {
		const { imports } = await generateImportMap("/vendor/slothlet/");
		expect(imports["@cldmv/slothlet"]).toBe("/vendor/slothlet/index.mjs");
	});

	it("maps every public module export — flat and per-file wildcard — so no browser endpoint 404s (#137)", async () => {
		const { readFileSync, readdirSync } = await import("node:fs");
		const pkg = JSON.parse(readFileSync(new URL("../../../../package.json", import.meta.url), "utf8"));
		const { imports } = await generateImportMap("/");

		// (a) Every flat (non-wildcard) module export resolves — including the bare runtime aggregator,
		// which slothlet's internals never import directly. The JSON schema export is tooling-only (not a
		// browser module), so it is excluded by design.
		const flat = Object.keys(pkg.exports)
			.filter((k) => !k.includes("*") && !k.endsWith(".json"))
			.map((k) => (k === "." ? "@cldmv/slothlet" : `@cldmv/slothlet${k.slice(1)}`));
		expect(flat.filter((spec) => !(spec in imports))).toEqual([]);
		expect(imports["@cldmv/slothlet/runtime"]).toMatch(/\.mjs$/);

		// (b) Every FILE under each wildcard module export must have its own entry, so a browser can
		// resolve any wildcard endpoint — not just the modules slothlet itself imports. Enumerate the
		// source directory each wildcard export declares (the authoritative module list) and require coverage.
		const repoRoot = new URL("../../../../", import.meta.url);
		const listMjs = (dirUrl, prefix = "") => {
			const out = [];
			for (const e of readdirSync(dirUrl, { withFileTypes: true })) {
				if (e.isDirectory()) out.push(...listMjs(new URL(`${e.name}/`, dirUrl), `${prefix}${e.name}/`));
				else if (e.name.endsWith(".mjs")) out.push(`${prefix}${e.name.slice(0, -4)}`);
			}
			return out;
		};
		const wildcardMissing = [];
		for (const [key, value] of Object.entries(pkg.exports)) {
			if (!key.includes("*") || key.startsWith("./i18n/language/")) continue;
			const specPrefix = `@cldmv/slothlet${key.slice(1)}`.split("*")[0];
			const srcTmpl = JSON.stringify(value).match(/\.\/src\/[^"*]*\*\.mjs/)?.[0];
			if (!srcTmpl) continue; // no dev/src target declared for this export
			const dirRel = srcTmpl.slice(2, srcTmpl.indexOf("*")); // e.g. "src/lib/helpers/"
			for (const name of listMjs(new URL(dirRel, repoRoot))) {
				if (!(specPrefix + name in imports)) wildcardMissing.push(specPrefix + name);
			}
		}
		// Guard against a no-op: we must have actually enumerated real wildcard modules.
		expect(imports["@cldmv/slothlet/helpers/config"]).toMatch(/\.mjs$/);
		expect(wildcardMissing).toEqual([]);
	});

	it("maps the internal-only `imports` field (#handlers/* #factories/*) so the browser resolves slothlet's private specifiers (H1)", async () => {
		const { readFileSync } = await import("node:fs");
		const pkg = JSON.parse(readFileSync(new URL("../../../../package.json", import.meta.url), "utf8"));
		const { imports } = await generateImportMap("/");

		// The package `imports` field carries `#handlers/*` / `#factories/*`. Browsers accept
		// `#`-prefixed importmap keys, so every internal module must appear keyed by its literal
		// `#`-specifier — otherwise slothlet's own browser code can't resolve them.
		expect(Object.keys(pkg.imports).length).toBeGreaterThan(0);
		const hashKeys = Object.keys(imports).filter((k) => k.startsWith("#"));
		expect(hashKeys.length).toBeGreaterThan(0);
		expect(imports["#handlers/context-async"]).toMatch(/\.mjs$/);
		expect(imports["#factories/context"]).toMatch(/\.mjs$/);
	});
});

describe("generateManifest still returns the bare manifest", () => {
	it("returns { files, directories } with no importmap", async () => {
		const manifest = await generateManifest(API_DIR);
		expect(manifest).toHaveProperty("files");
		expect(manifest).toHaveProperty("directories");
		expect(manifest).not.toHaveProperty("importmap");
	});
});

describe("collectSlothletSpecifiers - wildcard enumeration edge branches (#140)", () => {
	// The real package can't exercise these: in the dev checkout every wildcard export dir (`src/` AND
	// `dist/`) exists and holds only flat `.mjs` files, so the missing-dir guard and the non-`.mjs` skip
	// never fire. Drive the helper against a temp-fixture package root that forces both.
	it("enumerates a present dir's .mjs files but skips non-.mjs entries and absent target dirs", async () => {
		const fs = await import("node:fs/promises");
		const path = await import("node:path");
		const { fileURLToPath } = await import("node:url");
		const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
		await fs.mkdir(path.join(repoRoot, "tmp"), { recursive: true });
		const root = await fs.mkdtemp(path.join(repoRoot, "tmp", "cov-collect-"));
		try {
			// One wildcard export whose dir EXISTS (a `.mjs` that is enumerated + a non-`.mjs` that is
			// skipped), and one whose target dir is ABSENT (readdir throws → the export is skipped).
			await fs.mkdir(path.join(root, "lib", "present"), { recursive: true });
			await fs.writeFile(path.join(root, "lib", "present", "alpha.mjs"), "export const a = 1;\n");
			await fs.writeFile(path.join(root, "lib", "present", "notes.txt"), "not a module\n");
			await fs.writeFile(
				path.join(root, "package.json"),
				JSON.stringify({
					name: "fixture",
					exports: {
						// `default: null` is a real Node pattern (disables a condition); it also exercises the
						// target walker's falsy-child branch — only the `.mjs` target is collected.
						"./present/*": { import: "./lib/present/*.mjs", default: null },
						"./gone/*": { import: "./lib/gone/*.mjs" }
					}
				})
			);

			const specs = await collectSlothletSpecifiers(root);

			expect(specs.has("@cldmv/slothlet/present/alpha")).toBe(true); // .mjs file enumerated
			expect([...specs].some((s) => s.includes("notes"))).toBe(false); // non-.mjs entry skipped (suffix filter)
			expect([...specs].some((s) => s.startsWith("@cldmv/slothlet/gone/"))).toBe(false); // absent dir skipped (missing-dir guard)
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});
});

describe("third-party package exports in the consumer graph (#297)", () => {
	// Reproduces the gap: a consumer's registered API leaf imports a *sibling* extension package's
	// `exports`-redirected subpaths (`@fixture/ext-storage/errors` → `./src/lib/errors.mjs`). Import
	// maps do plain prefix substitution and never consult a package's `exports`, so before the fix the
	// generated importmap has no exact key for that subpath and it 404s in the browser. The fixture is
	// staged under tmp/ with a node_modules dir beside the consumer so the package resolves the same
	// way Node would. (Same temp-fixture technique the #140 test uses.)
	async function stageGraphFixture() {
		const fs = await import("node:fs/promises");
		const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
		await fs.mkdir(path.join(repoRoot, "tmp"), { recursive: true });
		const root = await fs.mkdtemp(path.join(repoRoot, "tmp", "importmap-graph-"));
		const ext = path.join(root, "node_modules", "@fixture", "ext-storage");
		await fs.mkdir(path.join(ext, "src", "lib"), { recursive: true });
		await fs.mkdir(path.join(ext, "src", "util", "nested"), { recursive: true });
		await fs.writeFile(path.join(ext, "src", "index.mjs"), "export const name = 'ext';\n");
		await fs.writeFile(path.join(ext, "src", "lib", "errors.mjs"), "export class StorageError extends Error {}\n");
		await fs.writeFile(path.join(ext, "src", "lib", "contract.mjs"), "export const CONTRACT = 1;\n");
		await fs.writeFile(path.join(ext, "src", "util", "a.mjs"), "export const a = 1;\n");
		await fs.writeFile(path.join(ext, "src", "util", "nested", "b.mjs"), "export const b = 2;\n");
		await fs.writeFile(
			path.join(ext, "package.json"),
			JSON.stringify({
				name: "@fixture/ext-storage",
				exports: {
					".": "./src/index.mjs",
					"./errors": "./src/lib/errors.mjs",
					// Conditional export: the browser importmap must pick the browser/default target, never the node one.
					"./contract": { node: "./src/lib/contract.node.mjs", browser: "./src/lib/contract.mjs", default: "./src/lib/contract.mjs" },
					// Wildcard directory → every module file under it gets an exact key (incl. nested).
					"./util/*": "./src/util/*.mjs",
					// node-only condition → no browser target → never emitted.
					"./node-only": { node: "./src/lib/nodeonly.mjs" },
					// Declared target that doesn't exist on disk → skipped (never a 404-by-construction entry).
					"./missing": "./src/lib/gone.mjs",
					// Non-module target → not a browser ES module → skipped.
					"./data": "./src/data.json"
				}
			})
		);
		const api = path.join(root, "api");
		await fs.mkdir(path.join(api, "sub"), { recursive: true });
		await fs.mkdir(path.join(api, "node_modules"), { recursive: true }); // must be skipped by the scan
		await fs.writeFile(path.join(api, "helper.mjs"), "export const h = 1;\n");
		await fs.writeFile(path.join(api, "__private.mjs"), "export const p = 1;\n"); // skip-prefix, ignored
		await fs.writeFile(path.join(api, ".hidden.mjs"), "export const x = 1;\n"); // skip-prefix, ignored
		await fs.writeFile(path.join(api, "node_modules", "dep.mjs"), 'import "@fixture/should-not-be-scanned/x";\n');
		await fs.writeFile(
			path.join(api, "store.mjs"),
			'import { StorageError } from "@fixture/ext-storage/errors";\n' +
				'import { CONTRACT } from "@fixture/ext-storage/contract";\n' +
				'import "./helper.mjs";\n' + // relative → not a package
				'import "node:path";\n' + // protocol → not a package
				'import "#internal/thing";\n' + // package-internal → not a package
				'import nope from "nonexistent-fixture-pkg";\n' + // unresolvable bare package → skipped
				"export function store() {\n\treturn [StorageError, CONTRACT, nope];\n}\n"
		);
		await fs.writeFile(path.join(api, "sub", "more.mjs"), 'import { a } from "@fixture/ext-storage/util/a";\nexport const m = a;\n');
		return { root, api };
	}

	it("emits exact importmap keys for a sibling package's exports-redirected subpaths (not just a prefix)", async () => {
		const fs = await import("node:fs/promises");
		const { root, api } = await stageGraphFixture();
		try {
			const { importmap } = await generateBrowserAssets(api, { slothletBase: "/node_modules/@cldmv/slothlet/" });
			// The exact subpath keys an import map's prefix substitution can never produce.
			expect(importmap.imports["@fixture/ext-storage/errors"]).toBe("/node_modules/@fixture/ext-storage/src/lib/errors.mjs");
			// Conditional export → the browser/default target is chosen, not the node one.
			expect(importmap.imports["@fixture/ext-storage/contract"]).toBe("/node_modules/@fixture/ext-storage/src/lib/contract.mjs");
			// The package root (".") is mapped too.
			expect(importmap.imports["@fixture/ext-storage"]).toBe("/node_modules/@fixture/ext-storage/src/index.mjs");
			// Wildcard directory → every module file (including nested) gets an exact key.
			expect(importmap.imports["@fixture/ext-storage/util/a"]).toBe("/node_modules/@fixture/ext-storage/src/util/a.mjs");
			expect(importmap.imports["@fixture/ext-storage/util/nested/b"]).toBe("/node_modules/@fixture/ext-storage/src/util/nested/b.mjs");
			// Skipped shapes: node-only condition, missing-on-disk target, and non-module target.
			expect(importmap.imports["@fixture/ext-storage/node-only"]).toBeUndefined();
			expect(importmap.imports["@fixture/ext-storage/missing"]).toBeUndefined();
			expect(importmap.imports["@fixture/ext-storage/data"]).toBeUndefined();
			// Non-package and unresolvable specifiers contribute nothing.
			expect(Object.keys(importmap.imports).some((k) => k.startsWith("nonexistent-fixture-pkg"))).toBe(false);
			expect(Object.keys(importmap.imports).some((k) => k.startsWith("@fixture/should-not-be-scanned"))).toBe(false);
			// slothlet's own entries are still present (the focused collector is untouched).
			expect(importmap.imports["@cldmv/slothlet"]).toBeDefined();
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});

	it("derives the sibling-package base from a CDN slothletBase (unpkg-style layout)", async () => {
		const fs = await import("node:fs/promises");
		const { root, api } = await stageGraphFixture();
		try {
			const { importmap } = await generateBrowserAssets(api, { slothletBase: "https://cdn.example.com/@cldmv/slothlet@3/" });
			expect(importmap.imports["@fixture/ext-storage/errors"]).toBe("https://cdn.example.com/@fixture/ext-storage/src/lib/errors.mjs");
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});

	it("falls back to the conventional /node_modules/ root when slothletBase isn't the standard package layout", async () => {
		const fs = await import("node:fs/promises");
		const { root, api } = await stageGraphFixture();
		try {
			// slothletBase "/" (slothlet served at the web root) → no `@cldmv/slothlet/` segment to strip.
			const { importmap } = await generateBrowserAssets(api, { slothletBase: "/" });
			expect(importmap.imports["@fixture/ext-storage/errors"]).toBe("/node_modules/@fixture/ext-storage/src/lib/errors.mjs");
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});

	it("still rejects (from generateManifest) when the apiDir doesn't exist — the graph scan tolerates it", async () => {
		await expect(generateBrowserAssets("api_tests/does-not-exist-xyz-297")).rejects.toThrow();
	});
});

describe("collectPackageSpecifiers (#297)", () => {
	// Direct unit coverage of the package-agnostic primitive across every exports shape.
	async function stagePkg(pkg, files = {}) {
		const fs = await import("node:fs/promises");
		const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
		await fs.mkdir(path.join(repoRoot, "tmp"), { recursive: true });
		const root = await fs.mkdtemp(path.join(repoRoot, "tmp", "collect-pkg-"));
		if (pkg !== null) await fs.writeFile(path.join(root, "package.json"), JSON.stringify(pkg));
		for (const [rel, body] of Object.entries(files)) {
			await fs.mkdir(path.join(root, path.dirname(rel)), { recursive: true });
			await fs.writeFile(path.join(root, rel), body);
		}
		return root;
	}

	it("returns an empty map for an unreadable package.json, or a package with no name/exports", async () => {
		const fs = await import("node:fs/promises");
		const noPkg = await stagePkg(null);
		const noName = await stagePkg({ exports: { ".": "./i.mjs" } });
		const noExports = await stagePkg({ name: "@x/y" });
		try {
			expect((await collectPackageSpecifiers(noPkg)).size).toBe(0);
			expect((await collectPackageSpecifiers(noName)).size).toBe(0);
			expect((await collectPackageSpecifiers(noExports)).size).toBe(0);
		} finally {
			for (const r of [noPkg, noName, noExports]) await fs.rm(r, { recursive: true, force: true });
		}
	});

	it("treats a string `exports` and a conditions-only object as the package root (`.`)", async () => {
		const fs = await import("node:fs/promises");
		const strRoot = await stagePkg({ name: "@x/str", exports: "./src/index.mjs" }, { "src/index.mjs": "export const a=1;\n" });
		const condRoot = await stagePkg(
			{ name: "@x/cond", exports: { import: "./src/index.mjs", require: "./src/index.cjs" } },
			{ "src/index.mjs": "export const a=1;\n" }
		);
		try {
			expect(Object.fromEntries(await collectPackageSpecifiers(strRoot))).toEqual({ "@x/str": "src/index.mjs" });
			expect(Object.fromEntries(await collectPackageSpecifiers(condRoot))).toEqual({ "@x/cond": "src/index.mjs" });
		} finally {
			for (const r of [strRoot, condRoot]) await fs.rm(r, { recursive: true, force: true });
		}
	});

	it("resolves condition arrays and the module condition, and skips null/non-module/absent-wildcard shapes", async () => {
		const fs = await import("node:fs/promises");
		const root = await stagePkg(
			{
				name: "@x/shapes",
				exports: {
					// array fallback: first element is node-only (→ null), second is the usable string
					"./a": [{ node: "./x.mjs" }, "./src/a.mjs"],
					"./m": { module: "./src/m.mjs" },
					"./n": null, // no browser target → skipped
					"./j": "./src/data.json", // non-module → skipped
					"./w/*": "./src/w/*.mjs", // present wildcard dir → enumerated
					"./g/*": "./src/gone/*.mjs", // absent wildcard dir → skipped
					"./css/*": "./src/css/*.css" // non-module wildcard suffix → skipped
				}
			},
			{
				"src/a.mjs": "export const a=1;\n",
				"src/m.mjs": "export const m=1;\n",
				"src/w/one.mjs": "export const o=1;\n",
				"src/css/x.css": "a{}"
			}
		);
		try {
			const map = Object.fromEntries(await collectPackageSpecifiers(root));
			expect(map["@x/shapes/a"]).toBe("src/a.mjs");
			expect(map["@x/shapes/m"]).toBe("src/m.mjs");
			expect(map["@x/shapes/w/one"]).toBe("src/w/one.mjs");
			expect(map["@x/shapes/n"]).toBeUndefined();
			expect(map["@x/shapes/j"]).toBeUndefined();
			expect(Object.keys(map).some((k) => k.startsWith("@x/shapes/g"))).toBe(false);
			expect(Object.keys(map).some((k) => k.startsWith("@x/shapes/css"))).toBe(false);
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});
});

describe("exports packaging (#209)", () => {
	// `./devcheck`'s default `import` targeted `./devcheck.mjs`, which the `files` whitelist never
	// shipped — so `import("@cldmv/slothlet/devcheck")` resolved at spec level but threw
	// ERR_MODULE_NOT_FOUND in every installed copy, and generateBrowserAssets mirrored the dead entry
	// into every generated importmap. Every target an installed consumer can resolve (every condition
	// EXCEPT the dev-only `slothlet-dev` branch) must be covered by the `files` whitelist so the
	// export actually loads from an npm install.
	it("every non-dev target of every flat export is covered by the files whitelist", () => {
		const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
		// Mirror npm's `files` semantics: entries are evaluated in order and the LAST matching entry
		// wins, so a negation (`!dist/lib/i18n/languages/*.json`) can re-exclude paths under an
		// included directory and a later positive entry can re-include below it (exactly how this
		// manifest ships only the en-us locale). A matcher per entry: a trailing `/` (or any parent
		// segment) matches the subtree, `*` matches within one path segment, otherwise exact file.
		const entryMatches = (pattern, rel) => {
			if (pattern.endsWith("/")) return rel.startsWith(pattern);
			if (pattern.includes("*")) {
				const rx = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`);
				return rx.test(rel);
			}
			return rel === pattern || rel.startsWith(`${pattern}/`);
		};
		const whitelisted = (rel) => {
			if (rel === "package.json") return true; // npm always includes package.json (and README/LICENSE) regardless of `files`
			let shipped = false;
			for (const entry of pkg.files) {
				const negated = entry.startsWith("!");
				const pattern = negated ? entry.slice(1) : entry;
				if (entryMatches(pattern, rel)) shipped = !negated; // last match wins
			}
			return shipped;
		};
		for (const [key, value] of Object.entries(pkg.exports)) {
			if (key.includes("*")) continue; // wildcard namespaces enumerate per-file from shipped dirs
			const targets = [];
			(function walk(v, dev) {
				if (typeof v === "string") {
					if (!dev) targets.push(v);
				} else if (v && typeof v === "object") {
					for (const [cond, child] of Object.entries(v)) walk(child, dev || cond === "slothlet-dev");
				}
			})(value, false);
			for (const t of targets) {
				const rel = t.replace(/^\.\//, "");
				expect(whitelisted(rel), `exports["${key}"] target ${t} is not covered by the files whitelist — it will not ship`).toBe(true);
			}
		}
	});

	// Companion invariant: every slothlet entry the generator emits must point at a file that exists
	// on disk. Together with the whitelist test above (exists in repo + ships in the tarball), a
	// generated importmap can never carry a URL that 404s by construction.
	it("every slothlet importmap URL maps to a file that exists on disk", async () => {
		const { importmap } = await generateBrowserAssets(API_DIR, { slothletBase: "/pkg/" });
		const entries = Object.entries(importmap.imports).filter(([, url]) => url.startsWith("/pkg/"));
		expect(entries.length).toBeGreaterThan(0);
		for (const [spec, url] of entries) {
			const rel = url.slice("/pkg/".length);
			expect(existsSync(path.join(ROOT, rel)), `${spec} -> ${url} points at a missing file`).toBe(true);
		}
	});
});
