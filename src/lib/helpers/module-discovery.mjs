/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/module-discovery.mjs
 *	@Date: 2026-05-27T11:22:33-07:00 (1779906153)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-27 18:57:20 -07:00 (1779933440)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Pure async module discovery for slothlet plugin modules.
 * @module @cldmv/slothlet/helpers/module-discovery
 * @internal
 *
 * @description
 * Walks the filesystem looking for slothlet modules per the design locked in
 * the review (see reference/plugin-discovery-mount-review.md). Returns
 * `DiscoverResult[]` — does not mount anything.
 *
 * Scan-root resolution (S6): default is an upward-walk from `process.cwd()`
 * looking for the first ancestor with a `node_modules` directory, capped at 20
 * levels. Falls back to `process.cwd()` if no `node_modules` found.
 *
 * Per-root mode auto-detect (G6): if `<scanRoot>/node_modules` exists, scan in
 * npm mode (walk `node_modules/*` and `node_modules/@*\/*`). Otherwise scan in
 * folder mode (immediate subfolders of `scanRoot` containing a manifest).
 *
 * Dedupe and multi-version handling (G7):
 *  - Same real path → dedupe silently (first wins).
 *  - Same packageName + different versions → both surface as separate results.
 *  - Same packageName + same version + different real paths → throws
 *    MODULE_DUPLICATE_NAME_VERSION_MISMATCH.
 *
 * Manifest source override: `manifest` option accepts a `<file>#<dotted.key>`
 * locator. Default is `"slothlet.module.json"`.
 *
 * Field-name remap (S1): `schema` option maps canonical field names to the
 * legacy manifest's names, e.g. `{ mountPath: "apiPath" }`.
 *
 * Prefix filter (G6 pre-skip): name-prefix filtering runs DURING directory
 * enumeration, before any manifest is read. `prefix: string | string[]`
 * matches against the full package name including scope (literal startsWith).
 *
 * Content filter: `filter(manifest, packageName) => boolean` runs AFTER
 * manifest validation. Falsy return excludes the result.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { SlothletError } from "@cldmv/slothlet/errors";
import { validateModuleManifest } from "@cldmv/slothlet/helpers/module-manifest-validator";

const DEFAULT_MANIFEST_FILE = "slothlet.module.json";
const UPWARD_WALK_CAP = 20;

/**
 * @typedef {object} DiscoverOptions
 * @property {string|string[]} [scanRoot] - Filesystem path(s) to scan. Default: upward-walk from process.cwd() to nearest node_modules ancestor.
 * @property {string} [manifest="slothlet.module.json"] - Manifest filename, or `<file>#<dotted.key>` locator pointing at a subkey of another file (e.g. `"package.json#slothlet"`).
 * @property {Record<string, string>} [schema] - Field-name remap for legacy manifests. Maps canonical name → legacy name.
 * @property {string|string[]} [prefix] - Name-prefix filter applied BEFORE manifest read. Matches against full package name including scope.
 * @property {(manifest: object, packageName: string) => boolean} [filter] - Content-based filter applied AFTER manifest validation.
 */

/**
 * @typedef {object} DiscoverResult
 * @property {string} packageName - Package name from package.json.
 * @property {string} packageRoot - Resolved absolute filesystem path to the package directory.
 * @property {string[]} mountPath - Normalized mountPath segments (always an array).
 * @property {string} apiDir - Absolute resolved filesystem path to the apiDir inside the package.
 * @property {object} manifest - Normalized + deep-frozen manifest (per M3).
 */

/**
 * Walk the filesystem and return validated module candidates.
 *
 * @param {DiscoverOptions} [options] - Discovery options.
 * @returns {Promise<DiscoverResult[]>} Discovered modules in walk order (apply `sort()` for deterministic ordering).
 * @throws {SlothletError} `MODULE_*` codes on manifest validation failures or G7 duplicate-name-version-mismatch.
 *
 * @example
 * import { discoverModules } from "@cldmv/slothlet/helpers/module-discovery";
 *
 * const found = await discoverModules();
 * // Default upward-walk scanRoot, default slothlet.module.json manifest.
 *
 * @example
 * const drivers = await discoverModules({
 *   prefix: "@cldmv/packrat-driver-",
 *   filter: (m) => m.kind === "driver"
 * });
 */
