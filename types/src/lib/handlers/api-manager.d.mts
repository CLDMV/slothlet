/**
 * Manages runtime API component lifecycle (add/remove/reload).
 * @class ApiManager
 * @extends ComponentBase
 * @package
 *
 * @description
 * Class-based handler for managing API components at runtime. Tracks add history,
 * removed module IDs, and initial configuration per instance. Extends ComponentBase
 * for common Slothlet property access (config, debug, api, error classes, etc.).
 *
 * @example
 * const manager = new ApiManager(slothlet);
 * await manager.addApiComponent({ apiPath: "plugins", folderPath: "./plugins" });
 */
export class ApiManager extends ComponentBase {
    static slothletProperty: string;
    /**
     * Create an ApiManager instance.
     * @param {object} slothlet - Slothlet class instance.
     * @package
     *
     * @description
     * Initializes manager state with empty add history, removed module tracking,
     * and stores the initial configuration.
     *
     * @example
     * const manager = new ApiManager(slothlet);
     */
    constructor(slothlet: object);
    state: {
        addHistory: any[];
        initialConfig: any;
        operationHistory: any[];
    };
    /**
     * Normalize and validate an API path.
     * @param {string|string[]} apiPath - Dot-delimited API path, array of path segments, or empty/null for root.
     * @returns {{ apiPath: string, parts: string[] }} Normalized path data.
     * @throws {SlothletError} When apiPath is invalid.
     * @private
     *
     * @description
     * Ensures the API path is valid. Accepts:
     * - String: "some.path" → parts: ["some", "path"]
     * - Array: ["some", "path"] → parts: ["some", "path"]
     * - Empty string, null, or undefined → root level (parts: [])
     * Non-empty paths must contain no empty segments.
     *
     * @example
     * const { apiPath, parts } = this.normalizeApiPath("plugins.tools");
     * const { apiPath, parts } = this.normalizeApiPath(["plugins", "tools"]);
     * const { apiPath, parts } = this.normalizeApiPath(""); // Root level: parts = []
     */
    private normalizeApiPath;
    /**
     * Resolve and validate a path (file or directory) from caller context.
     * @param {string} inputPath - File or folder path provided by caller.
     * @returns {Promise<{resolvedPath: string, isDirectory: boolean, isFile: boolean}>} Path info.
     * @throws {SlothletError} When the path does not exist.
     * @private
     *
     * @description
     * Resolves relative paths from the caller and verifies the path exists.
     * Supports both files (.mjs, .cjs, .js) and directories.
     *
     * @example
     * const { resolvedPath, isDirectory, isFile } = await this.resolvePath("./plugins");
     * const { resolvedPath, isDirectory, isFile } = await this.resolvePath("./module.mjs");
     */
    private resolvePath;
    /**
     * Resolve and validate a folder path from caller context.
     * @param {string} folderPath - Folder path provided by caller.
     * @returns {Promise<string>} Absolute folder path.
     * @throws {SlothletError} When the folder does not exist or is not a directory.
     * @private
     *
     * @description
     * Resolves relative paths from the caller and verifies the folder exists.
     *
     * @deprecated Use resolvePath() instead for file/directory support.
     *
     * @example
     * const resolved = await this.resolveFolderPath("./plugins");
     */
    private resolveFolderPath;
    /**
     * Build a default moduleID when none is provided.
     * @param {string} apiPath - API path for this module.
     * @param {string} resolvedFolderPath - Absolute folder path.
     * @returns {string} Stable module identifier.
     * @private
     *
     * @description
     * Generates a stable moduleID using the apiPath and resolved folder path.
     *
     * @example
     * const moduleID = this.buildDefaultModuleId("plugins", "/abs/path/plugins");
     */
    private buildDefaultModuleId;
    /**
     * Read the current value at an API path.
     * @param {function|object} root - API root object.
     * @param {string[]} parts - Path segments.
     * @returns {unknown} Current value or undefined.
     * @private
     *
     * @description
     * Traverses the API graph by path segments and returns the value if found.
     *
     * @example
     * const value = this.getValueAtPath(api, ["plugins", "tools"]);
     */
    private getValueAtPath;
    /**
     * Ensure parent path exists and return the parent object.
     * @param {function|object} root - API root object.
     * @param {string[]} parts - Path segments.
     * @returns {function|object} Parent container for the final segment.
     * @throws {SlothletError} When a non-object path segment blocks creation.
     * @private
     *
     * @description
     * Walks through the path segments, creating missing objects as needed.
     *
     * @example
     * const parent = this.ensureParentPath(api, ["plugins", "tools"]);
     */
    private ensureParentPath;
    /**
     * Determine whether a value is a UnifiedWrapper proxy.
     * @param {unknown} value - Value to inspect.
     * @returns {boolean} True when value looks like a wrapper proxy.
     * @private
     *
     * @description
     * Checks for wrapper markers that are exposed on UnifiedWrapper proxies.
     *
     * @example
     * if (this.isWrapperProxy(api.plugins)) {
     * 	// Update wrapper implementation
     * }
     */
    private isWrapperProxy;
    /**
     * Synchronize an existing wrapper proxy with a new wrapper.
     * @param {function|object} existingProxy - Existing wrapper proxy.
     * @param {function|object} nextProxy - New wrapper proxy.
     * @param {object} config - Configuration object for debug logging.
     * @returns {Promise<boolean>} True when a wrapper update occurred.
     * @private
     *
     * @description
     * Copies materialization behavior and implementation from the new proxy into the existing
     * proxy to preserve references during reload operations.
     *
     * @example
     * await this.syncWrapper(existingProxy, nextProxy, this.____config);
     */
    private syncWrapper;
    /**
     * Recursively mutate an existing API value to match a new value.
     * @param {function|object} existingValue - Existing value to mutate.
     * @param {unknown} nextValue - New value to apply.
     * @param {object} options - Mutation options.
     * @param {boolean} options.removeMissing - Remove properties not present in nextValue.
     * @param {object} config - Configuration object for debug logging.
     * @returns {Promise<void>}
     * @private
     *
     * @description
     * Uses unified mergeApiObjects logic from api_assignment.mjs to ensure consistent
     * merge behavior between initial build and hot reload.
     *
     * @example
     * await this.mutateApiValue(existing, next, { removeMissing: true }, this.____config);
     */
    private mutateApiValue;
    /**
     * Set a value at a path within an API root.
     * @param {function|object} root - API root object.
     * @param {string[]} parts - Path segments.
     * @param {unknown} value - New value to assign.
     * @param {object} options - Assignment options.
     * @param {boolean} options.mutateExisting - Mutate existing values in place.
     * @param {boolean} options.allowOverwrite - Allow overwriting existing values.
     * @param {string} [options.collisionMode] - Collision handling mode (skip/warn/replace/merge/error).
     * @returns {Promise<boolean>} True if value was set, false if skipped due to collision.
     * @throws {SlothletError} When overwrite is not allowed or collision mode is "error".
     * @private
     *
     * @description
     * Writes a new value at the requested path with configurable collision handling.
     * Supports five collision modes:
     * - skip: Silently ignore collision, keep existing
     * - warn: Warn about collision, keep existing
     * - replace: Replace existing value completely
     * - merge: Merge properties (preserve original + add new)
     * - error: Throw error on collision
     *
     * @example
     * await this.setValueAtPath(api, ["plugins"], newApi, {
     *   mutateExisting: true,
     *   allowOverwrite: true,
     *   collisionMode: "merge"
     * });
     */
    private setValueAtPath;
    /**
     * Delete a value at a path and prune empty parents.
     * @param {function|object} root - API root object.
     * @param {string[]} parts - Path segments.
     * @returns {Promise<boolean>} True when a value was deleted.
     * @private
     *
     * @description
     * Removes the property at the provided path and cleans up any empty parent objects.
     *
     * @example
     * const deleted = await await this.deletePath(api, ["plugins", "tools"]);
     */
    private deletePath;
    /**
     * Restore a path from api.slothlet.api.add history or core load.
     * @param {string} apiPath - API path to restore.
     * @param {?string} moduleID - ModuleId to restore.
     * @returns {Promise<void>}
     * @private
     *
     * @description
     * Attempts to reapply a previous api.slothlet.api.add entry or rebuild the core API for the path.
     *
     * @example
     * await this.restoreApiPath("plugins", "plugins-core");
     */
    private restoreApiPath;
    /**
     * Add new API modules at runtime.
     * @param {object} params - Add parameters.
     * @param {string} params.apiPath - API path to attach.
     * @param {string|string[]} params.folderPath - File path, folder path, or array of paths to load.
     * @param {Record<string, unknown>} [params.options={}] - Add options (including optional metadata).
     * @returns {Promise<string|string[]>} Module ID or array of module IDs.
     * @throws {SlothletError} When the instance is not loaded or inputs are invalid.
     * @package
     *
     * @description
     * Loads modules from a folder, file, or array of files/folders using the instance configuration
     * and merges the resulting API under the specified apiPath.
     *
     * Supports three input types:
     * 1. Single directory path (original behavior)
     * 2. Single file path (.mjs, .cjs, .js)
     * 3. Array of file and/or directory paths
     *
     * When an array is provided, each path is processed sequentially,
     * honoring collision settings, metadata, and ownership for each.
     *
     * @example
     * // Directory
     * await manager.addApiComponent({
     * 	apiPath: "plugins",
     * 	folderPath: "./plugins",
     * 	options: { moduleID: "plugins-core", metadata: { version: "1.0.0" } }
     * });
     *
     * @example
     * // Single file
     * await manager.addApiComponent({
     * 	apiPath: "utils",
     * 	folderPath: "./helpers/string-utils.mjs",
     * 	options: { metadata: { author: "team" } }
     * });
     *
     * @example
     * // Array of files and folders
     * await manager.addApiComponent({
     * 	apiPath: "extensions",
     * 	folderPath: ["./ext/plugin1.mjs", "./ext/plugin2.mjs", "./ext/utils"],
     * 	options: { collisionMode: "merge" }
     * });
     */
    addApiComponent(params: {
        apiPath: string;
        folderPath: string | string[];
        options?: Record<string, unknown>;
    }): Promise<string | string[]>;
    /**
     * Roll back a failed versioned add.
     *
     * @description
     * Called when `versionManager.registerVersion()` throws after the API tree, cache,
     * ownership, and history have already been mutated by `addApiComponent()`. Scrubs
     * the orphaned "add" entry from `operationHistory`, then delegates tree/cache/ownership
     * and `addHistory` cleanup to `removeApiComponent({ recordHistory: false })` so that
     * no spurious "remove" entry is pushed into `operationHistory`.
     *
     * The rollback is best-effort: if `removeApiComponent` itself throws the error is
     * swallowed and the caller re-throws the original registration error.
     *
     * @param {object} opts - Rollback context.
     * @param {string} opts.moduleID - The moduleID of the just-added component.
     * @param {string} opts.effectivePath - The effective (versioned) mount path, e.g. "v1.auth".
     * @param {string} opts.normalizedPath - The logical path, e.g. "auth".
     * @returns {Promise<void>}
     * @package
     *
     * @example
     * await this._rollbackFailedVersionedAdd({ moduleID, effectivePath, normalizedPath });
     */
    _rollbackFailedVersionedAdd({ moduleID, effectivePath, normalizedPath }: {
        moduleID: string;
        effectivePath: string;
        normalizedPath: string;
    }): Promise<void>;
    /**
     * Remove API modules at runtime.
     * @param {string} pathOrModuleId - API path (with dots) or module ID (with underscore) to remove.
     * @returns {Promise<void>}
     * @throws {SlothletError} When inputs are invalid.
     * @package
     *
     * @description
     * Removes an API subtree by apiPath or removes all paths owned by a moduleID.
     * Automatically detects whether the parameter is a moduleID (contains underscore) or apiPath.
     *
     * @example
     * await manager.removeApiComponent("plugins.tools"); // Remove by API path
     *
     * @example
     * await manager.removeApiComponent("plugins_abc123"); // Remove by module ID
     */
    removeApiComponent(pathOrModuleId: string, options?: {}): Promise<void>;
    /**
     * Reload API modules using cache system.
     * @param {object} params - Reload parameters.
     * @param {?string} params.apiPath - API path to reload.
     * @param {?string} params.moduleID - ModuleId to reload.
     * @returns {Promise<void>}
     * @package
     *
     * @description
     * Reloads modules from disk using cached parameters. For moduleID reload, rebuilds
     * entire cache and restores all paths. For apiPath reload, rebuilds all contributing
     * moduleID caches and merges implementations.
     *
     * @example
     * await manager.reloadApiComponent({ moduleID: "plugins_abc123" });
     * await manager.reloadApiComponent({ apiPath: "plugins" });
     */
    reloadApiComponent(params: {
        apiPath: string | null;
        moduleID: string | null;
    }): Promise<void>;
    /**
     * Reload by moduleID - rebuild cache and restore all paths
     * @param {string} moduleID - Module identifier
     * @param {Object} [options] - Reload options
     * @param {boolean} [options.forceReplace=true] - Force replace mode on existing wrappers.
     *   When true, temporarily overrides collision mode to "replace" so the fresh impl
     *   fully replaces the old one. When false, the wrapper's original collision mode is
     *   preserved, allowing merge behavior for multi-cache rebuilds.
     * @returns {Promise<void>}
     * @private
     */
    private _reloadByModuleID;
    /**
     * Reload by API path - find affected caches, rebuild them, update impls.
     *
     * Accepts "." for base module. For other paths, the resolution order is:
     * 1. Exact cache endpoint match
     * 2. Child caches (endpoints under the path)
     * 3. Ownership history (modules that registered the exact path)
     * 4. Parent cache (most specific cache whose scope covers the path)
     *
     * @param {string} apiPath - API path or "." for base module
     * @param {Object} [options] - Optional reload options
     * @param {Object} [options.metadata] - Metadata to merge for the reloaded path after rebuild
     * @returns {Promise<void>}
     * @private
     */
    private _reloadByApiPath;
    /**
     * Find all cache entries that need to be rebuilt for a given API path.
     *
     * Resolution order:
     * 1. "." or "" or null → base module cache(s) (endpoint ".")
     * 2. Exact endpoint match → that specific cache
     * 3. Child caches → caches whose endpoint is under the given path
     * 4. Ownership history → modules that registered the exact path
     * 5. Parent cache → most specific cache whose scope covers the path
     *
     * @param {string} apiPath - The API path to find caches for
     * @returns {string[]} Array of moduleIDs to reload
     * @private
     */
    private _findAffectedCaches;
    /**
     * Collect user-set custom properties from a proxy/wrapper that are NOT in the fresh API.
     * Custom properties are those set by the user at runtime (e.g., api.custom.testFlag = true)
     * that should survive a selective reload.
     * @param {Object} existingProxy - The existing proxy/wrapper to collect from
     * @param {Object} freshApi - The fresh API from rebuild (keys to exclude)
     * @returns {Object} Map of custom property names to their values
     * @private
     */
    private _collectCustomProperties;
    /**
     * Restore previously collected custom properties onto a proxy/wrapper after reload.
     * @param {Object} proxy - The proxy to restore properties onto
     * @param {Object} customProps - Map of property names to values from _collectCustomProperties
     * @private
     */
    private _restoreCustomProperties;
    /**
     * Restore API from fresh rebuild by updating existing wrapper.
     * For non-root endpoints, updates the wrapper's implementation without replacing structure.
     * For root endpoints, merges keys directly as addApiComponent does.
     * @param {object} freshApi - Fresh API from rebuild
     * @param {string} endpoint - Original endpoint path
     * @param {string} moduleID - Module identifier
     * @param {string} collisionMode - Collision handling mode
     * @param {boolean} [forceReplace=true] - When true, temporarily overrides wrapper collision
     *   mode to "replace" so fresh impl fully replaces old. When false, preserves original
     *   collision mode for proper merge behavior in multi-cache rebuilds.
     * @returns {Promise<void>}
     * @private
     */
    private _restoreApiTree;
}
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=api-manager.d.mts.map