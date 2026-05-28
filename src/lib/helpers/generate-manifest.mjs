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
 * @fileoverview Build-time helper that generates a slothlet manifest from a directory.
 *
 * @description
 * `generateManifest(dir)` recursively scans a directory and returns the manifest object
 * required by `slothlet({ manifest, resolveModuleSpecifier })` for browser / worker mode.
 *
 * This is a **Node.js-only build-time utility** — it uses `node:fs` and should be called
 * during your build step (e.g. from a Vite plugin, Webpack loader, or build script) to
 * produce a manifest that is then bundled into your browser build.
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
 * Check whether a filename should be included as an API file.
 *
 * @param {string} filename - Bare filename including extension.
 * @returns {boolean} True if the file should be included.
 *
 * @example
 * isApiFile("math.mjs");    // true
 * isApiFile("__config.mjs"); // false
 * isApiFile(".hidden.mjs");  // false
 * isApiFile("README.md");    // false
 */
function isApiFile(filename) {
	if (SKIP_PREFIXES.some((p) => filename.startsWith(p))) return false;
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
		throw new Error(`generateManifest: cannot read directory "${absDir}": ${err.message}`);
	}

	if (!stat.isDirectory()) {
		throw new Error(`generateManifest: "${absDir}" is not a directory`);
	}

	return scanDir(absDir, absDir);
}

export { generateManifest };
