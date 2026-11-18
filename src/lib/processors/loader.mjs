/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/loader.mjs
 *	@Date: 2026-01-24T08:43:52-08:00 (1769273032)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T20:34:23-08:00 (1794976463)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Loader component for module loading, directory scanning, and API merging
 * @description
 * Provides the Loader class which handles module loading with cache-busting,
 * recursive directory scanning, export validation, and intelligent API merging.
 * @example
 * const loader = new Loader(slothletInstance);
 * const module = await loader.loadModule("./path/to/file.mjs", instanceID);
 * @module @cldmv/slothlet/processors/loader
 * @internal
 */
import { segmentsOf } from "#helpers/segments";
import { ComponentBase } from "#factories/component-base";
import { DEFAULT_API_DEPTH } from "#helpers/defaults";

// Node-only static imports resolved via top-level await so `node:*` never
// enters the static-import graph in browser bundles. The filesystem-scanning
// and CJS-loader methods on Loader are Node-only; browser mode uses
// #scanDirectoryBrowser / #loadModuleBrowser which walk the manifest tree.
// fs/promises + path + url + module builtins resolved in the platform module (#123); the loader's
// disk-scanning / CJS-loader methods are Node-only (browser mode uses #scanDirectoryBrowser /
// #loadModuleBrowser over the manifest tree), so they reference the namespaces directly — null in a
// browser, but those methods never run there, so no per-call guard is needed.
import { isNode, fsp, path, url, createRequire } from "#helpers/platform";
import { compilePattern } from "#helpers/pattern-matcher";
import { isFrameworkReservedKey, isAwaitableThen, thenableExportError } from "#handlers/unified-wrapper";
import { SlothletError, SlothletWarning } from "#errors";
import { translate } from "#i18n";
import { HELPERS_PARAM, HELPERS_PER_MODULE, internals as instanceImportsInternals } from "#helpers/instance-imports";
import { internals as framePlacementInternals, toComparablePath } from "#handlers/frame-placement";
import {
	ArrayMethods,
	Arrays,
	BufferMethods,
	concatLists,
	copyList,
	encodeURIComponent,
	filterList,
	JSON,
	listPush,
	listSplice,
	Map,
	mapEntries,
	mapList,
	MapMethods,
	mapValuesToArray,
	NativeProcess,
	NumberMethods,
	ObjectMethods,
	Objects,
	Promise,
	promiseAll,
	PromiseMethods,
	Reflect,
	RegExpMethods,
	regExpReplace,
	Set,
	setFrom,
	SetMethods,
	setValues,
	splitText,
	String,
	StringMethods,
	URL,
	URLMethods,
	URLSearchParamsMethods
} from "#helpers/intrinsics";
const { installInstanceImportHooks, requireInInstance, setImportRefusal, noteModuleFile, noteModuleRoot } =
	instanceImportsInternals("lib/processors/loader");
const { createModuleLoad } = framePlacementInternals("lib/processors/loader");

/**
 * Whether a file or folder name is hidden from the api scan by default: it starts with `.` or `__`
 * (docs/MODULE-STRUCTURE.md). This is the rule for entries on disk or in a manifest; it does not apply
 * to export names, which only the framework's reserved names exclude.
 * @param {string} name - The entry's name.
 * @returns {boolean} True for a hidden entry.
 * @private
 *
 * @example
 * isHiddenEntryName("__helpers"); // true
 */
function isHiddenEntryName(name) {
	return StringMethods.startsWith(name, ".") || StringMethods.startsWith(name, "__");
}

/**
 * Whether THIS copy of slothlet runs outside a bundler/test-runner module graph.
 *
 * Vite-family transforms inject `import.meta.env` into every module they process; native ESM has
 * no such property. Computed once at module scope — it is a property of how this file was loaded.
 * @type {boolean}
 */
// --- API-RULES condition markers (see docs/API-RULES/API-DISCOVERY-CONDITIONS.md) ---
// Rule 14 (G01): Loadable-extension gate — ~L521
// Rule 14 (G02): Hidden folder exclusion (dot/__) — ~L493
// Rule 14 (G03): Hidden file exclusion (dot/__) — ~L524
// Rule 14 (G04): Consumer `hidden` glob exclusion — ~L496 / ~L544
// Rule 14 (G05): fileFilter single-file gate — ~L487 / ~L529
// Rule 14, Rule 3 (G06): Empty container → no leaf — ~L511
// Rule 14 (G07): Depth / non-recursive truncation — ~L501
// Rule 14 (G08): Reserved-filename rejection — ~L553
// Rule 15 (G14): CJS interop export shaping — ~L368 / ~L807 / ~L826

const RUNTIME_EXTERNALIZED = !("env" in import.meta);

/**
 * `node:vm` and `child_process` as slothlet loads, imported as the loader imported them when it used them (through the
 * module graph, so a host's loader hooks and a test's module mocks apply as before), but once, now: code that replaces
 * `vm.compileFunction` or `child_process.fork` on Node's modules later does not run inside the loader. Null where the
 * platform has no Node builtins (a browser, which loads no file by path).
 * @type {Array<object|null>}
 * @private
 */
const unpacked1 = isNode ? await promiseAll([import("node:vm"), import("child_process")]) : [null, null],
	NODE_VM = unpacked1[0],
	NODE_CHILD_PROCESS = unpacked1[1];

/**
 * `vm.compileFunction`, taken as slothlet loads, for telling a CommonJS file by whether its source compiles as a
 * function body. Undefined in a browser.
 * @type {Function|undefined}
 * @private
 */
const VM_COMPILE_FUNCTION = NODE_VM?.compileFunction;

/**
 * `child_process.fork`, taken as slothlet loads, for the type-generation worker of strict TypeScript mode. Undefined
 * in a browser.
 * @type {Function|undefined}
 * @private
 */
const CHILD_PROCESS_FORK = NODE_CHILD_PROCESS?.fork;

/**
 * Warns when a coverage run will silently misattribute the consumer's leaf coverage (#235).
 *
 * @param {object} config - The instance's transformed config.
 * @param {object} [overrides] - Environment inputs, injectable for tests.
 * @param {object|undefined} [overrides.worker] - The vitest worker global, when present.
 * @param {boolean} [overrides.externalized] - Whether this slothlet copy is outside the runner's
 *   module graph.
 * @param {Function} [overrides.Warning] - The warning class to raise it through (the instance's), so it is recorded on the
 *   instance and printed unless the instance is `silent`.
 * @returns {boolean} True when the warning was emitted.
 * @package
 *
 * @description
 * Fires only when every condition of the misattribution scenario holds: a vitest COVERAGE run is
 * active (`__vitest_worker__.config.coverage.enabled` — a plain test run stays silent), this
 * slothlet copy is EXTERNALIZED (an inlined copy attributes fine), and no `loader.import` importer is
 * configured (the fix). The worker global is vitest-internal,
 * so it is read defensively — its absence or a shape change simply means no hint, never a wrong
 * one. Detection cannot DO the fix: the importer must be a closure authored in the consumer's own
 * transformed code, which is why this is a pointer to docs/TESTING.md rather than an auto-enable.
 */
export function warnIfCoverageWithoutImporter(
	config,
	{ worker = globalThis.__vitest_worker__, externalized = RUNTIME_EXTERNALIZED, Warning = SlothletWarning } = {}
) {
	if (worker?.config?.coverage?.enabled !== true) return false;
	if (!externalized) return false;
	if (typeof config?.loader?.import === "function") return false;
	new Warning("WARNING_COVERAGE_IMPORTER_UNSET", {});
	return true;
}

/**
 * Whether a coverage run is collecting this process's coverage (#484).
 *
 * @param {object} [overrides] - Environment inputs, injectable for tests.
 * @param {object|undefined} [overrides.worker] - The vitest worker global, when present.
 * @param {object} [overrides.env] - The environment variables to read (default `process.env`).
 * @returns {boolean} True under a vitest coverage run or a native/c8 `NODE_V8_COVERAGE` run.
 * @package
 *
 * @description
 * A vitest coverage run is read from `__vitest_worker__.config.coverage.enabled`, exactly as
 * {@link warnIfCoverageWithoutImporter} reads it: the global is vitest-internal, so a missing or
 * reshaped value means "not detected", never a throw. A native or c8 run is read from
 * `NODE_V8_COVERAGE`, which Node itself honours to write coverage (and each loaded module's source
 * map) for the process.
 */
export function isCoverageRun({ worker = globalThis.__vitest_worker__, env = NativeProcess?.env } = {}) {
	if (worker?.config?.coverage?.enabled === true) return true;
	return typeof env?.NODE_V8_COVERAGE === "string" && env.NODE_V8_COVERAGE.length > 0;
}

/**
 * The effective `sourcemap` setting for TypeScript transforms (#484).
 *
 * @param {object} typescriptConfig - The instance's normalized `typescript` config.
 * @param {object} [overrides] - Environment inputs forwarded to {@link isCoverageRun}.
 * @returns {boolean} True when transpiled output should carry an inline source map.
 * @package
 *
 * @description
 * An explicit boolean wins. When `sourcemap` is not set, source maps are on exactly during a
 * coverage run: a TypeScript leaf executes from its `.slothlet-cache/` copy, and the inline map is
 * the only way coverage can be remapped onto the `.ts` source.
 */
export function resolveSourcemap(typescriptConfig, overrides) {
	const explicit = typescriptConfig?.sourcemap;
	if (typeof explicit === "boolean") return explicit;
	return isCoverageRun(overrides);
}

