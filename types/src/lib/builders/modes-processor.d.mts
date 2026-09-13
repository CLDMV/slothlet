/**
 * ModesProcessor - Handles mode-specific file and directory processing.
 *
 * @class
 * @extends ComponentBase
 * @package
 */
export class ModesProcessor extends ComponentBase {
    static slothletProperty: string;
    /**
     * Creates a new ModesProcessor instance.
     *
     * @param {Object} slothlet - Parent slothlet instance
     */
    constructor(slothlet: Object);
    /**
     * Recursively walk a directory's scanned files/subdirectories and compose them onto `api`.
     * @param {Object} api - Root api object being built.
     * @param {Array<Object>} files - This directory's own files (from the loader's scan structure).
     * @param {{name: string, path?: string, children: {files: Array, directories: Array}}} directory - This directory's own scan node.
     * @param {number} currentDepth - Recursion depth, for `apiDepth` enforcement.
     * @param {string} mode - `"eager"` or `"lazy"`.
     * @param {boolean} isRoot - Whether this call is the top-level (mount root) invocation.
     * @param {boolean} recursive - Whether to descend into subdirectories at all.
     * @param {boolean} [populateDirectly=false] - Pour this directory's contents directly into `api` (no nested namespace level) — used for transparent-folder and lazy-materialization callers.
     * @param {string} [apiPathPrefix=""] - Dotted api path prefix this directory's own entries are built under.
     * @param {string} [collisionContext="initial"] - `"initial"` or `"api"` — which `config.collision` policy governs this build.
     * @param {string|null} [moduleID=null] - Module id every leaf produced by this call is attributed to.
     * @param {string|null} [sourceFolder=null] - Filesystem path this directory was scanned from, for metadata.
     * @param {string|null} [cacheBust=null] - Cache-busting value forwarded to dynamic imports.
     * @param {string|null} [collisionModeOverride=null] - Per-call override (e.g. `api.add()`'s `forceOverwrite`) that takes precedence over `collisionContext`'s config default for every leaf this call (and its own recursive calls) produces.
     * @param {boolean} [rootUnwrap=false] - The mount exposes its single root entry's exports directly at the mount path (a single-file or synthetic `api.add()`), so that entry creates no api level.
     * @returns {Promise<Function|null>} The root-level default-export contributor function, if one was found at this call's own top level; otherwise `null`.
     * @package
     */
    processFiles(api: Object, files: Array<Object>, directory: {
        name: string;
        path?: string;
        children: {
            files: any[];
            directories: any[];
        };
    }, currentDepth: number, mode: string, isRoot: boolean, recursive: boolean, populateDirectly?: boolean, apiPathPrefix?: string, collisionContext?: string, moduleID?: string | null, sourceFolder?: string | null, cacheBust?: string | null, collisionModeOverride?: string | null, rootUnwrap?: boolean): Promise<Function | null>;
    /**
     * Create lazy wrapper for subdirectory (lazy mode only)
     * @param {Object} dir - Directory structure to materialize on first access.
     * @param {string} apiPath - Current (already composed) API path for this subdirectory.
     * @param {string} [moduleID] - Owning module id, threaded into the loader and ownership registration.
     * @param {string} [sourceFolder] - Parent's source folder path; this subdirectory's own source folder is derived from it.
     * @param {*} [cacheBust] - Cache-busting token passed through to `loadModule`.
     * @param {Object} [fileFolderCollisionImpl] - Pre-existing implementation properties from a file/folder name collision, merged onto the materialized result so they survive lazy materialization.
     * @param {string} [collisionMode] - Effective (override-or-config-resolved) collision mode to apply within this subdirectory.
     * @param {string} [collisionContext] - Collision context ("initial" | "api") this subdirectory was mounted under, threaded to ownership/ collision-detection calls.
     * @returns {Proxy} Lazy unified wrapper
     * @public
     */
    public createLazySubdirectoryWrapper(dir: Object, apiPath: string, moduleID?: string, sourceFolder?: string, cacheBust?: any, fileFolderCollisionImpl?: Object, collisionMode?: string, collisionContext?: string): ProxyConstructor;
    /**
     * Apply root contributor pattern - merge API into root function
     * @param {Object} api - API object with properties
     * @param {Function|null} rootFunction - Root contributor function
     * @param {Object} config - Configuration
     * @param {string} mode - Mode name for debug messages
     * @returns {Promise<Object|Function>} Final API (function if root contributor, object otherwise)
     * @public
     */
    public applyRootContributor(api: Object, rootFunction: Function | null, mode: string): Promise<Object | Function>;
    #private;
}
import { ComponentBase } from "#factories/component-base";
//# sourceMappingURL=modes-processor.d.mts.map