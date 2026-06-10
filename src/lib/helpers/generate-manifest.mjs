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
 *   Returns `{ manifest, importmap }`: the API-directory manifest **and** the importmap for
 *   slothlet's own modules, so browser consumers never hand-roll the latter (see #123).
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
		} catch {
			// A scanned token that isn't actually a resolvable subpath (e.g. a docs/comment
			// fragment) — skip it rather than fail the whole importmap.
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
		const packBase = base.replace(/@cldmv\/slothlet\/$/, "@cldmv/slothlet-i18n/");
		for (const f of (await fs.readdir(path.join(packRoot, "languages"))).filter((n) => n.endsWith(".json"))) {
			imports[`@cldmv/slothlet-i18n/language/${f}`] = `${packBase}languages/${f}`;
		}
	} catch {
		// Pack not installed — its locale entries are simply absent (core stays English-only).
	}

	return { imports };
}

/**
 * Generate everything the browser needs to run slothlet, in one build-time call.
 *
 * Returns both halves of a browser-mode setup:
 * - `manifest` — the API-directory listing passed to `slothlet({ manifest })` (replaces the
 *   filesystem `readdir` slothlet uses in Node).
 * - `importmap` — the `<script type="importmap">` content that lets the browser resolve
 *   slothlet's OWN module graph (so consumers don't hand-roll it).
 *
 * Run this in your build step (or, for Electron, in the main process) and send both to the
 * renderer: inline `importmap` into the page's importmap script tag, and pass `manifest` (plus a
 * `resolveModuleSpecifier` for your API base) to `slothlet()`.
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
	const [manifest, importmap] = await Promise.all([generateManifest(apiDir), generateImportMap(slothletBase)]);
	return { manifest, importmap };
}

export { generateManifest, generateBrowserAssets, generateImportMap, collectSlothletSpecifiers };
