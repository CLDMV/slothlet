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
    processFiles(api: any, files: any, directory: any, currentDepth: any, mode: any, isRoot: any, recursive: any, populateDirectly?: boolean, apiPathPrefix?: string, collisionContext?: string, moduleID?: null, sourceFolder?: null, cacheBust?: null, collisionModeOverride?: null): Promise<any>;
    /**
     * Create lazy wrapper for subdirectory (lazy mode only)
     * @param {Object} dir - Directory structure
     * @param {string} apiPath - Current API path
     * @param {Object} config - Configuration
     * @returns {Proxy} Lazy unified wrapper
     * @public
     */
    public createLazySubdirectoryWrapper(dir: Object, apiPath: string, moduleID?: null, sourceFolder?: null, cacheBust?: null, fileFolderCollisionImpl?: null, collisionMode?: string): ProxyConstructor;
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
}
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=modes-processor.d.mts.map