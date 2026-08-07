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
 * Loader component for module loading, directory scanning, and API merging
 * @class Loader
 * @extends ComponentBase
 * @package
 */
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
     * @param {number} [options.maxDepth=Infinity] - Maximum traversal depth
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