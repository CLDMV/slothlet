/**
 * Loader component for module loading, directory scanning, and API merging
 * @class Loader
 * @extends ComponentBase
 * @package
 */
export class Loader extends ComponentBase {
    static slothletProperty: string;
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
     * @returns {Promise<Object>} Directory structure
     * @public
     */
    public scanDirectory(dir: string, options?: {
        isRootScan?: boolean | undefined;
        currentDepth?: number | undefined;
        maxDepth?: number | undefined;
        fileFilter?: Function | null | undefined;
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
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=loader.d.mts.map