/**
 * Warns when a coverage run loads TypeScript leaves with source maps explicitly off (#484).
 *
 * @param {object} config - The instance's transformed config.
 * @param {object} [overrides] - Environment inputs forwarded to {@link isCoverageRun}, and `Warning`, the warning class
 *   to raise it through (the instance's).
 * @returns {boolean} True when the warning was emitted.
 * @package
 *
 * @description
 * Without the inline map, coverage for a TypeScript leaf is recorded against its cache copy and
 * can never reach the `.ts` source. The Loader calls this once per instance, on the first
 * TypeScript leaf it loads, through the instance's warning class (`overrides.Warning`), so a `silent` instance records it
 * without printing.
 */
export function warnIfCoverageWithoutSourcemap(config, overrides) {
	if (config?.typescript?.sourcemap !== false) return false;
	if (!isCoverageRun(overrides)) return false;
	const Warning = overrides?.Warning ?? SlothletWarning;
	new Warning("WARNING_COVERAGE_TYPESCRIPT_SOURCEMAP_OFF", {});
	return true;
}

/**
 * Stands for the leading `.` of a file or folder name inside a dotted path, so a dot-prefixed name (`.git`) stays one
 * segment and cannot be read as a separator. A character no glob is written with.
 * @type {string}
 * @private
 */
const LEADING_DOT = "\u0001";

/**
 * One path segment as {@link compileHidden}'s matchers read it: a name that starts with `.` has that dot replaced by
 * {@link LEADING_DOT}.
 * @param {string} name - A raw file (extension stripped) or folder name.
 * @returns {string} The segment.
 * @private
 * @example
 * hiddenSegment(".git"); // "\u0001git"
 */
function hiddenSegment(name) {
	return StringMethods.startsWith(name, ".") ? LEADING_DOT + StringMethods.slice(name, 1) : name;
}

/**
 * Compile a `hidden` option (a glob string or array of globs) into a matcher, or null when there's
 * nothing to hide. Globs match an entry's path relative to the API root, built from the RAW on-disk
 * directory/file names — NOT the sanitized API keys. For a file that's the extension-stripped dotted
 * path (so `secret/config.mjs` matches `secret.config`); a folder `draft-notes` (surfaced as
 * `api.draftNotes`) matches `draft-notes`, not `draftNotes`. Reuses slothlet's dot-separated glob
 * dialect: `*` matches one segment, `**` any number of segments (none included, so `secret.**` names the folder
 * `secret` itself as well as everything in it), `?` one char, `{a,b}` alternation. Globs may be written folder-style
 * (`a/b`) — `/` is normalized to `.`. A name's leading `.` is part of the name (`**\/.*`, `.env`, `a..git`), and a
 * glob ending in `/` matches folders only (`!**\/.*\/`).
 *
 * The globs sit over slothlet's built-in rule, which hides every file and folder whose name starts with `.` or `__`:
 * globs apply in order and the last one that matches an entry decides; an entry no glob matches falls to the built-in
 * rule. So `"!**\/__*"` brings back `__`-prefixed files and folders, and `["!**\/.*\/", "!**\/__*\/"]` the folders
 * only. A name the framework reserves is still refused when it is loaded.
 *
 * A folder a glob hides is not scanned. One case is scanned all the same: the glob that hides it also hides everything
 * beneath it (`secret/**`) and a `!` glob follows it, since that glob may un-hide an entry inside
 * (`["secret/**", "!secret/keep"]`). Its entries are then matched one by one, which hides the same ones.
 * @param {string|string[]|null} globs - Hidden glob(s).
 * @returns {?function(string, boolean=): (boolean|undefined)} Matcher over the dot-joined relative path, each segment
 *   made by {@link hiddenSegment} (pass `true` as the second argument for a folder): true to hide, false to show,
 *   undefined when no glob matches. Null when there are no globs.
 * @private
 */
function compileHidden(globs) {
	if (!globs) return null;
	const list = Arrays.isArray(globs) ? globs : [globs];
	const rules = [];
	for (let ofIndex = 0, ofList = list; ofIndex < ofList.length; ofIndex++) {
		const g = ofList[ofIndex];
		if (typeof g !== "string" || g.length === 0) continue;
		const negated = StringMethods.startsWith(g, "!");
		// Compile the pattern BODY (without a leading "!") as a positive matcher; the "!" is applied here
		// as gitignore-style un-hiding, NOT via compilePattern's "match everything except" semantics —
		// those don't compose under a hide-list (a single `!x` would then hide everything except x).
		let raw = negated ? StringMethods.slice(g, 1) : g;
		// A trailing "/" names folders only, as in gitignore.
		const foldersOnly = StringMethods.endsWith(raw, "/");
		if (foldersOnly) raw = StringMethods.slice(raw, 0, -1);
		// A name's leading "." is part of the name: in a folder-style glob each segment's, in a dotted glob one at the start
		// or right after a separator (`a..git`).
		const body = StringMethods.includes(raw, "/")
			? ArrayMethods.join(mapList(splitText(raw, "/"), hiddenSegment), ".")
			: regExpReplace(/(^|\.)\./g, raw, (_match, before) => before + LEADING_DOT);
		if (body.length === 0) continue; // bare "!" — nothing to match
		listPush(rules, { negated, foldersOnly, matches: compilePattern(body) });
	}
	if (!rules.length) return null;
	// Evaluate in order, last matching rule wins: a normal glob hides a matched path; a `!`-prefixed glob
	// un-hides it (gitignore semantics). No match leaves the entry to the built-in rule.
	return (relDotted, isFolder = false) => {
		let verdict;
		let winner = -1;
		for (let index = 0; index < rules.length; index++) {
			const rule = rules[index];
			if (rule.foldersOnly && !isFolder) continue;
			// Each rule holds its compiled pattern as its own `matches`.
			if (rule.matches(relDotted)) {
				verdict = !rule.negated;
				winner = index;
			}
		}
		if (verdict === true && isFolder) {
			// Names no file or folder can have (a `.` would split them), so only a glob that matches everything
			// beneath the folder matches both.
			const coversBelow = rules[winner].matches(`${relDotted}.\u0000`) && rules[winner].matches(`${relDotted}.\u0000.\u0000`);
			if (coversBelow && ArrayMethods.some(copyList(rules, winner + 1), (rule) => rule.negated)) return false;
		}
		return verdict;
	};
}

/**
 * Whether an entry is hidden: the `hidden` globs decide when one matches it, the built-in `.`/`__` rule otherwise.
 * @param {?function(string, boolean=): (boolean|undefined)} hiddenMatcher - The compiled `hidden` globs, or null.
 * @param {string} rel - The entry's dotted path, as {@link compileHidden}'s matcher reads it.
 * @param {string} name - The entry's own name (a file's with its extension).
 * @param {boolean} isFolder - Whether the entry is a folder.
 * @returns {boolean} True to leave the entry out.
 * @private
 * @example
 * isHiddenEntry(null, "\u0001git", ".git", true); // true
 */
function isHiddenEntry(hiddenMatcher, rel, name, isFolder) {
	const verdict = hiddenMatcher ? hiddenMatcher(rel, isFolder) : undefined;
	return verdict === undefined ? isHiddenEntryName(name) : verdict;
}

/**
 * Parse JSON text, returning null when it is not valid JSON.
 * @param {string} text - JSON text.
 * @returns {*} The parsed value, or null.
 * @example
 * parseJsonOrNull('{"type":"module"}'); // { type: "module" }
 * @private
 */
