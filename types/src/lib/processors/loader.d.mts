/**
 * Warns when a coverage run will silently misattribute the consumer's leaf coverage (#235).
 *
 * @param {object} config - The instance's transformed config.
 * @param {object} [overrides] - Environment inputs, injectable for tests.
 * @param {object|undefined} [overrides.worker] - The vitest worker global, when present.
 * @param {boolean} [overrides.externalized] - Whether this slothlet copy is outside the runner's
 *   module graph.
 * @returns {boolean} True when the warning was emitted.
 * @package
 *
 * @description
 * Fires only when every condition of the misattribution scenario holds: a vitest COVERAGE run is
 * active (`__vitest_worker__.config.coverage.enabled` — a plain test run stays silent), this
 * slothlet copy is EXTERNALIZED (an inlined copy attributes fine), no `import` importer is
 * configured (the fix), and the instance is not `silent`. The worker global is vitest-internal,
 * so it is read defensively — its absence or a shape change simply means no hint, never a wrong
 * one. Detection cannot DO the fix: the importer must be a closure authored in the consumer's own
 * transformed code, which is why this is a pointer to docs/TESTING.md rather than an auto-enable.
 */
export function warnIfCoverageWithoutImporter(config: object, { worker, externalized }?: {
    worker?: object | undefined;
    externalized?: boolean | undefined;
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
 * @param {object} [overrides] - Environment inputs forwarded to {@link isCoverageRun}.
 * @returns {boolean} True when the warning was emitted.
 * @package
 *
 * @description
 * Without the inline map, coverage for a TypeScript leaf is recorded against its cache copy and
 * can never reach the `.ts` source. The Loader calls this once per instance, on the first
 * TypeScript leaf it loads; a `silent` instance stays quiet.
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
     * @returns {Promise<Object>} Loaded module
     * @public
     */
    public loadModule(filePath: string, instanceID?: string, moduleID?: string, cacheBust?: number | null): Promise<Object>;
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
     * @param {boolean} [options.scanHiddenFolders=false] - Deprecated: restore the pre-v3.11 scanning of `.`/`__`-prefixed folders.
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
        scanHiddenFolders?: boolean | undefined;
        rootDir?: string | undefined;
    }): Promise<Object>;
    /**
     * Extract exports from module
     * @param {Object} module - Loaded module
     * @returns {Object} Extracted exports
     * @public
     */
    public extractExports(module: Object): Object;
    #private;
}
import { ComponentBase } from "#factories/component-base";
//# sourceMappingURL=loader.d.mts.map