/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/generate-manifest.mjs
 *	@Date: 2026-05-28 00:00:00 -07:00 (1748419200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-28 08:10:27 -07:00 (1779981027)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Build-time helpers that generate slothlet's browser assets from a directory.
 *
 * @description
 * Two entry points, both **Node.js-only build-time utilities** (they use `node:fs` / module
 * resolution and run in your build step, a Vite/Webpack plugin, or an Electron main process):
 *
 * - `generateBrowserAssets(apiDir, { slothletBase })` — **the recommended one-call entry.**
 *   Returns `{ manifest, importmap }`: the API-directory manifest **and** the importmap covering
 *   both slothlet's own modules (see #123) and the exact `exports` subpaths of the third-party
 *   packages the registered API leaves import (see #297), so browser consumers never hand-roll it.
 * - `generateManifest(dir)` — the lower-level primitive that returns just the API manifest
 *   (the `{ files, directories }` tree passed to `slothlet({ manifest, resolveModuleSpecifier })`).
 *
 * Why two artifacts: slothlet loads **API leaves** at runtime, so their location is deferred to
 * the `resolveModuleSpecifier` callback (the manifest holds relative paths). slothlet's **own**
 * static imports are resolved by the browser *before slothlet runs*, so they must live in the
 * page's `<script type="importmap">` — which is what `importmap` provides.
 *
 * Manifest shape:
 * ```json
 * {
 *   "files": [
 *     { "path": "math.mjs", "name": "math", "fullName": "math.mjs" }
 *   ],
 *   "directories": [
 *     {
 *       "name": "utils",
 *       "path": "utils",
 *       "children": {
 *         "files": [{ "path": "utils/format.mjs", "name": "format", "fullName": "format.mjs" }],
 *         "directories": []
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * @example
 * // build.mjs — run this at build time in Node.js
 * import { generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";
 * import { writeFileSync } from "node:fs";
 *
 * const manifest = await generateManifest("./src/api");
 * writeFileSync("./public/api-manifest.json", JSON.stringify(manifest, null, 2));
 *
 * @example
 * // app.js — use the manifest at runtime in the browser
 * import manifest from "./public/api-manifest.json" assert { type: "json" };
 * import { slothlet } from "@cldmv/slothlet";
 * import { createManifestResolver } from "@cldmv/slothlet/helpers/manifest-resolver";
 *
 * const api = await slothlet({
 *   manifest,
 *   resolveModuleSpecifier: createManifestResolver(new URL("./api/", import.meta.url))
 * });
 *
 * @see {@link module:@cldmv/slothlet/helpers/manifest-resolver} for the browser-safe resolver factory
 * @module @cldmv/slothlet/helpers/generate-manifest
 * @public
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SlothletError } from "@cldmv/slothlet/errors";

/**
 * Matches any quoted `@cldmv/slothlet[/sub]` specifier — static imports, dynamic imports, and
 * the string-literal lists used by browser component init. Used to discover which of slothlet's
 * own modules the browser must be able to resolve.
 * @type {RegExp}
 */
const SLOTHLET_SPEC_RE = /["'](@cldmv\/slothlet(?:\/[^"']+)?)["']/g;

/**
 * Matches the quoted specifier of any static/dynamic import or re-export — `from "x"`, `import "x"`,
 * and `import("x")`. Used by the general graph collector to discover which packages a consumer's
 * registered API leaves pull in, so their `exports` subpaths can be resolved for the browser. (#297)
 * @type {RegExp}
 */
const IMPORT_SPEC_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;

/**
 * Default browser-served base for the `@cldmv/slothlet` package: the conventional location when
 * slothlet is installed as a dependency and node_modules is served at the web root. Override for
 * a CDN, an Electron custom protocol, or a copied/vendored path. (The repo's own browser smoke
 * test passes `"/"` instead, because there slothlet *is* the workspace served at root.)
 * @type {string}
 */
const DEFAULT_SLOTHLET_BASE = "/node_modules/@cldmv/slothlet/";

/**
 * Extensions treated as loadable API modules.
 * @type {Set<string>}
 */
const LOADABLE_EXTENSIONS = new Set([".mjs", ".cjs", ".js", ".ts", ".mts", ".cts"]);

/**
 * Prefixes that mark a file as internal/non-API (slothlet convention).
 * @type {string[]}
 */
const SKIP_PREFIXES = ["__", "."];

/**
 * Check whether a filename should be included as an API file based on its
 * extension. The caller (`scanDir`) is responsible for SKIP_PREFIXES filtering
 * before invoking this — duplicating the prefix check here would be dead code.
 *
 * @param {string} filename - Bare filename including extension.
 * @returns {boolean} True if the file should be included.
 *
 * @example
 * isApiFile("math.mjs");    // true
 * isApiFile("README.md");   // false
 */
function isApiFile(filename) {
	const ext = path.extname(filename);
	return LOADABLE_EXTENSIONS.has(ext);
}

/**
 * Build a file entry object for the manifest.
 *
 * @param {string} relativePath - Path relative to the root dir (e.g. `"utils/format.mjs"`).
 * @returns {{ path: string, name: string, fullName: string }} File entry.
 *
 * @example
 * makeFileEntry("utils/format.mjs");
 * // { path: "utils/format.mjs", name: "format", fullName: "format.mjs" }
 */
function makeFileEntry(relativePath) {
	const fullName = path.basename(relativePath);
	const name = path.basename(relativePath, path.extname(relativePath));
	return { path: relativePath, name, fullName };
}

/**
 * Recursively scan a directory and return the manifest node for it.
 *
 * @param {string} absDir - Absolute path of the directory to scan.
 * @param {string} rootDir - Absolute path of the manifest root (used to compute relative paths).
 * @returns {Promise<{ files: Array, directories: Array }>} Manifest node.
 *
 * @example
 * const node = await scanDir("/project/src/api", "/project/src/api");
 */
async function scanDir(absDir, rootDir) {
	let entries;
	try {
		entries = await fs.readdir(absDir, { withFileTypes: true });
	} catch {
		return { files: [], directories: [] };
	}

	const files = [];
	const directories = [];

	for (const entry of entries) {
		if (SKIP_PREFIXES.some((p) => entry.name.startsWith(p))) continue;

		if (entry.isFile()) {
			if (isApiFile(entry.name)) {
				const absPath = path.join(absDir, entry.name);
				const rel = path.relative(rootDir, absPath).replace(/\\/g, "/");
				files.push(makeFileEntry(rel));
			}
		} else if (entry.isDirectory()) {
			const absSubDir = path.join(absDir, entry.name);
			const relDir = path.relative(rootDir, absSubDir).replace(/\\/g, "/");
			const children = await scanDir(absSubDir, rootDir);
			// Only include directories that contain at least one loadable file (directly or nested)
			if (children.files.length > 0 || children.directories.length > 0) {
				directories.push({
					name: entry.name,
					path: relDir,
					children
				});
			}
		}
	}

	return { files, directories };
}

/**
 * Generate a slothlet browser manifest by scanning a directory at build time.
 *
 * This is the primary entry point for producing the `manifest` object required by
 * `slothlet({ manifest, resolveModuleSpecifier })`. Call this once during your build
 * step and embed the result in your browser bundle.
 *
 * @param {string} dir - Absolute or relative path to the API root directory.
 * @returns {Promise<{ files: Array<{path:string,name:string,fullName:string}>, directories: Array }>}
 *   Manifest object ready to pass to `slothlet()`.
 *
 * @throws {SlothletError} `GENERATE_MANIFEST_DIR_INVALID` if `dir` is not a non-empty string.
 * @throws {SlothletError} `GENERATE_MANIFEST_DIR_UNREADABLE` if `dir` cannot be read (missing path, permission denied); the underlying reason is surfaced in the message.
 * @throws {SlothletError} `GENERATE_MANIFEST_NOT_DIRECTORY` if `dir` exists but is not a directory.
 *
 * @example
 * // Build script — produces a manifest and writes it to disk
 * import { generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";
 * import { writeFileSync } from "node:fs";
 *
 * const manifest = await generateManifest("./src/api");
 * writeFileSync("./dist/api-manifest.json", JSON.stringify(manifest, null, 2));
 *
 * @example
 * // Vite plugin — inline manifest into the browser bundle
 * import { generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";
 *
 * export function slothletManifestPlugin(apiDir) {
 *   return {
 *     name: "slothlet-manifest",
 *     async buildStart() {
 *       const manifest = await generateManifest(apiDir);
 *       this.emitFile({
 *         type: "asset",
 *         fileName: "slothlet-manifest.json",
 *         source: JSON.stringify(manifest)
 *       });
 *     }
 *   };
 * }
 */
async function generateManifest(dir) {
	if (!dir || typeof dir !== "string") {
		// An empty string passes `typeof === "string"` (a non-empty string wouldn't reach this throw),
		// so reporting the type alone hides the real fault; surface it as "<empty>". typeof likewise
		// reports "object" for both null and arrays, so distinguish those explicitly for an actionable
		// message — matching the syntheticName validation (#136 review).
		const received = typeof dir === "string" ? "<empty>" : dir === null ? "null" : Array.isArray(dir) ? "array" : typeof dir;
		throw new SlothletError("GENERATE_MANIFEST_DIR_INVALID", { received }, null, { validationError: true });
	}

	const absDir = path.resolve(dir);

	// Verify it exists and is a directory before scanning
	let stat;
	try {
		stat = await fs.stat(absDir);
	} catch (err) {
		// Surface the underlying fs failure (ENOENT/EACCES/…) via {reason}: it is the key diagnostic.
		// Kept a validationError (this validates the `dir` argument), so the cause is passed as a
		// context string rather than an originalError 3rd-arg, which would contradict validationError.
		throw new SlothletError("GENERATE_MANIFEST_DIR_UNREADABLE", { dir: absDir, reason: err.message }, null, { validationError: true });
	}

	if (!stat.isDirectory()) {
		throw new SlothletError("GENERATE_MANIFEST_NOT_DIRECTORY", { dir: absDir }, null, { validationError: true });
	}

	return scanDir(absDir, absDir);
}

/**
 * Resolve the slothlet package root from this module's own location.
 *
 * `generate-manifest.mjs` always sits at `<root>/{src|dist}/lib/helpers/generate-manifest.mjs`,
 * so the package root is exactly three directories up regardless of the dev (`src`) or published
 * (`dist`) layout. (`@cldmv/slothlet/package.json` is not exported, so it can't be resolved.)
 *
 * @returns {string} Absolute path to the slothlet package root.
 */
function slothletPackageRoot() {
	return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

/**
 * Collect the full set of `@cldmv/slothlet[/sub]` specifiers the browser importmap must cover.
 *
 * Three sources, unioned so the map mirrors slothlet's public export surface: (1) declared flat entry points from package.json `exports` — so
 * every flat (non-wildcard) public module specifier a consumer can import resolves via the importmap, including public aggregators that
 * slothlet's own internals never import directly (notably the bare `@cldmv/slothlet/runtime`, whose
 * `/runtime/async` + `/runtime/live` variants are the only ones internally referenced); (2) a per-file
 * enumeration of every wildcard `exports` directory (`./helpers/*`, `./handlers/*`, …) so EVERY exported
 * subpath gets an entry by construction — not just the modules slothlet itself imports, so a browser can
 * never hit a wildcard endpoint the map lacks; and (3) a recursive source scan as a backstop for any
 * imported specifier the first two miss. i18n locales are handled separately — they are dynamic-template imports the
 * static scan can't see, and are enumerated separately from the languages directory. Inclusion here is about
 * specifier resolution, not runtime compatibility — some public exports (e.g. `typegen`, `devcheck`) are
 * Node-only and won't execute in a browser even though their specifier resolves. JSON exports (the
 * module-manifest schema) are tooling-only and excluded too — they aren't browser module imports. (#137)
 *
 * @param {string} root - The slothlet package root (holds package.json and the shipped source).
 * @returns {Promise<Set<string>>} The set of bare specifiers, always including `@cldmv/slothlet` and
 *   its flat (non-wildcard) public exports.
 */
async function collectSlothletSpecifiers(root) {
	const specifiers = new Set(["@cldmv/slothlet"]);

	// Seed slothlet's declared public entry points from package.json `exports`, so the importmap
	// always resolves every flat (non-wildcard) public module specifier — including public aggregators like the
	// bare `@cldmv/slothlet/runtime` that internals never import directly, which the source scan below
	// would otherwise miss (or pick up only fragilely from a doc comment that minification strips).
	const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
	for (const key of Object.keys(pkg.exports)) {
		// Skip wildcard patterns here (every file under them is enumerated per-file just below) and
		// non-module entries (the exported JSON schema is tooling-only, not a browser module import); i18n locales are enumerated separately.
		if (key.includes("*") || key.endsWith(".json")) continue;
		specifiers.add(key === "." ? "@cldmv/slothlet" : `@cldmv/slothlet${key.slice(1)}`);
	}

	// Enumerate every wildcard module-export directory so EVERY exported subpath gets an importmap
	// entry by construction — guaranteeing a browser can resolve any wildcard endpoint, even modules
	// slothlet's own source never imports. (i18n locales are enumerated in generateImportMap; the
	// JSON schema export isn't a browser module.)
	for (const [key, value] of Object.entries(pkg.exports)) {
		if (!key.includes("*") || key.startsWith("./i18n/language/")) continue;
		const specPrefix = `@cldmv/slothlet${key.slice(1)}`.split("*")[0]; // bare-specifier prefix for this namespace (text before the wildcard)
		// Every "*.mjs" filesystem target this export declares (dev `src/` + published `dist/`).
		const targets = [];
		(function collectTargets(v) {
			if (typeof v === "string") {
				if (v.includes("*") && v.endsWith(".mjs")) targets.push(v);
			} else if (v && typeof v === "object") {
				for (const child of Object.values(v)) collectTargets(child);
			}
		})(value);
		for (const tmpl of targets) {
			const star = tmpl.indexOf("*");
			const dirRel = tmpl.slice(0, star);
			const suffix = tmpl.slice(star + 1);
			let files;
			try {
				files = await fs.readdir(path.join(root, dirRel), { recursive: true });
			} catch {
				continue; // target dir absent in this layout (e.g. src/ missing in a published install)
			}
			for (const f of files) {
				const norm = String(f).replace(/\\/g, "/");
				if (norm.endsWith(suffix)) specifiers.add(specPrefix + norm.slice(0, -suffix.length));
			}
		}
	}

	// Enumerate the package `imports` field the same way. Internal-only modules (`#handlers/*`,
	// `#factories/*`) are no longer public exports, but slothlet's own browser code still imports
	// them by their `#`-prefixed specifier — which the page's importmap must resolve. Browsers accept
	// `#`-prefixed importmap keys, so the literal `#handlers/<name>` string becomes the map key.
	for (const [key, value] of Object.entries(pkg.imports ?? {})) {
		if (!key.includes("*")) continue;
		const specPrefix = key.split("*")[0]; // e.g. "#handlers/" — the literal importmap-key prefix
		const targets = [];
		(function collectTargets(v) {
			if (typeof v === "string") {
				if (v.includes("*") && v.endsWith(".mjs")) targets.push(v);
			} else if (v && typeof v === "object") {
				for (const child of Object.values(v)) collectTargets(child);
			}
		})(value);
		for (const tmpl of targets) {
			const star = tmpl.indexOf("*");
			const dirRel = tmpl.slice(0, star);
			const suffix = tmpl.slice(star + 1);
			let files;
			try {
				files = await fs.readdir(path.join(root, dirRel), { recursive: true });
			} catch {
				continue; // target dir absent in this layout (e.g. src/ missing in a published install)
			}
			for (const f of files) {
				const norm = String(f).replace(/\\/g, "/");
				if (norm.endsWith(suffix)) specifiers.add(specPrefix + norm.slice(0, -suffix.length));
			}
		}
	}

	// Backstop: scan slothlet's shipped source for any imported `@cldmv/slothlet` specifier the
	// export-driven steps above didn't add (defense-in-depth for an unusual export shape).
	const SKIP_DIRS = new Set(["node_modules", "types", "coverage", "tmp", "tests", "api_tests", ".git", "docs"]);
	async function scan(dir) {
		// Fail loud: slothlet's own package files are always present/readable, so an fs error here
		// means a corrupted install — surfacing it beats emitting a silently incomplete importmap.
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const e of entries) {
			if (e.isDirectory()) {
				if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) await scan(path.join(dir, e.name));
			} else if (/\.(mjs|cjs|js)$/.test(e.name)) {
				const src = await fs.readFile(path.join(dir, e.name), "utf8");
				let m;
				SLOTHLET_SPEC_RE.lastIndex = 0;
				while ((m = SLOTHLET_SPEC_RE.exec(src))) {
					const spec = m[1];
					// Ignore doc-comment fragments — only add resolvable subpaths (no glob/placeholder/
					// trailing-slash/empty segment), so the scan can't inject junk or trigger DEP0155.
					if (spec.startsWith("@cldmv/slothlet/i18n/language/")) continue;
					if (/[*<>]|\.\.\.|\/$/.test(spec) || spec.split("/").some((s) => s === "")) continue;
					specifiers.add(spec);
				}
			}
		}
	}
	await scan(root);
	return specifiers;
}