function parseJsonOrNull(text) {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

/**
 * Loader component for module loading, directory scanning, and API merging
 * @class Loader
 * @extends ComponentBase
 * @package
 */
/**
 * Absolute path of the worker strict TypeScript mode forks to generate the api's declaration file. It
 * lives next to this module, so it ships wherever the loader does (`dist/lib/processors/` when
 * installed) (#500). Resolved on call, from the Node-only strict-mode path: `path`/`url` are `null`
 * in browser mode, and the literal `new URL("./…", import.meta.url)` form is avoided because bundlers
 * and vite treat it as a module reference and load the worker into the current process.
 * @returns {string} Absolute path of `type-generation-worker.mjs`.
 * @internal
 * @example
 * fork(typeGenerationWorkerPath(), [], { stdio: ["pipe", "pipe", "pipe", "ipc"] });
 */
export function typeGenerationWorkerPath() {
	return path.join(path.dirname(url.fileURLToPath(import.meta.url)), "type-generation-worker.mjs");
}

/**
 * Whether this loader copy has registered the per-instance helper-import resolve hook (#518).
 * @type {boolean}
 * @private
 */
let instanceImportHooksInstalled = false;

/**
 * Add the per-instance import query to a resolved browser specifier — the same
 * `slothlet_instance` / `module` / `_reload` parameters the Node branch puts on a leaf's file URL —
 * so each instance, each `api.slothlet.api.add()` mount and each reload imports its own copy of the
 * leaf rather than sharing one module record (#598).
 *
 * Only an absolute `http:`, `https:` or `file:` URL can carry a query that still names the same file;
 * the parameters are merged with any query it already has. A bare or import-map specifier is resolved
 * by the importmap, where a query would no longer match its entry, and `blob:` / `data:` URLs name
 * their content directly — those are returned unchanged.
 *
 * A resolver may return a `URL` object as well as a string; it is read as its `href`, so it gets the
 * same parameters a string URL would.
 *
 * @param {string|URL} specifier - What the resolver returned.
 * @param {string} [instanceID] - Slothlet instance ID.
 * @param {string} [moduleID] - Module ID of an `api.slothlet.api.add()` mount.
 * @param {number|string|null} [cacheBust] - Reload stamp.
 * @returns {string} The specifier to import.
 * @internal
 *
 * @example
 * withInstanceQuery("https://app.test/api/math.mjs?v=3", "abc", "mod1", null);
 * // "https://app.test/api/math.mjs?v=3&slothlet_instance=abc&module=mod1"
 */
export function withInstanceQuery(specifier, instanceID, moduleID, cacheBust) {
	if (specifier instanceof URL) specifier = URLMethods.href(specifier);
	if (!instanceID || typeof specifier !== "string" || !(RegExpMethods.exec(/^(?:https?|file):/i, specifier) !== null)) return specifier;
	let parsed;
	try {
		parsed = new URL(specifier);
	} catch {
		// Not a URL after all (a resolver handed back something scheme-like but malformed): import it as given.
		return specifier;
	}
	URLSearchParamsMethods.set(URLMethods.searchParams(parsed), "slothlet_instance", instanceID);
	if (moduleID) URLSearchParamsMethods.set(URLMethods.searchParams(parsed), "module", moduleID);
	if (cacheBust) URLSearchParamsMethods.set(URLMethods.searchParams(parsed), "_reload", String(cacheBust));
	return URLMethods.href(parsed);
}

/**
 * A query parameter value written so that no character of it can end the parameter where it is read back: a
 * stack frame's location is read up to `&`, `#`, `:`, `)` or whitespace (#601 review), and encodeURIComponent
 * leaves `( ) ! ' *` as they are.
 * @param {string} value - The value.
 * @returns {string} The encoded value.
 * @private
 */
function runtime_encodeQueryValue(value) {
	return regExpReplace(
		/[!'()*]/g,
		encodeURIComponent(value),
		(char) => `%${StringMethods.toUpperCase(NumberMethods.toString(StringMethods.charCodeAt(char, 0), 16))}`
	);
}

/**
 * A URL query in one spelling whatever order its parameters were written in, for comparing two queries.
 * @param {string} query - A query, without its `?`.
 * @returns {string} Its parameters, sorted.
 * @private
 */
function runtime_sortedQuery(query) {
	return ArrayMethods.join(ArrayMethods.sort(filterList(splitText(query, "&"), (part) => part !== "")), "&");
}

/**
 * Register the Node resolve hook that carries a leaf's `?slothlet_instance=…` query onto the
 * relative helpers it imports, once per process. Node-only: called from the disk-loading path,
 * never in browser mode. `node:module` is read through the platform's createRequire rather than an
 * `import("node:module")` literal, which would pull a `node:` specifier into browser bundles.
 * @returns {void}
 * @private
 */
function ensureInstanceImportHooks() {
	if (instanceImportHooksInstalled) return;
	// A module's import of one of slothlet's own files is refused with slothlet's own error.
	setImportRefusal(({ specifier, file, allowed }) => new SlothletError("MODULE_INTERNAL_NOT_IMPORTABLE", { specifier, file, allowed }));
	instanceImportHooksInstalled = installInstanceImportHooks(createRequire(import.meta.url)("node:module"));
}

/**
 * Whether slothlet's runtime (`@cldmv/slothlet/runtime`) has been loaded by this copy of slothlet.
 * @type {boolean}
 * @private
 */
let runtimeLoaded = false;

/**
 * The load of slothlet's runtime, started by the first api file load of the process.
 * @type {Promise<void>|null}
 * @private
 */
let runtimeLoading = null;

/**
 * Load slothlet's runtime before the first api file is loaded. The runtime awaits at its top level, so an api file
 * importing it while it is still loading is not evaluated when its own import finishes resolving: the engine evaluates
 * every file waiting on the runtime in one job, when the runtime is ready, and that job runs in the flow of whichever
 * load asked for the runtime first. An api file's top level, and the helper files it imports, then ran inside another
 * file's load. Loaded here first, from slothlet's own flow, no api file ever waits on it. It also makes this copy's
 * runtime the one the process has before any file Node loads itself can ask for it (#760).
 * @returns {Promise<void>} Resolves once the runtime is loaded.
 * @private
 */
function ensureRuntimeLoaded() {
	// Loaded or not, the load is over: a host that cannot resolve the runtime loads no api file that imports it either.
	const done = () => {
		runtimeLoaded = true;
	};
	runtimeLoading ??= PromiseMethods.then(import("#runtime"), done, done);
	return runtimeLoading;
}

export class Loader extends ComponentBase {
	static slothletProperty = "loader";

	/**
	 * Whether the one-shot TypeScript-coverage source-map check has run for this instance (#484).
	 * @type {boolean}
	 * @private
	 */
	#coverageSourcemapChecked = false;

	/**
	 * The URL each live copy of a browser-mode file was imported from, by the manifest path it was loaded
	 * as and then by the mount that loaded it (#601). A reload of a mount replaces its copy, so it replaces
	 * that mount's URL rather than adding one: a call still suspended in the old copy took its own record
	 * of the URLs when it entered.
	 * @type {Map<string, Map<string, string>>}
	 * @private
	 */
	#importedLocations = new Map();

	/**
	 * {@link Loader#importedLocations}' list, kept until a location is recorded.
	 * @type {Array<string>|null}
	 * @private
	 */
	#importedLocationList = null;

	/**
	 * Every URL a file was imported from by this loader, the newest {@link Loader.IMPORTED_URLS_PER_FILE} kept, by the
	 * path it was loaded as (#691): a reload's URL is added, not put in place of the one before, so code a copy loaded
	 * before a reload still made is told from a copy someone else imported under a URL of their own.
	 * @type {Map<string, Array<string>>}
	 * @private
	 */
	#importedURLs = new Map();

	/**
	 * How many of a file's imported URLs {@link Loader#importedURLs} keeps.
	 * @type {number}
	 */
	static IMPORTED_URLS_PER_FILE = 64;

	/**
	 * Create a Loader instance.
	 * @param {object} slothlet - Slothlet class instance.
	 * @package
	 */
	constructor(slothlet) {
		super(slothlet);
	}

	/**
	 * Load a single module
	 * @param {string} filePath - Path to module file
	 * @param {string} [instanceID] - Slothlet instance ID for cache busting
	 * @param {string} [moduleID] - Module ID for additional cache busting (used in api.slothlet.api.add)
	 * @param {number|null} [cacheBust=null] - Timestamp for reload cache busting (forces fresh import)
	 * @param {string[]|null} [paths=null] - The paths the file's top-level code can run as while it first loads (see
	 *   {@link Loader#loadingFile}), as the builder reads them before the file's exports are known.
	 * @returns {Promise<Object>} Loaded module
	 * @public
	 */
	async loadModule(filePath, instanceID, moduleID, cacheBust = null, paths = null) {
		const entry = { path: toComparablePath(filePath), moduleID: moduleID ?? null, paths: paths ? Objects.freeze(copyList(paths)) : null };
		SetMethods.add(this.#loadingFiles, entry);
		try {
			return await this.#loadModuleTracked(filePath, instanceID, moduleID, cacheBust);
		} finally {
			SetMethods.delete(this.#loadingFiles, entry);
		}
	}

	/**
	 * The files this loader is loading now (see {@link Loader#loadModule}).
	 * @type {Set<{path: string, moduleID: string|null, paths: ReadonlyArray<string>|null}>}
	 * @private
	 */
	#loadingFiles = new Set();

	/**
	 * A file this loader is loading now, by its comparable path and the mount its URL names: what its top-level code
	 * runs as while it first loads, before any node stands for it (S4: the file's module path).
	 * @param {string} path - The file, in comparable form.
	 * @param {string|null} [mount=null] - The mount tag the code's location carries.
	 * @returns {{path: string, moduleID: string|null, paths: ReadonlyArray<string>|null}|null} The load, or null when the
	 *   file is not loading, or when two loads of it cannot be told apart.
	 * @public
	 * @example
	 * loader.loadingFile("/app/api/ext/render.mjs", "ext"); // { path, moduleID: "ext", paths: ["ext.render"] }
	 */
	loadingFile(path, mount = null) {
		let found = null;
		for (const entry of setValues(this.#loadingFiles)) {
			if (entry.path !== path || (mount !== null && entry.moduleID !== mount)) continue;
			if (found) return null;
			found = entry;
		}
		return found;
	}

	/**
	 * Whether this loader is loading any file now (see {@link Loader#loadingFile}).
	 * @returns {boolean} True while a load runs.
	 * @public
	 * @example
	 * loader.isLoading(); // false
	 */
	isLoading() {
		return SetMethods.size(this.#loadingFiles) > 0;
	}

	/**
	 * Every load of a file this loader is running now, by the file's comparable path (see {@link Loader#loadingFile}),
	 * however many there are.
	 * @param {string} path - The file, in comparable form.
	 * @returns {Array<{path: string, moduleID: string|null, paths: ReadonlyArray<string>|null}>} The loads.
	 * @public
	 * @example
	 * loader.loadsOfFile("/app/api/ext/render.mjs"); // [{ path, moduleID: "ext", paths: ["ext.render"] }]
	 */
	loadsOfFile(path) {
		const found = [];
		for (const entry of setValues(this.#loadingFiles)) if (entry.path === path) listPush(found, entry);
		return found;
	}

	/**
	 * Load a single module, inside its load context (see {@link Loader#loadModule}).
	 * @param {string} filePath - Path to module file.
	 * @param {string} [instanceID] - Slothlet instance ID.
	 * @param {string} [moduleID] - Module ID.
	 * @param {number|null} [cacheBust=null] - Reload cache bust.
	 * @returns {Promise<Object>} Loaded module.
	 * @private
	 */
	async #loadModuleTracked(filePath, instanceID, moduleID, cacheBust = null) {
		// Slothlet's runtime is loaded before any api file is, from outside every file's load (see ensureRuntimeLoaded).
		if (!runtimeLoaded) {
			// The hooks first, under Node: they see whether Node itself loads the runtime (#760).
			if (this.slothlet.envTarget !== "browser") ensureInstanceImportHooks();
			await ensureRuntimeLoaded();
		}
		// The file's top level runs as the file's module (#726): what it starts while it loads carries that identity.
		const contextManager = this.slothlet.contextManager;
		if (typeof contextManager?.runModuleLoad !== "function") return this.#loadModuleFile(filePath, instanceID, moduleID, cacheBust);
		return contextManager.runModuleLoad(createModuleLoad(this.slothlet, filePath, moduleID), () =>
			this.#loadModuleFile(filePath, instanceID, moduleID, cacheBust)
		);
	}

	/**
	 * Load a single module's file (see {@link Loader#loadModule}).
	 * @param {string} filePath - Path to module file
	 * @param {string} [instanceID] - Slothlet instance ID for cache busting
	 * @param {string} [moduleID] - Module ID for additional cache busting
	 * @param {number|null} [cacheBust=null] - Timestamp for reload cache busting
	 * @returns {Promise<Object>} Loaded module
	 * @private
	 */
	async #loadModuleFile(filePath, instanceID, moduleID, cacheBust = null) {
		try {
			// Browser mode: filesystem paths and pathToFileURL are not available.
			// Delegate to the callback the user supplied via config.loader.resolve.
			if (this.slothlet.envTarget === "browser") {
				return this.#loadModuleBrowser(filePath, instanceID, moduleID, cacheBust);
			}

			// CJS files must bypass the shared require() cache; query-param cache-busting
			// has no effect on require() because it keys on the resolved file path only.
			// A `.js` file Node treats as CommonJS (#521) takes the same path as `.cjs`. Its relative
			// requires share one private cache per instance (#518) — kept across partial reloads, like ESM helpers.
			// The hooks serve its require() of an ES module the instance's copy (#534).
			if (StringMethods.endsWith(filePath, ".cjs") || (StringMethods.endsWith(filePath, ".js") && (await this.#isCommonJSFile(filePath)))) {
				ensureInstanceImportHooks();
				return this.#loadCJSIsolated(filePath, instanceID, moduleID);
			}

			// Relative helpers a leaf imports must follow the leaf's per-instance query (#518): the
			// process-wide resolve hook copies it onto every relative/`file:` child below the leaf.
			ensureInstanceImportHooks();

			// Check if TypeScript transformation is needed
			const isTypeScript = StringMethods.endsWith(filePath, ".ts") || StringMethods.endsWith(filePath, ".mts");
			const typescriptConfig = this.slothlet.config?.typescript;

			let moduleUrl;

			if (isTypeScript && typescriptConfig?.enabled) {
				const mode = typescriptConfig.mode;
				// Source maps: explicit setting, else on during a coverage run (#484).
				const sourcemap = resolveSourcemap(typescriptConfig);
				if (!this.#coverageSourcemapChecked) {
					this.#coverageSourcemapChecked = true;
					warnIfCoverageWithoutSourcemap(this.slothlet.config, { Warning: this.slothlet.SlothletWarning });
				}
				if (mode === "strict") {
					// Validate strict mode config
					if (!typescriptConfig.types?.output) {
						throw new this.SlothletError("TYPESCRIPT_TYPES_OUTPUT_MISSING", {});
					}
					if (!typescriptConfig.types?.name) {
						throw new this.SlothletError("TYPESCRIPT_TYPES_NAME_MISSING", {});
					}

					// Generate types if not already generated for this instance
					if (!this.slothlet._typesGenerated) {
						const fork = CHILD_PROCESS_FORK;

						// The worker ships next to this file (src/lib/processors → dist/lib/processors).
						const scriptPath = typeGenerationWorkerPath();

						// The child process builds the same tree in eager, fast mode; `types` is the worker's own field,
						// not a slothlet option.
						const childConfig = JSON.stringify({
							config: {
								base: this.slothlet.config.base,
								mode: "eager",
								typescript: "fast"
							},
							types: typescriptConfig.types
						});

						// Fork child process to generate types
						await new Promise((resolve, reject) => {
							const child = fork(scriptPath, [], {
								stdio: ["pipe", "pipe", "pipe", "ipc"],
								env: { ...NativeProcess.env, SLOTHLET_CONFIG: childConfig }
							});

							let errorOutput = "";

							child.stderr?.on("data", (data) => {
								errorOutput += ObjectMethods.toString(BufferMethods, data);
							});

							child.on("message", (msg) => {
								// The false arm (msg.type === "error") is covered in isolation but lost in full-suite coverage merge (fork I/O module caching).
								/* v8 ignore next */
								if (msg.type === "success") {
									this.slothlet._typesGenerated = true;
									resolve();
									// Covered by loader-fork-message-error.test.vitest.mjs but the full coverage
									// run's parallel worker merge loses it because vi.mock("child_process") is
									// file-scoped and the dynamic import("child_process") caches across workers.
									/* v8 ignore start */
								} else if (msg.type === "error") {
									// msg.error is a string (serialized over IPC). Wrap in a message-object so
									// SlothletError renders the cause into {error} without
									// needing a bare new Error() construction.
									reject(new this.SlothletError("TYPESCRIPT_TYPE_GENERATION_FAILED", {}, { cause: { message: msg.error } }));
								}
								/* v8 ignore stop */
							});

							child.on("error", (error) => {
								reject(new this.SlothletError("TYPESCRIPT_TYPE_GENERATION_FORK_FAILED", {}, { cause: error }));
							});

							child.on("exit", (code) => {
								if (code !== 0 && !this.slothlet._typesGenerated) {
									reject(new this.SlothletError("TYPESCRIPT_TYPE_GENERATION_PROCESS_EXITED", { code, output: errorOutput }));
								}
							});
						});
					}

					// Lazy load TypeScript strict mode processor
					const { transformTypeScriptStrict, writeTransformedToCache, formatDiagnostics, getTypeScript } =
						await import("#processors/typescript");

					// Transform + type-check a single .ts/.mts file. Reused for the entry
					// module and for every relative .ts/.mts file it imports, so type
					// errors anywhere in the import graph surface the same way.
					const strictTransform = async (tsPath) => {
						const result = await transformTypeScriptStrict(tsPath, {
							target: typescriptConfig.target,
							module: typescriptConfig.module,
							strict: typescriptConfig.strict,
							typeDefinitionPath: typescriptConfig.types.output,
							compilerOptions: typescriptConfig.compiler,
							sourcemap
						});
						// Check for type errors
						if (result.diagnostics && result.diagnostics.length > 0) {
							// Route through the same guarded loader transformTypeScriptStrict just used
							// (memoized — this is not a second capability check) so a TypeScript 7
							// install without the compiler API is reported the same way here as there.
							const ts = await getTypeScript();
							const errors = formatDiagnostics(result.diagnostics, ts);

							// Throw error with formatted diagnostics
							const error = new this.SlothletError("TYPESCRIPT_TYPE_CHECK_ERRORS", {
								file: tsPath,
								errors: ArrayMethods.join(errors, "\n")
							});
							error.diagnostics = result.diagnostics;
							throw error;
						}
						return result.code;
					};

					const entryCode = await strictTransform(filePath);
					moduleUrl = await this.#buildTypescriptModuleUrl(
						writeTransformedToCache,
						filePath,
						entryCode,
						instanceID,
						moduleID,
						cacheBust,
						strictTransform
					);
				} else {
					// Fast mode: Use esbuild
					const { transformTypeScript, writeTransformedToCache } = await import("#processors/typescript");

					const transformOptions = {
						target: typescriptConfig.target,
						sourcemap
					};
					// Transform TypeScript to JavaScript. The same transform is used to
					// follow relative .ts/.mts imports between user modules.
					const transformedCode = await transformTypeScript(filePath, transformOptions);
					const transform = (tsPath) => transformTypeScript(tsPath, transformOptions);

					moduleUrl = await this.#buildTypescriptModuleUrl(
						writeTransformedToCache,
						filePath,
						transformedCode,
						instanceID,
						moduleID,
						cacheBust,
						transform
					);
				}
			} else {
				// Regular JavaScript file
				const fileUrl = url.pathToFileURL(filePath).href;
				// Cache bust using instanceID to prevent cross-instance pollution
				// Add moduleID for api.slothlet.api.add calls to prevent cache reuse between different API paths
				moduleUrl = `${fileUrl}?slothlet_instance=${instanceID}`;
				if (moduleID) {
					moduleUrl += `&module=${runtime_encodeQueryValue(moduleID)}`;
				}
				// `helpers: "module"`: the resolve hook loads each helper this file imports as this file's own copy.
				if (this.slothlet.config?.helpers === "module") moduleUrl += `&${HELPERS_PARAM}=${HELPERS_PER_MODULE}`;
				// Append reload timestamp to force fresh imports during rebuildCache.
				// This prevents the Node.js module cache from returning the same function
				// reference used by the live API (which would cause applyRootContributor's
				// Object.assign to overwrite the live API's properties).
				if (cacheBust) {
					moduleUrl += `&_reload=${cacheBust}`;
				}
			}

			// Injectable importer (#235): a consumer's test runner can only attribute leaf execution
			// it loads itself, so a configured importer receives the exact cache-busted URL and its
			// module namespace is used unchanged — per-instance isolation, mount identity, and reload
			// busting ride the URL either way; only whose import() executes differs.
			const customImport = this.slothlet?.config?.loader?.import;
			// The live runtime matches a suspended call's frames against the file it was imported from; a
			// TypeScript leaf runs from its compiled copy, not its source, so that location is recorded (#601 review).
			let byMount = MapMethods.get(this.#importedLocations, filePath);
			if (!byMount) MapMethods.set(this.#importedLocations, filePath, (byMount = new Map()));
			MapMethods.set(byMount, moduleID ?? "", String(moduleUrl));
			this.#importedLocationList = null;
			this.#rememberImportedURL(filePath, String(moduleUrl));
			// What the file imports is a module's, whichever loader evaluates it and however a require names it.
			noteModuleFile(filePath);
			noteModuleFile(String(moduleUrl));
			const module = customImport ? await customImport(moduleUrl) : await import(moduleUrl);
			return module;
		} catch (error) {
			// A refused `then` export is the module's own error, not a failed import: keep its code, as
			// export extraction does for an ES module (#571 review).
			if (error instanceof this.SlothletError && (error.code === "MODULE_RESERVED_EXPORT" || error.code === "MODULE_THENABLE_EXPORT"))
				throw error;
			throw new this.SlothletError(
				"MODULE_IMPORT_FAILED",
				{
					file: filePath
				},
				{ cause: error }
			);
		}
	}

	/**
	 * Whether a file or folder name is, or sanitizes to, a framework-reserved key. The member a file
	 * or folder produces is named by its sanitized name, so `___materialize-` or `-____impl` collides with
	 * the framework handle exactly as `___materialize` does (#571 review).
	 * @param {string} name - Entry name without extension (a folder's name as-is).
	 * @returns {boolean} True when the entry's name or its member name is reserved.
	 * @private
	 */
	#isReservedEntryName(name) {
		return isFrameworkReservedKey(name) || isFrameworkReservedKey(this.slothlet.helpers.sanitize.sanitizePropertyName(name));
	}

	/**
	 * Refuse a file or folder whose member would be named `then` (#571). A `then` member makes its
	 * namespace thenable, so every `await` of the namespace would call the member instead of
	 * resolving it; the wrapper therefore answers `then` itself and the member would be unreachable.
	 * @param {string} name - Entry name without extension (a folder's name as-is).
	 * @param {string} entry - Entry name as listed, for the error.
	 * @param {string} dir - Containing directory, for the error.
	 * @returns {void}
	 * @throws {SlothletError} MODULE_THENABLE_NAME when the entry's member name is `then`.
	 * @private
	 */
	#assertNotThenable(name, entry, dir) {
		if (this.slothlet.helpers.sanitize.sanitizePropertyName(name) === "then") {
			throw new this.SlothletError("MODULE_THENABLE_NAME", { entry, folder: dir });
		}
	}

	/**
	 * Refuse a folder named for a framework-reserved key or `then` (#571), the folder counterpart of
	 * the file checks: such a folder used to fail later with a bare TypeError naming neither the
	 * folder nor the rule.
	 * @param {string} folder - Folder name.
	 * @param {string} dir - Containing directory, for the error.
	 * @returns {void}
	 * @throws {SlothletError} MODULE_RESERVED_FOLDER or MODULE_THENABLE_NAME.
	 * @private
	 */
	#assertLoadableFolderName(folder, dir) {
		if (this.#isReservedEntryName(folder)) {
			throw new this.SlothletError("MODULE_RESERVED_FOLDER", { name: folder, folder: dir });
		}
		this.#assertNotThenable(folder, folder, dir);
	}

	/**
	 * Load a CJS module with a fresh module.exports on every call, and give its relative
	 * dependency graph one copy per instance (#518, #534).
	 * Node's require() cache is keyed on the resolved file path and ignores URL
	 * query parameters, so two Slothlet instances loading the same .cjs file
	 * would otherwise share the exact same module.exports object — and so would
	 * every helper the leaf require()s.
	 *
	 * The leaf itself is always evaluated fresh. The instance-scoped files it reaches are served from
	 * the instance's private CommonJS cache — shared by every mount and kept across partial reloads; a
	 * full reload rotates the instance ID and so starts a fresh one — and an ES module it require()s is
	 * the instance's copy of that module (see scopeRequire in helpers/instance-imports).
	 * @param {string} filePath - Absolute path to the .cjs file
	 * @param {string} scopeKey - The instance ID whose helper copies the leaf's requires are served from
	 * @returns {Object} Synthetic ESM namespace: { default, ...namedExports }
	 * @example
	 * const ns = this.#loadCJSIsolated("/path/to/module.cjs", "inst");
	 * ns.default; // module.exports
	 * @private
	 */
	#loadCJSIsolated(filePath, scopeKey, moduleID = null) {
		// With `helpers: "module"` the files the leaf requires are its own copies, not the instance's.
		const perModule = this.slothlet.config?.helpers === "module";
		const options = { fresh: true, importer: perModule ? filePath : null, mount: perModule ? (moduleID ?? null) : null };
		// The instance's own files load through the handle the instance holds for its ID; a load under another ID (a
		// caller driving the loader directly) goes through the cache of an ID no instance holds.
		// A kept copy's lazy node loads under the ID that copy was loaded under, which the instance still holds.
		const held =
			typeof this.slothlet.holdsScope === "function" ? this.slothlet.holdsScope(scopeKey) : scopeKey === this.slothlet.instanceID;
		const exports =
			held && typeof this.slothlet.requireInScope === "function"
				? this.slothlet.requireInScope(filePath, options, scopeKey)
				: requireInInstance(filePath, scopeKey, options);

		// A callable `then` export (#571): copied onto the namespace below, it makes the namespace thenable,
		// so returning it from the async loader would call the module's `then` and wait on it, hanging the
		// load. Refuse it here, before the namespace is ever awaited: a `then` getter by its descriptor,
		// without running it, and otherwise by the value the copy reads, which a Proxy's `get` trap answers
		// whatever its descriptor says. A `then` holding data does not make the namespace awaitable, and is
		// an ordinary export.
		if (exports !== null && (typeof exports === "object" || typeof exports === "function")) {
			const thenDescriptor = Objects.getOwnPropertyDescriptor(exports, "then");
			if (thenDescriptor && (isAwaitableThen(thenDescriptor) || typeof exports.then === "function")) {
				throw thenableExportError(this.SlothletError, `${filePath} (export 'then')`);
			}
		}

		// Build a synthetic ESM namespace that mirrors what import() returns for CJS:
		//   - default = module.exports
		//   - each own key of module.exports becomes a named export
		const namespace = { default: exports };
		if (exports !== null && typeof exports === "object") {
			for (let ofIndex = 0, ofList = Objects.keys(exports); ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				if (key !== "default") {
					namespace[key] = exports[key];
				}
			}
		}
		// import() of a CommonJS file exposes a "module.exports" binding, which is how the ownership index
		// recognises a CommonJS namespace whose file is not named `.cjs` (a CommonJS `.js`, #521). It is
		// non-enumerable so every key walk over the namespace sees exactly the exports listed above.
		Objects.defineProperty(namespace, "module.exports", { __proto__: null, value: exports, enumerable: false });
		return namespace;
	}

	/**
	 * Per-directory cache of the nearest package.json `type` scope, so a tree of `.js` leaves reads each
	 * package.json once. Values: `"module"`, `"commonjs"`, `"none"` (no package.json / no `type`), or
	 * `"invalid"` (unreadable or malformed package.json — left for Node's own loader to report).
	 * @type {Map<string, string>}
	 * @private
	 */
	#packageTypeCache = new Map();

	/**
	 * Resolve the `type` of the package scope a directory belongs to, the way Node does: walk up to the
	 * nearest `package.json` (the first one found ends the walk, with or without a `type`), stopping at a
	 * `node_modules` boundary or the filesystem root.
	 * @param {string} dir - Absolute directory of the file being loaded.
	 * @returns {Promise<string>} `"module"`, `"commonjs"`, `"none"`, or `"invalid"`.
	 * @example
	 * await this.#packageScopeType("/abs/api/counter"); // "commonjs"
	 * @private
	 */
	async #packageScopeType(dir) {
		const visited = [];
		let current = dir;
		let type = "none";
		for (;;) {
			const cached = MapMethods.get(this.#packageTypeCache, current);
			if (cached !== undefined) {
				type = cached;
				break;
			}
			listPush(visited, current);
			const raw = await PromiseMethods.catch(fsp.readFile(path.join(current, "package.json"), "utf8"), () => null);
			if (raw !== null) {
				const pkg = parseJsonOrNull(raw);
				// Node rejects a package.json that is not a JSON object (ERR_INVALID_PACKAGE_CONFIG) and
				// ignores a `type` other than "module" / "commonjs".
				if (pkg === null || typeof pkg !== "object" || Arrays.isArray(pkg)) type = "invalid";
				else type = pkg.type === "module" || pkg.type === "commonjs" ? pkg.type : "none";
				break;
			}
			const parent = path.dirname(current);
			if (parent === current || path.basename(current) === "node_modules") break;
			current = parent;
		}
		for (let ofIndex = 0, ofList = visited; ofIndex < ofList.length; ofIndex++) {
			const d = ofList[ofIndex];
			MapMethods.set(this.#packageTypeCache, d, type);
		}
		return type;
	}

	/**
	 * Whether Node loads this `.js` file as CommonJS (#521).
	 * @param {string} filePath - Absolute path to a `.js` file.
	 * @returns {Promise<boolean>} True when the file is CommonJS and must take the isolated CJS path.
	 * @example
	 * if (await this.#isCommonJSFile("/abs/api/counter.js")) return this.#loadCJSIsolated(...);
	 * @private
	 *
	 * @description
	 * Mirrors Node's own format resolution for `.js`:
	 * - nearest package.json `"type": "module"` → ES module;
	 * - `"type": "commonjs"` → CommonJS, with no syntax detection (Node reports ESM syntax there as an
	 *   error either way);
	 * - no `type` (or no package.json) → Node's syntax detection: the source is compiled as a CommonJS
	 *   function body, exactly as Node's CJS loader wraps it; when that compiles, Node loads the file as
	 *   CommonJS, and when it throws (an `import`/`export` statement, `import.meta`, top-level `await`, or
	 *   a genuine syntax error), the file is left to `import()` so Node itself decides — loading it as
	 *   an ES module or reporting the error.
	 * - an unreadable/malformed package.json → `import()`, which surfaces Node's own error.
	 */
	async #isCommonJSFile(filePath) {
		const type = await this.#packageScopeType(path.dirname(filePath));
		if (type === "commonjs") return true;
		if (type !== "none") return false;
		const compileFunction = VM_COMPILE_FUNCTION;
		// A leading hashbang is valid in a CommonJS file (Node strips it) but not in a function body.
		const source = regExpReplace(/^#!.*/, await fsp.readFile(filePath, "utf8"), "");
		try {
			compileFunction(source, ["exports", "require", "module", "__filename", "__dirname"], { filename: filePath });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Persist transformed TS code to a project-local cache file and build the
	 * file URL with the same `?slothlet_instance=…&module=…&_reload=…` suffix
	 * the `.mjs` branch uses, so bare-specifier resolution works and Node's
	 * module-cache key matches the `.mjs` branch (URLs incl. query are the key).
	 * Records the cache directory on the slothlet instance for shutdown cleanup.
	 * @param {Function} writeTransformedToCache - Lazily-imported helper from processors/typescript
	 * @param {string} filePath - Original .ts/.mts source path
	 * @param {string} code - Transformed JavaScript code
	 * @param {string} instanceID - Slothlet instance ID
	 * @param {string} [moduleID] - Optional module ID for api.slothlet.api.add
	 * @param {number|null} [cacheBust] - Optional reload timestamp
	 * @param {(filePath: string) => Promise<string>} [transform] - Transpiler used to
	 *   follow relative .ts/.mts imports between user modules
	 * @returns {Promise<string>} Full file:// URL with cache-bust query
	 * @private
	 */
	async #buildTypescriptModuleUrl(writeTransformedToCache, filePath, code, instanceID, moduleID, cacheBust, transform) {
		const { url, cacheDir } = await writeTransformedToCache(filePath, code, instanceID, transform);
		SetMethods.add((this.slothlet._typescriptCacheDirs ??= new Set()), cacheDir);
		let moduleUrl = `${url}?slothlet_instance=${instanceID}`;
		// The false (no-moduleID) arm is covered by initial-TS-load tests in isolation but lost in
		// full-suite coverage merge — the .mjs branch above (lines 195-204) uses the same pattern
		// and matches via cross-file aggregation; the TS branch fires in fewer files so v8 drops it.
		/* v8 ignore next 3 */
		if (moduleID) {
			moduleUrl += `&module=${runtime_encodeQueryValue(moduleID)}`;
		}
		if (this.slothlet.config?.helpers === "module") moduleUrl += `&${HELPERS_PARAM}=${HELPERS_PER_MODULE}`;
		if (cacheBust) {
			moduleUrl += `&_reload=${cacheBust}`;
		}
		return moduleUrl;
	}

	/**
	 * Scan directory for module files
	 * @param {string} dir - Directory to scan
	 * @param {Object} [options={}] - Scan options
	 * @param {boolean} [options.isRootScan=true] - Whether this is the root directory scan (shows empty dir warning)
	 * @param {number} [options.currentDepth=0] - Current traversal depth
	 * @param {number} [options.maxDepth=DEFAULT_API_DEPTH] - Maximum traversal depth ({@link DEFAULT_API_DEPTH})
	 * @param {Function|null} [options.fileFilter=null] - Optional filter function (fileName) => boolean to load specific files only
	 * @param {string|string[]|Function|null} [options.hidden=null] - Glob(s) hiding files/folders, matched against each entry's
	 *   path relative to the API root (extension-stripped for files). Internal recursion passes the compiled matcher function.
	 * @param {string} [options.rootDir] - API root the relative hidden-glob paths are computed from (defaults to the scanned dir).
	 * @returns {Promise<Object>} Directory structure
	 * @public
	 */
	async scanDirectory(dir, options = {}) {
		// Browser mode: the filesystem is not available. Use the manifest provided at init.
		if (this.slothlet.envTarget === "browser") {
			return this.#scanDirectoryBrowser(dir, options);
		}

		// Check if TypeScript is enabled and add .ts/.mts extensions
		const typescriptConfig = this.slothlet.config?.typescript;
		const defaultExtensions = [".mjs", ".cjs", ".js"];
		const typescriptExtensions = typescriptConfig?.enabled ? [".ts", ".mts"] : [];
		const allExtensions = concatLists(defaultExtensions, typescriptExtensions);

		const {
			recursive = true,
			extensions = allExtensions,
			isRootScan = true,
			currentDepth = 0,
			maxDepth = DEFAULT_API_DEPTH,
			fileFilter = null,
			hidden = null,
			rootDir = dir
		} = options;

		// Compile the hidden matcher once (on the root scan); recursion receives the compiled function.
		const hiddenMatcher = typeof hidden === "function" ? hidden : compileHidden(hidden);
		// `.`/`__`-prefixed entries are hidden by default; a `hidden` glob that matches an entry decides instead.
		const apiRel = (p) => ArrayMethods.join(mapList(splitText(path.relative(rootDir, p), path.sep), hiddenSegment), ".");

		try {
			await fsp.stat(dir);
		} catch (error) {
			throw new this.SlothletError(
				"FOLDER_UNREADABLE",
				{
					folder: dir
				},
				{ cause: error }
			);
		}

		const structure = {
			files: [], // Array of { path, name, moduleID }
			directories: [] // Array of { path, name, children: structure }
		};

		const entries = await fsp.readdir(dir, { withFileTypes: true });

		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				// Skip directories if we're filtering for specific files
				// (single file mode shouldn't load subdirectories)
				if (fileFilter) {
					continue;
				}

				// The consumer-supplied `hidden` glob(s) over the built-in `.`/`__` rule.
				if (isHiddenEntry(hiddenMatcher, apiRel(fullPath), entry.name, true)) {
					continue;
				}

				// Only recurse if within depth limit
				if (recursive && currentDepth < maxDepth) {
					const subStructure = await this.scanDirectory(fullPath, {
						...options,
						isRootScan: false,
						currentDepth: currentDepth + 1,
						hidden: hiddenMatcher,
						rootDir
					});
					// #156: a folder that yields no files and no kept subfolders must not create a leaf.
					if (subStructure.files.length === 0 && subStructure.directories.length === 0) {
						continue;
					}
					// Checked once the folder is known to produce a member, like the file check below.
					this.#assertLoadableFolderName(entry.name, dir);
					listPush(structure.directories, {
						path: fullPath,
						name: entry.name,
						children: subStructure
					});
				}
			} else if (entry.isFile()) {
				const ext = path.extname(entry.name);
				if (typeof extensions === "string" ? StringMethods.includes(extensions, ext) : ArrayMethods.includes(extensions, ext)) {
					const nameWithoutExt = path.basename(entry.name, ext);

					// The consumer-supplied `hidden` glob(s), matched against the file's extension-stripped API path
					// relative to the API root, over the built-in rule that skips `.`/`__`-prefixed files (JSDoc-only,
					// test helpers, dotfiles, etc.).
					if (isHiddenEntry(hiddenMatcher, apiRel(path.join(dir, nameWithoutExt)), entry.name, false)) {
						continue;
					}

					// Apply file filter if provided
					if (fileFilter && !fileFilter(entry.name)) {
						continue;
					}

					// Reserved-name rejection (#260): a module file named for a framework-reserved key
					// would overwrite the framework's own handle when its children are adopted — the
					// `___materialize.mjs` shape used to break composition with a bare TypeError, and
					// `____impl.mjs` silently emptied the lazy surface. Fail the scan with a named error
					// instead, for a `__`-prefixed name a `hidden` glob brought back as for a name that
					// only sanitizes into a reserved one (such as `-____impl`).
					//
					// Checked LAST, after every exclusion: the refusal covers the files this mount
					// actually loads. A single-file `api.add` filters the listing down to one file, and
					// `hidden` globs drop files the consumer has excluded — neither reaches the composed
					// surface, so neither is this mount's problem. Each fails on its own the moment
					// something does try to compose it.
					if (this.#isReservedEntryName(nameWithoutExt)) {
						throw new this.SlothletError("MODULE_RESERVED_FILE", { file: entry.name, folder: dir });
					}
					this.#assertNotThenable(nameWithoutExt, entry.name, dir);

					listPush(structure.files, {
						path: fullPath,
						name: nameWithoutExt,
						fullName: entry.name,
						moduleID: this.slothlet.helpers.sanitize.getModuleId(fullPath, dir)
					});
				}
			}
		}

		// Warn if directory is empty or has no loadable modules (only for root scans or add-api workflows).
		if (isRootScan && structure.files.length === 0 && structure.directories.length === 0) {
			new this.SlothletWarning("WARNING_FOLDER_EMPTY", {
				folder: dir,
				resolved: path.resolve(dir)
			});
		}

		return structure;
	}

	/**
	 * Browser-mode directory scan: builds the same `{ files, directories }` structure
	 * that the filesystem-based `scanDirectory` produces, but from the pre-generated
	 * `manifest` object provided via `config.manifest`.
	 *
	 * The manifest is the top-level structure. When a sub-path `dir` is requested
	 * (e.g. from `api.slothlet.api.add` in browser mode), this method searches the
	 * manifest recursively to find the matching directory node.
	 *
	 * @param {string} dir - Root or sub-directory identifier. Empty string / "/" means root.
	 * @param {Object} [options={}] - Scan options forwarded from `scanDirectory`.
	 * @param {Function|null} [options.fileFilter=null] - Optional file-name filter.
	 * @returns {{ files: Array, directories: Array }} Directory structure.
	 * @throws {SlothletError} When the manifest is missing or the requested dir is not found.
	 * @private
	 *
	 * @example
	 * // Called internally by scanDirectory in browser mode:
	 * this.#scanDirectoryBrowser("", {});
	 * this.#scanDirectoryBrowser("billing", { fileFilter: (n) => n === "invoice.mjs" });
	 */
	#scanDirectoryBrowser(dir, options = {}) {
		const manifest = this.slothlet.config?.loader?.files;
		// manifest is validated during transformConfig; this guard protects against
		// accidental calls before config is fully applied.
		/* v8 ignore next 3 */
		if (!manifest) {
			throw new this.SlothletError("INVALID_CONFIG_FILES_REQUIRED", {});
		}

		// Compute the relative path by stripping the base URL/path prefix.
		// When dir equals config.base (the root), the relative path is empty → root scan.
		// When dir is a relative segment like "utils", it passes through unchanged.
		// The `|| ""` fallbacks on each line are defensive: real callers always go
		// through transformConfig (config.base non-empty) and pass a resolved dir
		// via scanDirectory's public callers (modes/{eager,lazy}.mjs + api.add).
		// Direct internal `loader.scanDirectory("")` is not a supported path.
		/* v8 ignore next */
		const configBase = regExpReplace(/\/$/, this.slothlet.config?.base || "", "");
		/* v8 ignore next */
		let relativePath = regExpReplace(/\/$/, dir || "", "");
		if (configBase && StringMethods.startsWith(relativePath, configBase)) {
			relativePath = regExpReplace(/^\/|\/$/g, StringMethods.slice(relativePath, configBase.length), "");
		}

		const isRoot = !relativePath || relativePath === "/" || relativePath === ".";
		const node = isRoot ? manifest : this.#findManifestNode(manifest, relativePath);
		if (!node) {
			throw new this.SlothletError("FOLDER_UNREADABLE", { folder: dir });
		}

		return this.#manifestNodeToStructure(node, dir, options);
	}

	/**
	 * Recursively search the manifest tree for the node that matches `targetPath`.
	 *
	 * @param {Object} node - Current manifest node (`{ files, directories }`).
	 * @param {string} targetPath - Relative path of the directory to find.
	 * @returns {Object|null} Matched manifest node, or null when not found.
	 * @private
	 *
	 * @example
	 * this.#findManifestNode(manifest, "billing");
	 * this.#findManifestNode(manifest, "billing/reports");
	 */
	#findManifestNode(node, targetPath) {
		const normalised = regExpReplace(/^\/|\/$/g, regExpReplace(/\\/g, targetPath, "/"), "");
		// `node.directories || []` defensive fallback for malformed manifest nodes
		// — generateManifest always emits the field, and the validation in Config
		// guarantees the top-level shape. The fallback is unreachable in normal flow.
		/* v8 ignore next */
		for (let i = 0, dirs = node.directories || []; i < dirs.length; i++) {
			const dir = dirs[i];
			// `dir.path || dir.name || ""` is a defensive fallback chain. Both fields
			// are normally populated by generateManifest; hand-crafted manifests may
			// omit one or the other. The final `|| ""` arm is unreachable because
			// at least one of `path` / `name` is required for a usable directory entry.
			/* v8 ignore next */
			const dirPath = regExpReplace(/^\/|\/$/g, regExpReplace(/\\/g, dir.path || dir.name || "", "/"), "");
			if (dirPath === normalised) return dir.children || dir;
			// Recurse into sub-directories for nested paths like "billing/reports".
			const found = this.#findManifestNode(dir.children || dir, normalised);
			if (found) return found;
		}
		return null;
	}

	/**
	 * Convert one manifest node into the `{ files, directories }` structure that the
	 * rest of the framework pipeline expects from `scanDirectory`.
	 *
	 * @param {Object} node - Manifest node with optional `files` and `directories` arrays.
	 * @param {string} rootPath - Root-relative path prefix for this node (used for `moduleID`).
	 * @param {Object} [options={}] - Scan options.
	 * @param {Function|null} [options.fileFilter=null] - Optional file-name filter.
	 * @returns {{ files: Array, directories: Array }} Directory structure.
	 * @private
	 *
	 * @example
	 * this.#manifestNodeToStructure(manifest, "", {});
	 */
	#manifestNodeToStructure(node, rootPath, options = {}) {
		// Mirror the disk scan's inclusion gating so browser-manifest mode honors the same runtime
		// options: consumer `hidden` glob over the dot/`__`-prefix skip, `apiDepth`/`maxDepth`, and empty-subtree
		// pruning (#423). `apiPrefix` accumulates the dotted api-relative path
		// through recursion (browser has no `node:path` for a `path.relative`-based apiRel).
		const { fileFilter = null, hidden = null, maxDepth = DEFAULT_API_DEPTH, currentDepth = 0, apiPrefix = "" } = options;
		const ALLOWED_EXTS = [".mjs", ".cjs", ".js"];
		const hiddenMatcher = typeof hidden === "function" ? hidden : compileHidden(hidden);
		const structure = { files: [], directories: [] };

		for (let i = 0, files = node.files || []; i < files.length; i++) {
			const file = files[i];
			const filePath = file.path || file.relativePath || "";
			const fullName = file.full || ArrayMethods.pop(splitText(filePath, "/"));
			const lastDot = StringMethods.lastIndexOf(fullName, ".");
			const ext = lastDot >= 0 ? (typeof fullName === "string" ? StringMethods.slice(fullName, lastDot) : copyList(fullName, lastDot)) : "";

			// Skip non-JS files.
			if (!ArrayMethods.includes(ALLOWED_EXTS, ext)) continue;

			// Apply caller-supplied file filter (used for single-file api.add calls).
			if (fileFilter && !fileFilter(fullName)) continue;

			// Inner ternary's false-arm (lastDot < 0) is unreachable here: the
			// ALLOWED_EXTS check above (`continue` when ext === "") filters out any
			// file without a dot in its fullName before reaching this name fallback.
			/* v8 ignore next */
			const name =
				file.name ||
				(lastDot >= 0
					? typeof fullName === "string"
						? StringMethods.slice(fullName, 0, lastDot)
						: copyList(fullName, 0, lastDot)
					: fullName);

			// Consumer `hidden` glob, matched against the file's extension-stripped api-relative
			// dotted path, over the dot/double-underscore skip — same semantics as the disk scan.
			if (isHiddenEntry(hiddenMatcher, apiPrefix ? `${apiPrefix}.${hiddenSegment(name)}` : hiddenSegment(name), fullName, false)) continue;

			// Reserved-name rejection (#260), mirroring the filesystem scan. The hazard is the
			// composed wrapper shape, not the platform: a manifest carrying `____impl.mjs` would empty
			// the lazy surface in a browser exactly as it does under Node.
			if (this.#isReservedEntryName(name)) {
				throw new this.SlothletError("MODULE_RESERVED_FILE", { file: fullName, folder: rootPath });
			}
			this.#assertNotThenable(name, fullName, rootPath);

			listPush(structure.files, {
				path: filePath,
				name,
				fullName,
				moduleID: this.slothlet.helpers.sanitize.getModuleId(filePath, rootPath)
			});
		}

		// Never recurse into subdirectories when a file-filter is active (single-file mode).
		if (!fileFilter) {
			for (let i = 0, dirs = node.directories || []; i < dirs.length; i++) {
				const dir = dirs[i];
				const dirPath = dir.path || dir.name || "";
				const dirName = dir.name || ArrayMethods.pop(splitText(dirPath, "/"));

				// The consumer `hidden` glob against the folder's api-relative path, over the dot/`__` skip.
				const dirApiRel = apiPrefix ? `${apiPrefix}.${hiddenSegment(dirName)}` : hiddenSegment(dirName);
				if (isHiddenEntry(hiddenMatcher, dirApiRel, dirName, true)) continue;

				// apiDepth / maxDepth truncation: don't descend past the limit.
				if (currentDepth >= maxDepth) continue;

				const children = this.#manifestNodeToStructure(dir.children || dir, dirPath, {
					...options,
					hidden: hiddenMatcher,
					currentDepth: currentDepth + 1,
					apiPrefix: dirApiRel
				});

				// A folder that yields no files and no kept subfolders must not create a leaf (#156).
				if (children.files.length === 0 && children.directories.length === 0) continue;

				this.#assertLoadableFolderName(dirName, rootPath);
				listPush(structure.directories, { path: dirPath, name: dirName, children });
			}
		}

		return structure;
	}

	/**
	 * Browser-mode module loading: delegates to the `loader.resolve` callback
	 * supplied in `config`, or falls back to resolving relative to `config.base`. Plain
	 * filesystem paths are automatically converted to `file://` URLs so callers do not
	 * need to prefix `base` with `"file://"`.
	 *
	 * @param {string} filePath - The relative path as stored in the manifest.
	 * @returns {Promise<Object>} Loaded module namespace.
	 * @private
	 *
	 * @example
	 * // Default resolver — no loader.resolve needed when base is a filesystem path:
	 * // config.base = "/srv/api"  →  loads file:///srv/api/auth.mjs
	 * await this.#loadModuleBrowser("auth.mjs");
	 *
	 * @example
	 * // Custom resolver — user supplies loader.resolve:
	 * // config.loader.resolve = ({ path }) => `https://cdn.example.com/api/${path}`;
	 * await this.#loadModuleBrowser("auth.mjs");
	 */
	async #loadModuleBrowser(filePath, instanceID, moduleID, cacheBust = null) {
		// Use the user-supplied resolver, or fall back to resolving relative to config.base.
		// Plain filesystem paths (no URL scheme) are automatically converted to file:// URLs
		// so callers can pass base: "/path/to/api" without manually prefixing "file://".
		const resolveModuleSpecifier =
			this.slothlet.config?.loader?.resolve ??
			(({ path: p }) => {
				// `?? ""`: transformConfig always sets `base`, so the fallback arm is defensive.
				/* v8 ignore next */
				const base = this.slothlet.config?.base ?? "";
				// If base already has a URL scheme (file://, https://, etc.) keep it; otherwise
				// convert a plain filesystem path to a file:// URL with a trailing slash so that
				// new URL(relativePath, base) resolves correctly.
				// Windows-style paths (e.g. "C:/api" — no leading slash) take the
				// `: "/"` arm of the inline conditional. The Node-only test runner
				// runs under POSIX paths and cannot exercise the Windows branch
				// without an actual Windows filesystem — passing a custom resolver
				// bypasses this code path entirely.
				/* v8 ignore next */
				const leadingSlash = StringMethods.startsWith(base, "/") ? "" : "/";
				const baseUrl =
					RegExpMethods.exec(/^[a-zA-Z][\w+\-.]*:\/\//, base) !== null
						? StringMethods.endsWith(base, "/")
							? base
							: base + "/"
						: "file://" + leadingSlash + regExpReplace(/\/?$/, base, "/");
				return URLMethods.href(new URL(p, baseUrl));
			});

		const fullName = ArrayMethods.pop(splitText(filePath, "/"));
		const lastDot = StringMethods.lastIndexOf(fullName, ".");
		// Ternary false-arm (lastDot < 0) is unreachable: files reaching
		// #loadModuleBrowser have already passed #manifestNodeToStructure's
		// ALLOWED_EXTS filter, which requires a dot + recognised JS extension.
		/* v8 ignore next */
		const name = lastDot >= 0 ? StringMethods.slice(fullName, 0, lastDot) : fullName;

		const specifier = resolveModuleSpecifier({ path: filePath, name, full: fullName });
		const imported = withInstanceQuery(specifier, instanceID, moduleID, cacheBust);
		// The live runtime tells a suspended call apart from the host by the module's location in a stack
		// frame. A resolver can return a URL that does not end in the manifest path (a `blob:` or `data:`
		// URL, or another path on a server), so the URL actually imported is recorded to match against.
		let byMount = MapMethods.get(this.#importedLocations, filePath);
		if (!byMount) MapMethods.set(this.#importedLocations, filePath, (byMount = new Map()));
		MapMethods.set(byMount, moduleID ?? "", String(imported));
		this.#importedLocationList = null;
		this.#rememberImportedURL(filePath, String(imported));
		// The helper files a leaf imports carry no tag in a browser: the folder the leaf came from tells them a module's.
		noteModuleRoot(String(specifier), filePath);
		const module = await import(imported);
		return module;
	}

	/**
	 * Add a URL to those a file was imported from (see {@link Loader#importedURLs}).
	 * @param {string} filePath - The path the file was loaded as.
	 * @param {string} url - The URL it was imported from.
	 * @returns {void}
	 * @private
	 */
	#rememberImportedURL(filePath, url) {
		let urls = MapMethods.get(this.#importedURLs, filePath);
		if (!urls) MapMethods.set(this.#importedURLs, filePath, (urls = []));
		if (ArrayMethods.includes(urls, url)) return;
		listPush(urls, url);
		if (urls.length > Loader.IMPORTED_URLS_PER_FILE) listSplice(urls, 0, urls.length - Loader.IMPORTED_URLS_PER_FILE);
	}

	/**
	 * Whether this loader imported a file under a query (#691): the file's own loads, under any mount and across its
	 * reloads (the newest {@link Loader.IMPORTED_URLS_PER_FILE}), and not a URL some module wrote out for it.
	 * @param {string} filePath - The path the file was loaded as.
	 * @param {string} query - A query, without its `?`.
	 * @returns {boolean} True when one of its imports carried exactly that query.
	 * @public
	 *
	 * @example
	 * loader.importedUnderQuery("/app/api/tally.mjs", "slothlet_instance=abc&module=mod1"); // true
	 */
	importedUnderQuery(filePath, query) {
		const urls = MapMethods.get(this.#importedURLs, filePath);
		if (!urls) return false;
		const wanted = runtime_sortedQuery(query);
		for (let ofIndex = 0, ofList = urls; ofIndex < ofList.length; ofIndex++) {
			const url = ofList[ofIndex];
			const at = StringMethods.indexOf(url, "?");
			if (at !== -1 && runtime_sortedQuery(regExpReplace(/#.*$/, StringMethods.slice(url, at + 1), "")) === wanted) return true;
		}
		return false;
	}

	/**
	 * The URLs the live copies of a file were imported from, in this instance (#601): one per mount. In browser
	 * mode a resolver's URL; in Node the instance URL, which for a TypeScript leaf is its compiled copy.
	 *
	 * @param {string} filePath - The manifest path the file was loaded as.
	 * @param {string|null} [moduleID] - A mount: only its copy's URL, when it imported one (two mounts of a folder
	 *   import their own copies, and a `blob:` / `data:` URL carries no mount to tell them apart by).
	 * @returns {Set<string>|undefined} The imported URLs, or undefined when the file was not imported.
	 * @public
	 *
	 * @example
	 * loader.importedLocationsFor("rogue.mjs"); // Set { "blob:https://app.test/0c1f…" }
	 */
	importedLocationsFor(filePath, moduleID) {
		const byMount = MapMethods.get(this.#importedLocations, filePath);
		if (!byMount) return undefined;
		if (moduleID != null && MapMethods.has(byMount, moduleID)) return setFrom([MapMethods.get(byMount, moduleID)]);
		return setFrom(mapValuesToArray(byMount));
	}

	/**
	 * Every location this instance imported a leaf from (#601 review): the file, or the URL or compiled copy it
	 * was imported as. In Node each carries the instance query, so an untagged copy of one is not the instance's.
	 *
	 * @returns {Array<string>} The files and imported URLs; the same array until another location is recorded.
	 * @public
	 *
	 * @example
	 * loader.importedLocations(); // ["/app/api/tally.mjs", "file:///app/api/tally.mjs?slothlet_instance=…"]
	 */
	importedLocations() {
		if (this.#importedLocationList) return this.#importedLocationList;
		const locations = [];
		for (const ofEntry of mapEntries(this.#importedLocations)) {
			const filePath = ofEntry[0],
				byMount = ofEntry[1];
			Reflect.apply(ArrayMethods.push, undefined, concatLists([locations], concatLists([filePath], mapValuesToArray(byMount))));
		}
		this.#importedLocationList = locations;
		return locations;
	}

	/**
	 * Extract exports from module
	 * @param {Object} module - Loaded module
	 * @param {string} [filePath] - The module's file, named in a refusal.
	 * @returns {Object} Extracted exports
	 * @public
	 */
	extractExports(module, filePath) {
		const exports = {};

		// Add the default export when the module binds one: `export default undefined` binds it as `0` or
		// `null` would, so presence is the binding, not its value (#585 review).
		if ("default" in module) {
			exports.default = module.default;
		}

		// Add named exports (excluding module.exports which is a Node.js internal property)
		for (let ofIndex = 0, ofList = Objects.keys(module); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (key !== "default" && key !== "module.exports" && typeof key === "string") {
				// Reserved-name rejection (#260): an export named for a framework-reserved key
				// (`___materialize`, `____impl`, …) can only ever be shadowed by the framework's own
				// handle — it is unreachable on the composed surface and a standing hazard to the
				// wrapper contract. Refuse it loudly at load instead of silently coexisting, so the
				// module author learns at the file, not from a distant behavioral surprise.
				if (isFrameworkReservedKey(key)) {
					throw new this.SlothletError("MODULE_RESERVED_EXPORT", { name: key });
				}
				// No api path can hold `__proto__`: composing it would set the node's prototype rather than add a
				// member. It is refused as a mount path, a `self` write or a routine name is (#585 review).
				if (key === "__proto__") {
					throw new this.SlothletError("API_PATH_INVALID", {
						path: segmentsOf(filePath ? `${filePath} (export '__proto__')` : "export '__proto__'"),
						reason: translate("API_PATH_REASON_UNSAFE_SEGMENT"),
						index: 0,
						segment: key
					});
				}
				// A `then` export that is a function would make the module's namespace awaitable (#571); one
				// holding data does not, and is an ordinary export. A namespace binding is never a user
				// accessor (a module runner may still expose it as a getter), so the export's value decides,
				// as it does for `await`.
				if (key === "then" && isAwaitableThen({ value: module[key] })) {
					throw thenableExportError(this.SlothletError, filePath ? `${filePath} (export 'then')` : "export 'then'");
				}
				exports[key] = module[key];
			}
		}

		// CJS Default Export Normalization:
		// When a CJS module does: module.exports = { default: something, namedExport: fn }
		// Node.js wraps it as: { default: { default: something, namedExport: fn }, namedExport: fn }
		// We need to unwrap this so it behaves like ESM: export default something; export { namedExport }
		if (exports.default && typeof exports.default === "object" && exports.default !== null && "default" in exports.default) {
			// Check if this looks like the CJS pattern:
			// All named exports at root should also exist in exports.default
			const rootNamedKeys = filterList(Objects.keys(exports), (k) => k !== "default" && k !== "module.exports");
			const defaultKeys = filterList(Objects.keys(exports.default), (k) => k !== "default");

			// If all root named exports exist in exports.default, this is the CJS pattern
			const isCJSPattern = ArrayMethods.every(rootNamedKeys, (k) => k in exports.default);

			if (isCJSPattern && defaultKeys.length > 0) {
				// Unwrap: promote exports.default.default to exports.default
				// Named exports are already at root level from Node.js
				exports.default = exports.default.default;
			}
		}

		return exports;
	}
}
