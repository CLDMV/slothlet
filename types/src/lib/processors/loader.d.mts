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
export function warnIfCoverageWithoutImporter(config: object, { worker, externalized, Warning }?: {
    worker?: object | undefined;
    externalized?: boolean | undefined;
    Warning?: Function | undefined;
}): boolean;
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
export function isCoverageRun({ worker, env }?: {
    worker?: object | undefined;
    env?: object | undefined;
}): boolean;
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
export function resolveSourcemap(typescriptConfig: object, overrides?: object): boolean;
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
export function warnIfCoverageWithoutSourcemap(config: object, overrides?: object): boolean;
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
export function typeGenerationWorkerPath(): string;
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
export function withInstanceQuery(specifier: string | URL, instanceID?: string, moduleID?: string, cacheBust?: number | string | null): string;
export class Loader extends ComponentBase {
    static slothletProperty: string;
    /**
     * How many of a file's imported URLs {@link Loader#importedURLs} keeps.
     * @type {number}
     */
    static IMPORTED_URLS_PER_FILE: number;
    /**
     * Create a Loader instance.
     * @param {object} slothlet - Slothlet class instance.
     * @package
     */
    constructor(slothlet: object);
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
    public loadModule(filePath: string, instanceID?: string, moduleID?: string, cacheBust?: number | null, paths?: string[] | null): Promise<Object>;
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
    public loadingFile(path: string, mount?: string | null): {
        path: string;
        moduleID: string | null;
        paths: ReadonlyArray<string> | null;
    } | null;
    /**
     * Whether this loader is loading any file now (see {@link Loader#loadingFile}).
     * @returns {boolean} True while a load runs.
     * @public
     * @example
     * loader.isLoading(); // false
     */
    public isLoading(): boolean;
    /**
     * Every load of a file this loader is running now, by the file's comparable path (see {@link Loader#loadingFile}),
     * however many there are.
     * @param {string} path - The file, in comparable form.
     * @returns {Array<{path: string, moduleID: string|null, paths: ReadonlyArray<string>|null}>} The loads.
     * @public
     * @example
     * loader.loadsOfFile("/app/api/ext/render.mjs"); // [{ path, moduleID: "ext", paths: ["ext.render"] }]
     */
    public loadsOfFile(path: string): Array<{
        path: string;
        moduleID: string | null;
        paths: ReadonlyArray<string> | null;
    }>;
    /**
     * The namespace of the CommonJS leaf this loader last loaded for a mount, which a copy of the tree uses instead of
     * evaluating the leaf again (see `Slothlet#buildCopy`).
     * @param {string} filePath - The file.
     * @param {string|null} moduleID - The mount.
     * @returns {object|null} The namespace, or null when it was not loaded.
     * @internal
     */
    loadedCommonJS(filePath: string, moduleID: string | null): object | null;
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
    public scanDirectory(dir: string, options?: {
        isRootScan?: boolean | undefined;
        currentDepth?: number | undefined;
        maxDepth?: number | undefined;
        fileFilter?: Function | null | undefined;
        hidden?: string | Function | string[] | null | undefined;
        rootDir?: string | undefined;
    }): Promise<Object>;
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
    public importedUnderQuery(filePath: string, query: string): boolean;
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
    public importedLocationsFor(filePath: string, moduleID?: string | null): Set<string> | undefined;
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
    public importedLocations(): Array<string>;
    /**
     * Extract exports from module
     * @param {Object} module - Loaded module
     * @param {string} [filePath] - The module's file, named in a refusal.
     * @returns {Object} Extracted exports
     * @public
     */
    public extractExports(module: Object, filePath?: string): Object;
    #private;
}
import { ComponentBase } from "#factories/component-base";
//# sourceMappingURL=loader.d.mts.map