/**
 * Generate the browser importmap for slothlet's OWN modules.
 *
 * In a browser, slothlet's internal imports (`@cldmv/slothlet`, `@cldmv/slothlet/helpers/*`, …)
 * are static and resolved by the page's importmap **before slothlet runs** — they cannot route
 * through `resolveModuleSpecifier` (which only governs API-leaf loads). This produces that
 * importmap from slothlet's public export surface so consumers never hand-roll it.
 *
 * Each specifier is resolved via `import.meta.resolve`, which automatically picks the dev
 * (`slothlet-dev` → `src/`) or published (`default` → `dist/`) files based on the conditions of
 * the build process — then rebased onto `slothletBase` (where the package is served).
 *
 * @param {string} [slothletBase="/node_modules/@cldmv/slothlet/"] - URL/path prefix where the
 *   `@cldmv/slothlet` package is served in the browser. Defaults to the conventional node_modules
 *   location; override with a CDN URL, an Electron protocol path, or `"/"` when the package is
 *   served at the web root.
 * @returns {Promise<{ imports: Object<string,string> }>} An importmap object ready to inline as
 *   `<script type="importmap">`.
 */
async function generateImportMap(slothletBase = DEFAULT_SLOTHLET_BASE) {
	const base = String(slothletBase).endsWith("/") ? String(slothletBase) : `${slothletBase}/`;
	const root = slothletPackageRoot();
	const imports = {};

	for (const spec of await collectSlothletSpecifiers(root)) {
		let resolved;
		try {
			resolved = import.meta.resolve(spec);
			// An export can resolve at spec level while its target file is absent from the install
			// (#209 — `./devcheck` pointed at a file the `files` whitelist didn't ship). Verify the
			// target exists so a generated importmap never carries a URL that 404s by construction.
			await fs.access(fileURLToPath(resolved));
		} catch {
			// A scanned token that isn't actually a resolvable subpath (e.g. a docs/comment
			// fragment), or a declared export whose target file doesn't exist in this layout —
			// skip it rather than fail the whole importmap (or emit a dead entry).
			continue;
		}
		const rel = path.relative(root, fileURLToPath(resolved)).replace(/\\/g, "/");
		imports[spec] = base + rel;
	}

	// i18n locales arrive via dynamic import("@cldmv/slothlet/i18n/language/<lang>.json") — a
	// template the static scan can't see — so enumerate every shipped locale explicitly.
	try {
		const sampleDir = path.dirname(fileURLToPath(import.meta.resolve("@cldmv/slothlet/i18n/language/en-us.json")));
		for (const f of (await fs.readdir(sampleDir)).filter((n) => n.endsWith(".json"))) {
			const rel = path.relative(root, path.join(sampleDir, f)).replace(/\\/g, "/");
			imports[`@cldmv/slothlet/i18n/language/${f}`] = base + rel;
		}
	} catch {
		// No locales resolvable (unexpected) — importmap is still valid without them.
	}

	// The optional @cldmv/slothlet-i18n pack ships the non-base locales. When it's installed, enumerate
	// its locale dir too so a browser resolves `@cldmv/slothlet-i18n/language/<lang>.json`; it's served
	// from a sibling package location derived from `base`.
	try {
		const packRoot = path.dirname(fileURLToPath(import.meta.resolve("@cldmv/slothlet-i18n/package.json")));
		// Swap the final `@cldmv/slothlet` segment for the pack, preserving any `@version` suffix so a
		// versioned CDN base (e.g. .../@cldmv/slothlet@3/) maps to .../@cldmv/slothlet-i18n@3/ not the slothlet base.
		const packBase = base.replace(/@cldmv\/slothlet(@[^/]+)?\/$/, "@cldmv/slothlet-i18n$1/");
		// Only enumerate pack locales when the swap actually fired — i.e. `base` ended with the
		// `@cldmv/slothlet` segment. For a custom base served elsewhere (e.g. at "/") the replace is a
		// no-op and packBase would point back into the slothlet base; emit nothing rather than wrong
		// entries (the consumer can supply a pack base explicitly).
		if (packBase !== base) {
			for (const f of (await fs.readdir(path.join(packRoot, "languages"))).filter((n) => n.endsWith(".json"))) {
				imports[`@cldmv/slothlet-i18n/language/${f}`] = `${packBase}languages/${f}`;
			}
		}
	} catch {
		// Pack not installed — its locale entries are simply absent (core stays English-only).
	}

	return { imports };
}

