/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/module-discovery.mjs
 *	@Date: 2026-05-27T11:22:33-07:00 (1779906153)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:16:13-08:00 (1794874573)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
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
 * Per-root mode auto-detect (G6): if `<root>/node_modules` exists, scan in
 * npm mode (walk `node_modules/*` and `node_modules/@*\/*`). Otherwise scan in
 * folder mode (immediate subfolders of `root` containing a manifest).
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

import { SlothletError } from "#errors";
import { t } from "#i18n";
import { validateModuleManifest } from "#helpers/module-manifest-validator";

// Node-only static imports resolved via top-level await so `node:*` never
// enters the static-import graph in browser bundles. Module discovery walks
// the filesystem — it has no meaning in browser mode.
// fsp (fs/promises) + path resolved in the platform module (#123); both are null in a browser —
// filesystem-walking module discovery has no meaning in browser mode.
import { fsp, path } from "#helpers/platform";
import {
	appendList,
	ArrayMethods,
	Arrays,
	copyList,
	JSON,
	listPush,
	Map,
	mapList,
	MapMethods,
	Objects,
	Processes,
	Set,
	SetMethods,
	splitText,
	StringMethods
} from "#helpers/intrinsics";

// --- API-RULES condition markers (see docs/API-RULES/API-DISCOVERY-CONDITIONS.md) ---
// Rule 15 (G09): Reserved mountPath-root rejection — module-manifest-validator.mjs ~L189
// Rule 15 (G10): External-module validity gate — ~L139 / ~L146
// Rule 15 (G11): Real-path dedupe & duplicate name@version — ~L128 / ~L172
// Rule 15 (G12): Content-filter veto — ~L168
// Rule 15 (G13): ScanRoot mode auto-detect (npm vs folder) — ~L274

const DEFAULT_MANIFEST_FILE = "slothlet.module.json";
const UPWARD_WALK_CAP = 20;

/**
 * @typedef {object} DiscoverOptions
 * @property {string|string[]} [root] - Filesystem path(s) to scan. Default: upward-walk from process.cwd() to nearest node_modules ancestor.
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
 * import { discoverModules } from "#helpers/module-discovery";
 *
 * const found = await discoverModules();
 * // Default upward-walk root, default slothlet.module.json manifest.
 *
 * @example
 * const drivers = await discoverModules({
 *   prefix: "@cldmv/packrat-driver-",
 *   filter: (m) => m.kind === "driver"
 * });
 */
export async function discoverModules(options = {}) {
	const scanRoots = await resolveScanRoots(options.root);
	const manifestSource = parseManifestSource(options.manifest);
	const fieldSchema = options.schema ?? {};
	const filterFn = options.filter;
	const prefixes = normalizePrefixes(options.prefix);

	// Gather candidate package directories from all scanRoots.
	const candidates = [];
	for (let ofIndex = 0, ofList = scanRoots; ofIndex < ofList.length; ofIndex++) {
		const root = ofList[ofIndex];
		const mode = await detectScanMode(root);
		if (mode === "npm") {
			appendList(candidates, await enumerateNpmPackages(root, prefixes));
		} else {
			appendList(candidates, await enumerateFolderModules(root, prefixes));
		}
	}

	// Track results, real-path dedupe, and per-(name@version) realpath registry.
	const results = [];
	const seenRealPaths = new Set();
	/** @type {Map<string, string>} */ const realPathByNameVersion = new Map();

	for (let ofIndex = 0, ofList = candidates; ofIndex < ofList.length; ofIndex++) {
		const candidate = ofList[ofIndex];
		// Resolve real path early so symlink-aliased duplicates dedupe before any I/O on manifests.
		let realPath;
		try {
			realPath = await fsp.realpath(candidate.path);
		} catch {
			// Broken symlink or candidate vanished between readdir() and realpath().
			// Skip silently — not a slothlet-module concern.
			continue;
		}
		if (SetMethods.has(seenRealPaths, realPath)) continue;
		SetMethods.add(seenRealPaths, realPath);

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
		if (MapMethods.has(realPathByNameVersion, nameVersionKey)) {
			const otherRealPath = MapMethods.get(realPathByNameVersion, nameVersionKey);
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
						paths: ArrayMethods.join([otherRealPath, realPath], ", ")
					},
					null,
					{ validationError: true }
				);
			}
		} else {
			MapMethods.set(realPathByNameVersion, nameVersionKey, realPath);
		}

		const apiDirAbs = path.resolve(realPath, normalized.apiDir);
		listPush(
			results,
			Objects.freeze({
				packageName: pkg.name,
				packageRoot: realPath,
				mountPath: Objects.freeze(copyList(normalized.mountPath)),
				apiDir: apiDirAbs,
				manifest: deepFreeze(normalized)
			})
		);
	}

	return results;
}

// ─── Scan-root resolution ────────────────────────────────────────────────────