export async function discoverModules(options = {}) {
	const scanRoots = await resolveScanRoots(options.scanRoot);
	const manifestSource = parseManifestSource(options.manifest);
	const fieldSchema = options.schema ?? {};
	const filterFn = options.filter;
	const prefixes = normalizePrefixes(options.prefix);

	// Gather candidate package directories from all scanRoots.
	const candidates = [];
	for (const root of scanRoots) {
		const mode = await detectScanMode(root);
		if (mode === "npm") {
			candidates.push(...(await enumerateNpmPackages(root, prefixes)));
		} else {
			candidates.push(...(await enumerateFolderModules(root, prefixes)));
		}
	}

	// Track results, real-path dedupe, and per-(name@version) realpath registry.
	const results = [];
	const seenRealPaths = new Set();
	/** @type {Map<string, string>} */ const realPathByNameVersion = new Map();

	for (const candidate of candidates) {
		// Resolve real path early so symlink-aliased duplicates dedupe before any I/O on manifests.
		let realPath;
		try {
			realPath = await fs.realpath(candidate.path);
		} catch {
			// Broken symlink or candidate vanished between readdir() and realpath().
			// Skip silently — not a slothlet-module concern.
			continue;
		}
		if (seenRealPaths.has(realPath)) continue;
		seenRealPaths.add(realPath);

		const pkgJsonPath = path.join(realPath, "package.json");
		const pkg = await readJsonOrNull(pkgJsonPath);
		if (!pkg || typeof pkg.name !== "string" || typeof pkg.version !== "string") {
			// No usable package.json — silently skip; not a slothlet module concern.
			continue;
		}

		const manifestPath = path.join(realPath, manifestSource.file);
		const manifestRaw = await loadManifestRaw(manifestPath, manifestSource, pkg.name);
		if (manifestRaw === undefined) continue; // file or subkey missing → not a module

		// Apply field-name remap (S1) before validation.
		const remapped = applySchemaRemap(manifestRaw, fieldSchema);

		// Lenient assume-v1 when schemaVersion is absent under override locator (S2).
		if (manifestSource.isOverride && remapped.schemaVersion === undefined) {
			remapped.schemaVersion = 1;
		}

		// Validate (throws MODULE_* on any rule violation).
		const normalized = validateModuleManifest(remapped, {
			packageName: pkg.name,
			packageVersion: pkg.version,
			packageDescription: pkg.description,
			packageRoot: realPath,
			manifestPath
		});

		// Content filter (post-manifest-read).
		if (typeof filterFn === "function" && !filterFn(normalized, pkg.name)) {
			continue;
		}

		// G7 case 3: same name+version, different real paths → throw.
		const nameVersionKey = `${pkg.name}@${pkg.version}`;
		if (realPathByNameVersion.has(nameVersionKey)) {
			const otherRealPath = realPathByNameVersion.get(nameVersionKey);
			// `seenRealPaths.has(realPath) continue` earlier in this loop guarantees
			// each realPath is processed at most once, so any prior entry for this
			// name@version key necessarily came from a DIFFERENT realPath — the
			// equal-paths branch is unreachable. Defensive guard kept for safety
			// against an upstream refactor that loosens the realPath dedupe.
			/* v8 ignore next */
			if (otherRealPath !== realPath) {
				throw new SlothletError(
					"MODULE_DUPLICATE_NAME_VERSION_MISMATCH",
					{
						packageName: pkg.name,
						version: pkg.version,
						paths: [otherRealPath, realPath].join(", ")
					},
					null,
					{ validationError: true }
				);
			}
		} else {
			realPathByNameVersion.set(nameVersionKey, realPath);
		}

		const apiDirAbs = path.resolve(realPath, normalized.apiDir);
		results.push(
			Object.freeze({
				packageName: pkg.name,
				packageRoot: realPath,
				mountPath: Object.freeze([...normalized.mountPath]),
				apiDir: apiDirAbs,
				manifest: deepFreeze(normalized)
			})
		);
	}

	return results;
}

// ─── Scan-root resolution ────────────────────────────────────────────────────

/**
 * Resolve the `scanRoot` option into an array of absolute paths.
 * Default: upward-walk from process.cwd() to nearest node_modules ancestor (S6, max 20 levels).
 *
 * @param {string|string[]} [opt]
 * @returns {Promise<string[]>}
 * @private
 */
async function resolveScanRoots(opt) {
	if (opt === undefined) {
		return [await defaultScanRoot()];
	}
	if (typeof opt === "string") {
		return [path.resolve(opt)];
	}
	if (Array.isArray(opt)) {
		return opt.map((p) => path.resolve(p));
	}
	throw new SlothletError(
		"INVALID_ARGUMENT",
		{
			argument: "scanRoot",
			expected: "string or string[]",
			received: typeof opt
		},
		null,
		{ validationError: true }
	);
}

/**
 * Walk upward from process.cwd() looking for the first ancestor containing a
 * node_modules directory. Capped at 20 levels per S6. Falls back to cwd().
 *
 * @returns {Promise<string>}
 * @private
 */
