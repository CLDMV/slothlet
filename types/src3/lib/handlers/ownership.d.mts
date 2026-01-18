/**
 * Tracks which modules own which API paths for hot reload and rollback
 * @public
 */
export class OwnershipManager {
    moduleToPath: Map<any, any>;
    pathToModule: Map<any, any>;
    /**
     * Register module ownership of API path with its value
     * @param {Object} options - Registration options
     * @param {string} options.moduleId - Module identifier
     * @param {string} options.apiPath - API path being registered
     * @param {*} options.value - The actual function/object being registered
     * @param {string} [options.source="core"] - Source of registration
     * @param {boolean} [options.allowConflict=false] - Allow overwriting existing owner
     * @returns {Object} Registration entry
     * @public
     */
    public register({ moduleId, apiPath, value, source, allowConflict }: {
        moduleId: string;
        apiPath: string;
        value: any;
        source?: string;
        allowConflict?: boolean;
    }): any;
    /**
     * Unregister module and return affected paths
     * @param {string} moduleId - Module to unregister
     * @returns {Object} Unregistration results with removed and rolled back paths
     * @public
     */
    public unregister(moduleId: string): any;
    /**
     * Remove specific moduleId from apiPath ownership
     * @param {string} apiPath - API path to modify
     * @param {string} moduleId - Module to remove
     * @returns {Object} Action taken (none, delete, or restore)
     * @private
     */
    private removePath;
    /**
     * Get current owner of API path
     * @param {string} apiPath - API path to check
     * @returns {Object|null} Current owner entry or null
     * @public
     */
    public getCurrentOwner(apiPath: string): any | null;
    /**
     * Get current value for API path
     * @param {string} apiPath - API path to check
     * @returns {*} Current value or undefined
     * @public
     */
    public getCurrentValue(apiPath: string): any;
    /**
     * Get all paths owned by module
     * @param {string} moduleId - Module to query
     * @returns {Array<string>} Array of API paths
     * @public
     */
    public getModulePaths(moduleId: string): Array<string>;
    /**
     * Get ownership history for path
     * @param {string} apiPath - API path to query
     * @returns {Array<Object>} Ownership history stack
     * @public
     */
    public getPathHistory(apiPath: string): Array<any>;
    /**
     * Check if module owns path
     * @param {string} moduleId - Module to check
     * @param {string} apiPath - API path to check
     * @returns {boolean} True if module owns path
     * @public
     */
    public ownsPath(moduleId: string, apiPath: string): boolean;
    /**
     * Get diagnostic info about ownership
     * @returns {Object} Diagnostic information
     * @public
     */
    public getDiagnostics(): any;
    /**
     * Clear all ownership data
     * @public
     */
    public clear(): void;
}
//# sourceMappingURL=ownership.d.mts.map