/**
 * Resolve the `root` option into an array of absolute paths.
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
	if (Arrays.isArray(opt)) {
		return mapList(opt, (p) => path.resolve(p));
	}
	throw new SlothletError(
		"INVALID_ARGUMENT",
		{
			argument: "options.root",
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
	let current = Processes.cwd();
	for (let i = 0; i < UPWARD_WALK_CAP; i++) {
		try {
			const stat = await fsp.stat(path.join(current, "node_modules"));
			if (stat.isDirectory()) return current;
		} catch {
			// not present at this level
		}
		const parent = path.dirname(current);
		if (parent === current) break; // reached filesystem root
		current = parent;
	}
	return Processes.cwd();
}

/**
 * Detect npm-mode vs folder-mode for a scan root.
 * @param {string} root
 * @returns {Promise<"npm"|"folder">}
 * @private
 */
async function detectScanMode(root) {
	try {
		const stat = await fsp.stat(path.join(root, "node_modules"));
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
 * Applies the prefix filter as a pre-skip (no fsp.access if a prefix is set and doesn't match).
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
		entries = await fsp.readdir(nodeModules, { withFileTypes: true });
	} catch {
		return out;
	}
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
		if (StringMethods.startsWith(entry.name, ".")) continue; // skip .pnpm, .bin, .package-lock.json, etc.
		if (StringMethods.startsWith(entry.name, "@")) {
			// Scoped — walk one level deeper.
			const scopeDir = path.join(nodeModules, entry.name);
			let scopedEntries;
			try {
				scopedEntries = await fsp.readdir(scopeDir, { withFileTypes: true });
			} catch {
				// scopeDir is a broken symlink, vanished, or otherwise unreadable.
				continue;
			}
			for (let j = 0; j < scopedEntries.length; j++) {
				const scoped = scopedEntries[j];
				if (!scoped.isDirectory() && !scoped.isSymbolicLink()) continue;
				const fullName = `${entry.name}/${scoped.name}`;
				if (!matchesPrefix(fullName, prefixes)) continue;
				listPush(out, { path: path.join(scopeDir, scoped.name), packageName: fullName });
			}
		} else {
			if (!matchesPrefix(entry.name, prefixes)) continue;
			listPush(out, { path: path.join(nodeModules, entry.name), packageName: entry.name });
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
		entries = await fsp.readdir(root, { withFileTypes: true });
	} catch {
		return out;
	}
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
		if (StringMethods.startsWith(entry.name, ".")) continue;
		// In folder mode, the directory name acts as the candidate packageName
		// for prefix-matching purposes. Actual package identity comes from each
		// subdir's package.json once we read it.
		if (!matchesPrefix(entry.name, prefixes)) continue;
		listPush(out, { path: path.join(root, entry.name), packageName: entry.name });
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
	if (Arrays.isArray(opt)) {
		if (opt.length === 0) return null;
		return copyList(opt);
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
	for (let ofIndex = 0, ofList = prefixes; ofIndex < ofList.length; ofIndex++) {
		const p = ofList[ofIndex];
		if (StringMethods.startsWith(name, p)) return true;
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
	const hashIdx = StringMethods.indexOf(opt, "#");
	if (hashIdx === -1) {
		return { file: opt, subkey: null, isOverride: opt !== DEFAULT_MANIFEST_FILE };
	}
	const file = StringMethods.slice(opt, 0, hashIdx);
	const subkey = StringMethods.slice(opt, hashIdx + 1);
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
		content = await fsp.readFile(filePath, "utf8");
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
		content = await fsp.readFile(manifestPath, "utf8");
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
				// err.message is already surfaced through the JSON_PARSE reason; passing err as the
				// originalError 3rd-arg too would be a dropped cause on a validationError (the
				// MODULE_MANIFEST_INVALID template has no {error} slot), so it is intentionally omitted.
				reason: t("MODULE_MANIFEST_REASON_JSON_PARSE", { error: err.message })
			},
			null,
			{ validationError: true }
		);
	}
	if (source.subkey === null) {
		return parsed;
	}
	// Walk the dotted subkey path.
	const parts = splitText(source.subkey, ".");
	let cur = parsed;
	for (let ofIndex = 0, ofList = parts; ofIndex < ofList.length; ofIndex++) {
		const part = ofList[ofIndex];
		if (cur === null || typeof cur !== "object" || !(part in cur)) {
			return undefined;
		}
		cur = cur[part];
	}
	if (cur === null || typeof cur !== "object" || Arrays.isArray(cur)) {
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
	if (!schemaMap || Objects.keys(schemaMap).length === 0) {
		return raw;
	}
	const out = { ...raw };
	for (let ofIndex = 0, ofList = Objects.entries(schemaMap); ofIndex < ofList.length; ofIndex++) {
		const ofEntry = ofList[ofIndex],
			canonical = ofEntry[0],
			legacy = ofEntry[1];
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
	if (obj === null || typeof obj !== "object" || Objects.isFrozen(obj)) return obj;
	Objects.freeze(obj);
	for (let ofIndex = 0, ofList = Objects.keys(obj); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		const value = obj[key];
		if (value !== null && typeof value === "object") {
			deepFreeze(value);
		}
	}
	return obj;
}