async function defaultScanRoot() {
	let current = process.cwd();
	for (let i = 0; i < UPWARD_WALK_CAP; i++) {
		try {
			const stat = await fs.stat(path.join(current, "node_modules"));
			if (stat.isDirectory()) return current;
		} catch {
			// not present at this level
		}
		const parent = path.dirname(current);
		if (parent === current) break; // reached filesystem root
		current = parent;
	}
	return process.cwd();
}

/**
 * Detect npm-mode vs folder-mode for a scanRoot.
 * @param {string} root
 * @returns {Promise<"npm"|"folder">}
 * @private
 */
async function detectScanMode(root) {
	try {
		const stat = await fs.stat(path.join(root, "node_modules"));
		if (stat.isDirectory()) return "npm";
	} catch {
		// fallthrough to folder mode (node_modules absent — common case for in-repo
		// development trees)
	}
	return "folder";
}

// ─── Enumeration ─────────────────────────────────────────────────────────────

/**
 * Walk `<root>/node_modules/*` and `<root>/node_modules/@*\/*` (one level deep).
 * Applies the prefix filter as a pre-skip (no fs.access if a prefix is set and doesn't match).
 *
 * @param {string} root
 * @param {string[]|null} prefixes
 * @returns {Promise<Array<{path: string, packageName: string}>>}
 * @private
 */
