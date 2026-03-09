/**
 * Tracks which modules own which API paths for hot reload and rollback
 * @class OwnershipManager
 * @extends ComponentBase
 * @public
 */
export class OwnershipManager extends ComponentBase {
    static slothletProperty: string;
    constructor(slothlet: any);
    moduleToPath: Map<any, any>;
    pathToModule: Map<any, any>;
    _unregisteredModules: Set<any>;
    /**
     * Register module ownership of API path with its value
     * @param {Object} options - Registration options
     * @param {string} options.moduleID - Module identifier
     * @param {string} options.apiPath - API path being registered
     * @param {*} options.value - The actual function/object being registered
     * @param {string} [options.source="core"] - Source of registration
     * @param {string} [options.collisionMode="error"] - Collision mode: skip, warn, error, merge, replace
     * @param {Object} [options.config] - Config object for silent mode check
     * @param {string} [options.filePath=null] - File path of the module source (for metadata tracking)
     * @returns {Object|null} Registration entry or null if skipped
     * @public
     */
    public register({ moduleID, apiPath, value, source, collisionMode, config, filePath }: {
        moduleID: string;
        apiPath: string;
        value: any;
        source?: string;
        collisionMode?: string;
        config?: any;
        filePath?: string;
    }): any | null;
    /**
     * @param {string} moduleID - Module to unregister.
     * @returns {{ removed: string[], rolledBack: Record<string, string>[] }} Removal summary.
     * @public
     *
     * @description
     * Removes all paths owned by the provided moduleID and reports removals and rollbacks.
     *
     * @example
     * const result = ownership.unregister("module-a");
     */
    public unregister(moduleID: string): {
        removed: string[];
        rolledBack: Record<string, string>[];
    };
    /**
     * @param {string} apiPath - API path to modify.
     * @param {string|null} [moduleID=null] - Module to remove (defaults to current owner).
     * @returns {{ action: "delete"|"none"|"restore", removedModuleId: string|null,
     * restoreModuleId: string|null }} Action taken for the path.
     * @public
     *
     * @description
     * Removes a module owner from a specific API path. If the current owner is removed and
     * previous owners exist, the path is restored to the previous owner.
     *
     * @example
     * const result = ownership.removePath("plugins.tools", "module-a");
     */
    public removePath(apiPath: string, moduleID?: string | null): {
        action: "delete" | "none" | "restore";
        removedModuleId: string | null;
        restoreModuleId: string | null;
    };
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
     * @param {string} moduleID - Module to query
     * @returns {Array<string>} Array of API paths
     * @public
     */
    public getModulePaths(moduleID: string): Array<string>;
    /**
     * Get ownership history for path
     * @param {string} apiPath - API path to query
     * @returns {Array<Object>} Ownership history stack
     * @public
     */
    public getPathHistory(apiPath: string): Array<any>;
    /**
     * Check if module owns path
     * @param {string} moduleID - Module to check
     * @param {string} apiPath - API path to check
     * @returns {boolean} True if module owns path
     * @public
     */
    public ownsPath(moduleID: string, apiPath: string): boolean;
    /**
     * Get diagnostic info about ownership
     * @returns {Object} Diagnostic information
     * @public
     */
    public getDiagnostics(): any;
    /**
     * Get ownership info for a specific API path
     * @param {string} apiPath - API path to check
     * @returns {Set<string>|null} Set of moduleIDs that own this path, or null if path not found
     * @public
     */
    public getPathOwnership(apiPath: string): Set<string> | null;
    /**
     * Recursively register API subtree with ownership
     * @param {object} api - API object or subtree
     * @param {string} moduleID - Module identifier (owner)
     * @param {string} path - Current API path
     * @param {WeakSet} [visited] - Visited objects (prevents circular refs)
     * @returns {void}
     * @public
     *
     * @description
     * Registers entire API subtree structure with ownership manager.
     * Used during load, reload, and api.add to establish ownership relationships.
     *
     * @example
     * ownership.registerSubtree(api, "base_abc123", "");
     */
    public registerSubtree(api: object, moduleID: string, path: string, visited?: WeakSet<any>): void;
    /**
     * Clear all ownership data
     * @public
     */
    public clear(): void;
    /**
     * Export ownership state for preservation during reload
     * @returns {Object} Serializable ownership state
     * @public
     */
    public exportState(): any;
    /**
     * Import ownership state from exported data
     * @param {Object} state - Previously exported state
     * @public
     */
    public importState(state: any): void;
}
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=ownership.d.mts.map