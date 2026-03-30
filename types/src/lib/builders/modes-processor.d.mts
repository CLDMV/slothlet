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
    constructor(slothlet: any);
    processFiles(api: any, files: any, directory: any, currentDepth: any, mode: any, isRoot: any, recursive: any, populateDirectly?: boolean, apiPathPrefix?: string, collisionContext?: string, moduleID?: any, sourceFolder?: any, cacheBust?: any, collisionModeOverride?: any): Promise<any>;
    /**
     * Create lazy wrapper for subdirectory (lazy mode only)
     * @param {Object} dir - Directory structure
     * @param {string} apiPath - Current API path
     * @param {Object} config - Configuration
     * @returns {Proxy} Lazy unified wrapper
     * @public
     */
    public createLazySubdirectoryWrapper(dir: any, apiPath: string, moduleID?: any, sourceFolder?: any, cacheBust?: any, fileFolderCollisionImpl?: any, collisionMode?: string): ProxyConstructor;
    /**
     * Apply root contributor pattern - merge API into root function
     * @param {Object} api - API object with properties
     * @param {Function|null} rootFunction - Root contributor function
     * @param {Object} config - Configuration
     * @param {string} mode - Mode name for debug messages
     * @returns {Promise<Object|Function>} Final API (function if root contributor, object otherwise)
     * @public
     */
    public applyRootContributor(api: any, rootFunction: Function | null, mode: string): Promise<any | Function>;
}
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=modes-processor.d.mts.map