async function enumerateNpmPackages(root, prefixes) {
	const nodeModules = path.join(root, "node_modules");
	const out = [];
	let entries;
	try {
		entries = await fs.readdir(nodeModules, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
		if (entry.name.startsWith(".")) continue; // skip .pnpm, .bin, .package-lock.json, etc.
		if (entry.name.startsWith("@")) {
			// Scoped — walk one level deeper.
			const scopeDir = path.join(nodeModules, entry.name);
			let scopedEntries;
			try {
				scopedEntries = await fs.readdir(scopeDir, { withFileTypes: true });
			} catch {
				// scopeDir is a broken symlink, vanished, or otherwise unreadable.
				continue;
			}
			for (const scoped of scopedEntries) {
				if (!scoped.isDirectory() && !scoped.isSymbolicLink()) continue;
				const fullName = `${entry.name}/${scoped.name}`;
				if (!matchesPrefix(fullName, prefixes)) continue;
				out.push({ path: path.join(scopeDir, scoped.name), packageName: fullName });
			}
		} else {
			if (!matchesPrefix(entry.name, prefixes)) continue;
			out.push({ path: path.join(nodeModules, entry.name), packageName: entry.name });
		}
	}
	return out;
}

/**
 * Walk immediate subfolders of `root` (folder mode — no node_modules).
 *
 * @param {string} root
 * @param {string[]|null} prefixes
 * @returns {Promise<Array<{path: string, packageName: string}>>}
 * @private
 */
async function enumerateFolderModules(root, prefixes) {
	const out = [];
	let entries;
	try {
		entries = await fs.readdir(root, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
		if (entry.name.startsWith(".")) continue;
		// In folder mode, the directory name acts as the candidate packageName
		// for prefix-matching purposes. Actual package identity comes from each
		// subdir's package.json once we read it.
		if (!matchesPrefix(entry.name, prefixes)) continue;
		out.push({ path: path.join(root, entry.name), packageName: entry.name });
	}
	return out;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalize `prefix` option into an array of strings, or null when no filter.
 * @param {string|string[]|undefined} opt
 * @returns {string[]|null}
 * @private
 */
function normalizePrefixes(opt) {
	if (opt === undefined) return null;
	if (typeof opt === "string") return [opt];
	if (Array.isArray(opt)) {
		if (opt.length === 0) return null;
		return opt.slice();
	}
	throw new SlothletError(
		"INVALID_ARGUMENT",
		{
			argument: "prefix",
			expected: "string or string[]",
			received: typeof opt
		},
		null,
		{ validationError: true }
	);
}

/**
 * @param {string} name
 * @param {string[]|null} prefixes
 * @returns {boolean}
 * @private
 */
function matchesPrefix(name, prefixes) {
	if (!prefixes) return true;
	for (const p of prefixes) {
		if (name.startsWith(p)) return true;
	}
	return false;
}

/**
 * Parse `manifest` option into `{file, subkey, isOverride}`.
 * Default: `{ file: "slothlet.module.json", subkey: null, isOverride: false }`.
 * `<file>#<dotted.key>` form sets subkey and isOverride.
 *
 * @param {string|undefined} opt
 * @returns {{file: string, subkey: string|null, isOverride: boolean}}
 * @private
 */
function parseManifestSource(opt) {
	if (opt === undefined) {
		return { file: DEFAULT_MANIFEST_FILE, subkey: null, isOverride: false };
	}
	if (typeof opt !== "string" || opt.length === 0) {
		throw new SlothletError(
			"INVALID_ARGUMENT",
			{
				argument: "manifest",
				expected: "string",
				received: typeof opt
			},
			null,
			{ validationError: true }
		);
	}
	const hashIdx = opt.indexOf("#");
	if (hashIdx === -1) {
		return { file: opt, subkey: null, isOverride: opt !== DEFAULT_MANIFEST_FILE };
	}
	const file = opt.slice(0, hashIdx);
	const subkey = opt.slice(hashIdx + 1);
	if (file.length === 0 || subkey.length === 0) {
		throw new SlothletError(
			"INVALID_ARGUMENT",
			{
				argument: "manifest",
				expected: "<file>#<dotted.key> with both parts non-empty",
				received: opt
			},
			null,
			{ validationError: true }
		);
	}
	return { file, subkey, isOverride: true };
}

/**
 * Read and parse a JSON file. Returns null on missing file or parse error.
 * @param {string} filePath
 * @returns {Promise<object|null>}
 * @private
 */
async function readJsonOrNull(filePath) {
	let content;
	try {
		content = await fs.readFile(filePath, "utf8");
	} catch {
		return null;
	}
	try {
		return JSON.parse(content);
	} catch {
		return null;
	}
}

/**
 * Load the raw manifest object for a package, honoring `<file>#<subkey>` locators.
 * Returns undefined if the file is missing or the subkey doesn't resolve.
 * Throws MODULE_MANIFEST_INVALID for malformed JSON on the default fast path.
 *
 * @param {string} manifestPath
 * @param {{file: string, subkey: string|null, isOverride: boolean}} source
 * @param {string} packageName - The package's `name` field from package.json (already read by the caller). Used in the JSON-parse error context so scoped packages (`@scope/pkg`) report correctly instead of degrading to the directory basename (`pkg`).
 * @returns {Promise<object|undefined>}
 * @private
 */
async function loadManifestRaw(manifestPath, source, packageName) {
	let content;
	try {
		content = await fs.readFile(manifestPath, "utf8");
	} catch {
		return undefined; // file missing → not a slothlet module here
	}
	let parsed;
	try {
		parsed = JSON.parse(content);
	} catch (err) {
		throw new SlothletError(
			"MODULE_MANIFEST_INVALID",
			{
				packageName,
				manifestPath,
				reason: `JSON parse error: ${err.message}`
			},
			err,
			{ validationError: true }
		);
	}
	if (source.subkey === null) {
		return parsed;
	}
	// Walk the dotted subkey path.
	const parts = source.subkey.split(".");
	let cur = parsed;
	for (const part of parts) {
		if (cur === null || typeof cur !== "object" || !(part in cur)) {
			return undefined;
		}
		cur = cur[part];
	}
	if (cur === null || typeof cur !== "object" || Array.isArray(cur)) {
		return undefined;
	}
	return cur;
}

/**
 * Apply the `schema` field-name remap, returning a new object with canonical field names.
 * Canonical fields not in the remap pass through under their original names if present.
 *
 * @param {object} raw - The raw (possibly legacy-shaped) manifest object.
 * @param {Record<string, string>} schemaMap - canonical → legacy key map.
 * @returns {object} New object with canonical field names.
 * @private
 */
function applySchemaRemap(raw, schemaMap) {
	if (!schemaMap || Object.keys(schemaMap).length === 0) {
		return raw;
	}
	const out = { ...raw };
	for (const [canonical, legacy] of Object.entries(schemaMap)) {
		if (legacy === canonical) continue;
		if (out[canonical] !== undefined) continue; // canonical name already present → don't override
		if (legacy in out) {
			out[canonical] = out[legacy];
			delete out[legacy];
		}
	}
	return out;
}

/**
 * Recursively freeze an object so sort comparators and downstream consumers
 * cannot mutate it (per M3).
 *
 * @template T
 * @param {T} obj
 * @returns {T}
 * @private
 */
function deepFreeze(obj) {
	// Defensive early-return for null / primitive / already-frozen inputs. The sole
	// current caller is `discoverModules` (line ~190) which always invokes with a
	// fresh, never-frozen object literal from `validateModuleManifest`; recursive
	// calls below (line ~545) filter values via `if (value !== null && typeof value
	// === "object")` so null / primitive inputs never reach the recursive call.
	// All three conditions of this OR thus evaluate to false in every invocation
	// today; the guard exists for callers that may legitimately pass a frozen tree.
	/* v8 ignore next */
	if (obj === null || typeof obj !== "object" || Object.isFrozen(obj)) return obj;
	Object.freeze(obj);
	for (const key of Object.keys(obj)) {
		const value = obj[key];
		if (value !== null && typeof value === "object") {
			deepFreeze(value);
		}
	}
	return obj;
}
