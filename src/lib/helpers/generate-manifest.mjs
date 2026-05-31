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
 * @throws {Error} If `dir` is not a non-empty string.
 * @throws {Error} If `dir` cannot be read (does not exist, not a directory, permission denied).
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
		throw new Error(`generateManifest: dir must be a non-empty string, received ${typeof dir}`);
	}

	const absDir = path.resolve(dir);

	// Verify it exists and is a directory before scanning
	let stat;
	try {
		stat = await fs.stat(absDir);
	} catch (err) {
		throw new Error(`generateManifest: cannot read directory "${absDir}": ${err.message}`, { cause: err });
	}

	if (!stat.isDirectory()) {
		throw new Error(`generateManifest: "${absDir}" is not a directory`);
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
 * Recursively collect every `@cldmv/slothlet[/sub]` specifier slothlet imports from its own
 * shipped source under `root` (so the browser importmap covers the full static module graph).
 * i18n locale specifiers are excluded — they are dynamic-template imports the static scan can't
 * see, and are enumerated separately from the languages directory.
 *
 * @param {string} root - The slothlet package root to scan.
 * @returns {Promise<Set<string>>} The set of bare specifiers, always including `@cldmv/slothlet`.
 */
async function collectSlothletSpecifiers(root) {
	const specifiers = new Set(["@cldmv/slothlet"]);
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
					if (!m[1].startsWith("@cldmv/slothlet/i18n/language/")) specifiers.add(m[1]);
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
 * importmap from slothlet's real module graph so consumers never hand-roll it.
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
		for (const f of await fs.readdir(sampleDir)) {
			if (f.endsWith(".json")) {
				const rel = path.relative(root, path.join(sampleDir, f)).replace(/\\/g, "/");
				imports[`@cldmv/slothlet/i18n/language/${f}`] = base + rel;
			}
		}
	} catch {
		// No locales resolvable (unexpected) — importmap is still valid without them.
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
 * @throws {Error} If `options.slothletBase` is provided but is not a string.
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
		throw new Error(
			`generateBrowserAssets: options.slothletBase must be a string (where @cldmv/slothlet is served in the browser), received ${typeof slothletBase}`
		);
	}
	const [manifest, importmap] = await Promise.all([generateManifest(apiDir), generateImportMap(slothletBase)]);
	return { manifest, importmap };
}

export { generateManifest, generateBrowserAssets, generateImportMap };
