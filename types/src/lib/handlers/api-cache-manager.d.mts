/**
 * Cache entry structure for API tree storage and rebuild parameters.
 * @typedef {Object} CacheEntry
 * @property {string} endpoint - API path endpoint (e.g., ".", "plugins")
 * @property {string} moduleID - Module identifier
 * @property {Object} api - Complete buildAPI result tree (primary storage)
 * @property {string} folderPath - Source folder path
 * @property {string} mode - Loading mode: 'lazy' or 'eager'
 * @property {Object} sanitizeOptions - Sanitization configuration
 * @property {string} collisionMode - Collision handling mode
 * @property {Object} config - Config snapshot at add time
 * @property {number} timestamp - Cache creation time (Unix ms)
 */
/**
 * Manages API caches - complete buildAPI results per moduleID
 * @class ApiCacheManager
 * @extends ComponentBase
 * @public
 *
 * @description
 * Stores complete API trees for each moduleID with all rebuild parameters.
 * The cache is the PRIMARY storage - live API references cached trees.
 * Enables hot reload by rebuilding caches from disk and updating live references.
 *
 * @example
 * const cacheManager = new ApiCacheManager(slothlet);
 * cacheManager.set("module_abc", { api: tree, folderPath: "./plugins", ... });
 */
export class ApiCacheManager extends ComponentBase {
    static slothletProperty: string;
    /**
     * Create ApiCacheManager instance
     * @param {object} slothlet - Slothlet instance
     * @public
     */
    constructor(slothlet: object);
    /**
     * Cache storage - moduleID → CacheEntry
     * @type {Map<string, CacheEntry>}
     * @private
     */
    private caches;
    /**
     * Store cache entry for moduleID
     * @param {string} moduleID - Module identifier
     * @param {CacheEntry} entry - Cache entry with api tree and rebuild parameters
     * @returns {void}
     * @public
     *
     * @description
     * Stores complete buildAPI result. The cached API tree becomes the source of truth.
     * Existing references should point to entry.api, not copy it.
     *
     * @example
     * cache.set("base_abc123", {
     *   endpoint: ".",
     *   moduleID: "base_abc123",
     *   api: apiTree,
     *   folderPath: this.____config.dir,
     *   mode: "lazy",
     *   sanitizeOptions: {},
     *   collisionMode: "merge",
     *   config: {...this.____config},
     *   timestamp: Date.now()
     * });
     */
    public set(moduleID: string, entry: CacheEntry): void;
    /**
     * Get cache entry by moduleID
     * @param {string} moduleID - Module identifier
     * @returns {CacheEntry|undefined} Cache entry or undefined if not found
     * @public
     *
     * @example
     * const cache = cacheManager.get("base_abc123");
     * if (cache) {
     *   const api = cache.api; // Get API tree from cache
     * }
     */
    public get(moduleID: string): CacheEntry | undefined;
    /**
     * Check if cache exists for moduleID
     * @param {string} moduleID - Module identifier
     * @returns {boolean} True if cache exists
     * @public
     *
     * @example
     * if (cacheManager.has("base_abc123")) {
     *   // Cache exists
     * }
     */
    public has(moduleID: string): boolean;
    /**
     * Delete cache entry by moduleID
     * @param {string} moduleID - Module identifier
     * @returns {boolean} True if cache was deleted
     * @public
     *
     * @description
     * Removes cache entry. Should be called when module is removed via api.remove(moduleID).
     *
     * @example
     * cacheManager.delete("plugins_abc123");
     */
    public delete(moduleID: string): boolean;
    /**
     * Get all moduleIDs in cache
     * @returns {string[]} Array of moduleIDs
     * @public
     *
     * @example
     * const moduleIDs = cacheManager.getAllModuleIDs();
     * // ["base_abc123", "plugins_xyz789", ...]
     */
    public getAllModuleIDs(): string[];
    /**
     * Get cache diagnostics
     * @returns {object} Diagnostic information
     * @public
     *
     * @description
     * Returns diagnostic data about cached modules. Available under api.slothlet.diag.caches
     * when config.debug.diagnostics is enabled.
     *
     * @example
     * const diag = cacheManager.getCacheDiagnostics();
     * // {
     * //   totalCaches: 3,
     * //   caches: [
     * //     { moduleID: "base_abc123", endpoint: ".", pathCount: 42, timestamp: ... },
     * //     ...
     * //   ]
     * // }
     */
    public getCacheDiagnostics(): object;
    /**
     * Count API paths in a tree
     * @param {object} api - API tree
     * @param {WeakSet} [visited] - Visited objects (prevent circular refs)
     * @returns {number} Number of paths
     * @private
     */
    private _countPaths;
    /**
     * Clear all caches
     * @returns {void}
     * @public
     *
     * @description
     * Removes all cache entries. Used during shutdown or full reload.
     *
     * @example
     * cacheManager.clear();
     */
    public clear(): void;
    /**
     * Rebuild cache from disk by calling buildAPI with stored parameters
     * @param {string} moduleID - Module identifier to rebuild
     * @returns {Promise<object>} Fresh API tree from buildAPI
     * @public
     *
     * @description
     * Reloads module source files and rebuilds API tree. Does NOT update cache -
     * caller must call set() with fresh tree. Returns the new API tree.
     *
     * @example
     * const freshApi = await cacheManager.rebuildCache("plugins_abc123");
     * cacheManager.set("plugins_abc123", { ...existingEntry, api: freshApi, timestamp: Date.now() });
     */
    public rebuildCache(moduleID: string): Promise<object>;
}
/**
 * Cache entry structure for API tree storage and rebuild parameters.
 */
export type CacheEntry = {
    /**
     * - API path endpoint (e.g., ".", "plugins")
     */
    endpoint: string;
    /**
     * - Module identifier
     */
    moduleID: string;
    /**
     * - Complete buildAPI result tree (primary storage)
     */
    api: Object;
    /**
     * - Source folder path
     */
    folderPath: string;
    /**
     * - Loading mode: 'lazy' or 'eager'
     */
    mode: string;
    /**
     * - Sanitization configuration
     */
    sanitizeOptions: Object;
    /**
     * - Collision handling mode
     */
    collisionMode: string;
    /**
     * - Config snapshot at add time
     */
    config: Object;
    /**
     * - Cache creation time (Unix ms)
     */
    timestamp: number;
};
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=api-cache-manager.d.mts.map