/**
 * File extensions a browser importmap can point at — ES module JavaScript only. `.cjs` (CommonJS),
 * `.json`, `.node`, `.wasm`, and type stubs are excluded: they either can't load as an ESM import in
 * the browser or aren't module imports at all.
 * @param {string} rel - A target path (relative or bare filename).
 * @returns {boolean} True if `rel` names a browser-loadable ES module.
 */
function isBrowserModuleTarget(rel) {
	return /\.(mjs|js)$/.test(rel);
}

/**
 * Extract the bare package name from an import specifier.
 *
 * `"@scope/pkg/sub/x" → "@scope/pkg"`, `"pkg/sub" → "pkg"`, `"pkg" → "pkg"`. Returns `null` for
 * anything that isn't a bare package specifier — relative (`./`, `../`), absolute (`/`), package-
 * internal (`#imports`), or protocol-qualified (`node:`, `data:`, `http:`) — since none of those
 * resolve to a package whose `exports` we'd expand.
 *
 * @param {string} spec - The specifier as written in source.
 * @returns {string|null} The package name, or `null` if `spec` is not a bare package specifier.
 */
function packageNameOf(spec) {
	if (!spec || /^[./#]/.test(spec) || spec.includes(":")) return null;
	const parts = spec.split("/");
	if (spec.startsWith("@")) return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
	return parts[0];
}

/**
 * Pick the browser-appropriate target from an `exports`/`imports` value, resolving condition objects.
 *
 * Prefers `browser` → `import` → `module` → `default`, and deliberately ignores `node`/`require`
 * conditions: the importmap is for the browser, and a CommonJS (`require`) target can't load as an
 * ESM import there. Recurses through nested condition objects and array fallbacks (Node's ordered
 * fallback form), returning the first browser-loadable string it finds.
 *
 * @param {string|object|Array|null} value - An `exports`/`imports` entry value.
 * @returns {string|null} A relative target string (e.g. `"./src/lib/errors.mjs"`), or `null`.
 */
function pickBrowserTarget(value) {
	if (value == null) return null;
	if (typeof value === "string") return value;
	if (Array.isArray(value)) {
		for (const v of value) {
			const t = pickBrowserTarget(v);
			if (t) return t;
		}
		return null;
	}
	if (typeof value === "object") {
		for (const cond of ["browser", "import", "module", "default"]) {
			if (Object.prototype.hasOwnProperty.call(value, cond)) {
				const t = pickBrowserTarget(value[cond]);
				if (t) return t;
			}
		}
	}
	return null;
}

/**
 * Collect the exact importmap subpath keys for ANY package from its `package.json` `exports`.
 *
 * The package-agnostic counterpart to {@link collectSlothletSpecifiers}: given a package's root
 * directory, read its `exports` map and return the bare specifier → relative-target pairs a browser
 * importmap needs. Import maps do plain prefix substitution and never consult a package's `exports`,
 * so a subpath the `exports` map *redirects* (`@scope/pkg/errors` → `./src/lib/errors.mjs`) 404s
 * unless the importmap carries that exact key. This produces those keys.
 *
 * Handles the same shapes the self-collector does, generalized: the package root (`.`), flat
 * (non-wildcard) subpaths, wildcard directories (`./x/*` → every module file under the declared
 * target dir), conditional `exports` (via {@link pickBrowserTarget} — browser/import/default, never
 * node/require), and the string-exports and conditions-only (`.` sugar) forms. Only ES-module
 * targets are emitted (see {@link isBrowserModuleTarget}); a package with no `exports` (or an
 * unreadable `package.json`) yields an empty map — the prefix map already covers those.
 *
 * The returned targets are the paths the `exports` map itself declares, so the caller rebases them
 * onto wherever the package is served — no `import.meta.resolve` (which resolves from slothlet's own
 * scope, not the consumer's) is involved.
 *
 * @param {string} packageRoot - Absolute path to the package's root (the dir holding its package.json).
 * @returns {Promise<Map<string,string>>} Map of bare specifier → target path relative to `packageRoot`.
 * @public
 */
async function collectPackageSpecifiers(packageRoot) {
	const out = new Map();
	let pkg;
	try {
		pkg = JSON.parse(await fs.readFile(path.join(packageRoot, "package.json"), "utf8"));
	} catch {
		return out; // no readable package.json → nothing to expand
	}
	const name = pkg.name;
	if (!name || !pkg.exports) return out;

	// Normalize `exports` to subpath-keyed entries. A bare string, or a conditions-only object (no
	// "." keys, e.g. `{ import, require }`), is sugar for the package root (".").
	const field = pkg.exports;
	let entries;
	if (typeof field === "string") entries = [[".", field]];
	else entries = Object.keys(field).some((k) => k.startsWith(".")) ? Object.entries(field) : [[".", field]];

	for (const [key, value] of entries) {
		if (!key.startsWith(".")) continue; // only subpath keys (conditions inside are handled by pickBrowserTarget)
		if (key.includes("*")) {
			const tmpl = pickBrowserTarget(value);
			// Only enumerate wildcard templates that end in a module extension (the common `./x/*.mjs`
			// shape) — that keeps the suffix non-empty for the slice below and skips non-module targets.
			if (!tmpl || !tmpl.includes("*")) continue;
			const star = tmpl.indexOf("*");
			const suffix = tmpl.slice(star + 1);
			if (!isBrowserModuleTarget(suffix)) continue;
			const specPrefix = (key === "./*" ? `${name}/` : `${name}${key.slice(1)}`).split("*")[0];
			const dirRel = tmpl.slice(0, star).replace(/^\.\//, "");
			let files;
			try {
				files = await fs.readdir(path.join(packageRoot, dirRel), { recursive: true });
			} catch {
				continue; // declared wildcard dir absent in this layout — skip
			}
			for (const f of files) {
				const norm = String(f).replace(/\\/g, "/");
				if (norm.endsWith(suffix)) out.set(specPrefix + norm.slice(0, -suffix.length), dirRel + norm);
			}
		} else {
			const tmpl = pickBrowserTarget(value);
			if (!tmpl || !isBrowserModuleTarget(tmpl)) continue;
			out.set(key === "." ? name : `${name}${key.slice(1)}`, tmpl.replace(/^\.\//, ""));
		}
	}
	return out;
}

/**
 * Resolve a package's root directory by the Node `node_modules` lookup, starting from `fromDir`.
 *
 * Ascends from `fromDir` checking `<dir>/node_modules/<name>/package.json` at each level — the
 * standard resolution a browser build's consumer tree follows — and returns the first match. Purely
 * filesystem-based (no `import.meta.resolve`), so it resolves the *consumer's* packages rather than
 * slothlet's own dependency scope.
 *
 * @param {string} name - Bare package name (e.g. `"@scope/pkg"`).
 * @param {string} fromDir - Absolute directory to begin the ascent from (the consumer's API dir).
 * @returns {Promise<string|null>} Absolute package root, or `null` if not found in any ancestor.
 */
async function resolvePackageRoot(name, fromDir) {
	let dir = path.resolve(fromDir);
	for (;;) {
		const candidate = path.join(dir, "node_modules", ...name.split("/"));
		try {
			if ((await fs.stat(path.join(candidate, "package.json"))).isFile()) return candidate;
		} catch {
			/* not here — keep ascending */
		}
		const parent = path.dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

/**
 * Scan a consumer's registered API directory for the bare package specifiers its leaves import.
 *
 * Recursively reads every module file under `apiDir` (skipping `node_modules` and dot/`__` entries)
 * and collects the specifier of every static/dynamic import and re-export. This is how the general
 * collector discovers *which* third-party packages are in the browser module graph — the registered
 * API leaves are exactly the code the browser will load and whose imports it must resolve.
 *
 * @param {string} apiDir - Absolute path to the consumer's API root directory.
 * @returns {Promise<Set<string>>} The set of specifiers as written in source.
 */
async function scanApiDirSpecifiers(apiDir) {
	const specs = new Set();
	async function walk(dir) {
		let entries;
		try {
			entries = await fs.readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const e of entries) {
			if (SKIP_PREFIXES.some((p) => e.name.startsWith(p))) continue;
			const abs = path.join(dir, e.name);
			if (e.isDirectory()) {
				if (e.name !== "node_modules") await walk(abs);
			} else if (/\.(mjs|cjs|js|mts|cts|ts)$/.test(e.name)) {
				const src = await fs.readFile(abs, "utf8");
				let m;
				IMPORT_SPEC_RE.lastIndex = 0;
				while ((m = IMPORT_SPEC_RE.exec(src))) specs.add(m[1]);
			}
		}
	}
	await walk(path.resolve(apiDir));
	return specs;
}

/**
 * Build the importmap entries for every third-party package in the consumer's API module graph.
 *
 * Discovers the packages the registered API leaves import ({@link scanApiDirSpecifiers}), resolves
 * each from the consumer tree ({@link resolvePackageRoot}), expands its `exports`
 * ({@link collectPackageSpecifiers}), and rebases the targets onto where that package is served
 * (`packagesBase` + package name). Slothlet's own specifiers are skipped here — they're covered by
 * the focused collector under `slothletBase`. Every entry is verified to exist on disk so a generated
 * importmap never carries a URL that 404s by construction. Packages that don't resolve from the
 * consumer tree, or expose no `exports`, are left to the page's prefix map. (#297)
 *
 * @param {string} apiDir - Absolute or relative path to the consumer's API root directory.
 * @param {string} packagesBase - URL/path prefix where sibling packages are served (ends with `/`).
 * @returns {Promise<Object<string,string>>} Bare specifier → served URL for each resolvable subpath.
 */
async function collectGraphImports(apiDir, packagesBase) {
	const imports = {};
	const absApiDir = path.resolve(apiDir);
	const names = new Set();
	for (const spec of await scanApiDirSpecifiers(absApiDir)) {
		const name = packageNameOf(spec);
		// slothlet's own surface is emitted by generateImportMap under slothletBase — don't double-map it.
		if (!name || name === "@cldmv/slothlet") continue;
		names.add(name);
	}
	for (const name of names) {
		const root = await resolvePackageRoot(name, absApiDir);
		if (!root) continue; // not resolvable from the consumer tree — leave to the prefix map
		const pkgBase = `${packagesBase}${name}/`;
		for (const [spec, relTarget] of await collectPackageSpecifiers(root)) {
			try {
				await fs.access(path.join(root, relTarget));
			} catch {
				continue; // declared target missing on disk — never emit a dead entry
			}
			imports[spec] = pkgBase + relTarget;
		}
	}
	return imports;
}

/**
 * Derive where sibling packages are served from `slothletBase`.
 *
 * Sibling packages sit next to `@cldmv/slothlet` under a shared root — a `node_modules` root served
 * at the web root, or a CDN root (`https://cdn/@cldmv/slothlet@3/` → `https://cdn/`). Strip the
 * trailing `@cldmv/slothlet[@version]/` segment to get that root. When `slothletBase` isn't the
 * standard package layout (e.g. slothlet served at `"/"`), fall back to the conventional
 * `"/node_modules/"` root.
 *
 * @param {string} base - The normalized (trailing-slash) `slothletBase`.
 * @returns {string} The served base for sibling packages (ends with `/`).
 */
function derivePackagesBase(base) {
	const stripped = base.replace(/@cldmv\/slothlet(@[^/]+)?\/$/, "");
	return stripped !== base ? stripped : "/node_modules/";
}

/**
 * Generate everything the browser needs to run slothlet, in one build-time call.
 *
 * Returns both halves of a browser-mode setup:
 * - `manifest` — the API-directory listing passed to `slothlet({ manifest })` (replaces the
 *   filesystem `readdir` slothlet uses in Node).
 * - `importmap` — the `<script type="importmap">` content that lets the browser resolve slothlet's
 *   own module graph AND the third-party packages the registered API leaves import.
 *
 * Run this in your build step (or, for Electron, in the main process) and send both to the
 * renderer: inline `importmap` into the page's importmap script tag, and pass `manifest` (plus a
 * `resolveModuleSpecifier` for your API base) to `slothlet()`.
 *
 * The importmap covers two surfaces. First, slothlet's own modules (rebased onto `slothletBase`).
 * Second — and this is what the registered API leaves need — the **exact `exports` subpaths** of the
 * other packages in the browser graph: the generator scans the `apiDir` leaves for the packages they
 * import, reads each package's `package.json` `exports`, and emits the redirected subpath keys a
 * plain prefix map can't produce (`@scope/ext/errors` → `…/@scope/ext/src/lib/errors.mjs`). Without
 * these, a subpath the `exports` map redirects resolves to a literal URL and 404s in the browser, so
 * consumers previously hand-maintained allowlists. Those sibling packages are served next to
 * `@cldmv/slothlet` under a base **derived** from `slothletBase` (its node_modules/CDN parent). (#297)
 *
 * @param {string} apiDir - Absolute or relative path to the API root directory.
 * @param {object} [options] - Options.
 * @param {string} [options.slothletBase="/node_modules/@cldmv/slothlet/"] - URL/path prefix where
 *   the `@cldmv/slothlet` package is served in the browser. Defaults to the conventional
 *   node_modules location (slothlet installed as a dependency, node_modules served at the web
 *   root). Override with a CDN URL, an Electron protocol path, or `"/"` when the package is served
 *   at the web root.
 * @returns {Promise<{ manifest: { files: Array, directories: Array }, importmap: { imports: Object<string,string> } }>}
 *   The API manifest and slothlet's own browser importmap.
 *
 * @throws {SlothletError} `GENERATE_BROWSER_ASSETS_SLOTHLET_BASE_INVALID` if `options.slothletBase` is provided but is not a string.
 *
 * @example
 * // Build step — slothlet installed in node_modules (default base), ship both to the renderer.
 * import { generateBrowserAssets } from "@cldmv/slothlet/helpers/generate-manifest";
 * const { manifest, importmap } = await generateBrowserAssets("./src/api");
 * // → inline importmap: `<script type="importmap">${JSON.stringify(importmap)}</script>`
 * // → pass manifest to slothlet({ manifest, resolveModuleSpecifier })
 *
 * @example
 * // Override the base for a CDN (or "/" when the package is served at the web root).
 * const { manifest, importmap } = await generateBrowserAssets("./src/api", {
 *   slothletBase: "https://cdn.example.com/@cldmv/slothlet@3/"
 * });
 */
async function generateBrowserAssets(apiDir, options = {}) {
	const { slothletBase = DEFAULT_SLOTHLET_BASE } = options;
	if (typeof slothletBase !== "string") {
		throw new SlothletError("GENERATE_BROWSER_ASSETS_SLOTHLET_BASE_INVALID", { received: typeof slothletBase }, null, {
			validationError: true
		});
	}
	// Sibling packages sit next to @cldmv/slothlet under a shared served root, derived from slothletBase.
	const base = String(slothletBase).endsWith("/") ? String(slothletBase) : `${slothletBase}/`;
	const packagesBase = derivePackagesBase(base);
	const [manifest, importmap, graphImports] = await Promise.all([
		generateManifest(apiDir),
		generateImportMap(slothletBase),
		collectGraphImports(apiDir, packagesBase)
	]);
	// Merge the consumer graph's third-party subpath keys under the slothlet map. Slothlet's own
	// entries win on any collision (the graph collector already skips `@cldmv/slothlet`, so there are none).
	importmap.imports = { ...graphImports, ...importmap.imports };
	return { manifest, importmap };
}

export { generateManifest, generateBrowserAssets, generateImportMap, collectSlothletSpecifiers, collectPackageSpecifiers };
