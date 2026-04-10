/**
 * Metadata handler for introspection of function metadata
 * @class Metadata
 * @extends ComponentBase
 * @package
 */
export class Metadata extends ComponentBase {
    static slothletProperty: string;
    _instanceId: any;
    /**
     * Tag system metadata (SECURE, IMMUTABLE)
     * Called internally during wrapper/function creation
     *
     * The `token` parameter must be the module-private `LIFECYCLE_TOKEN` Symbol exported
     * from `@cldmv/slothlet/handlers/lifecycle-token`. Because a Symbol is a unique,
     * non-forgeable value within a Node.js process, and because the token module is not
     * listed in the package's public `exports` map, user-land code cannot construct a
     * value that satisfies the `token === LIFECYCLE_TOKEN` check without modifying the
     * source or importing an undocumented internal path.
     *
     * @param {Function|Object} target - Wrapper or function to tag
     * @param {Object} systemData - System metadata (filePath, apiPath, moduleID, sourceFolder)
     * @param {symbol} token - Must be `LIFECYCLE_TOKEN` — the unforgeable module-private Symbol
     * @private
     */
    private tagSystemMetadata;
    /**
     * Get system metadata only (without user metadata)
     * @param {Function|Object} target - Wrapper or function
     * @returns {Object|null} System metadata or null
     * @package
     */
    getSystemMetadata(target: Function | any): any | null;
    /**
     * Get metadata for a target (combines system + user)
     * For wrappers: checks current impl to ensure metadata is current
     * @param {Function|Object} target - Wrapper or function
     * @returns {Object} Combined metadata (deeply frozen)
     * @public
     */
    public getMetadata(target: Function | any): any;
    /**
     * Set global user metadata (applies to all functions)
     * @param {string} key - Metadata key
     * @param {unknown} value - Metadata value
     * @public
     */
    public setGlobalMetadata(key: string, value: unknown): void;
    /**
     * Add/update user metadata for specific function
     * @param {Function} target - Function to tag with metadata
     * @param {string} key - Metadata key
     * @param {unknown} value - Metadata value
     * @public
     */
    public setUserMetadata(target: Function, key: string, value: unknown): void;
    /**
     * Remove user metadata from specific function
     * @param {Function} target - Function to remove metadata from
     * @param {string|string[]|Object<string, string[]>} [key] - Optional key(s) to remove (removes all if omitted). Can be:
     *   - string: Remove single key
     *   - string[]: Remove multiple keys (each element must be a string)
     *   - {key: string[]}: Remove nested keys from object values
     * @public
     */
    public removeUserMetadata(target: Function, key?: string | string[] | {
        [x: string]: string[];
    }): void;
    /**
     * Register user metadata keyed by an identifier (moduleID or API path)
     *
     * @description
     * Stores user-provided metadata in `#userMetadataStore` under the given
     * `identifier`. The identifier is treated opaquely — callers pass either a
     * generated moduleID (e.g. `base_slothlet`) or a dot-notation API path
     * (e.g. `math`). `getMetadata()` retrieves entries using the same key via
     * both the moduleID lookup and `collectMetadataFromParents`, so storing
     * under a single key is sufficient for both cases.
     *
     * Multiple calls to the same identifier are merged; later calls override
     * earlier ones for conflicting keys.
     *
     * @param {string} identifier - Module ID or dot-notation API path
     * @param {Object} metadata - User metadata object to merge
     * @package
     */
    registerUserMetadata(identifier: string, metadata: any): void;
    /**
     * Remove all user metadata for an apiPath
     *
     * @description
     * Cleanup method to remove all user metadata associated with an apiPath.
     * Used during api.remove() or cleanup operations.
     *
     * @param {string} apiPath - API path to remove
     * @package
     */
    removeUserMetadataByApiPath(apiPath: string): void;
    /**
     * Set metadata for all functions reachable at an API path.
     *
     * @description
     * Stores metadata keyed by `apiPath` so that every function whose system
     * `apiPath` starts with (or equals) the given path inherits the values via
     * `collectMetadataFromParents()` in `getMetadata()`.
     *
     * Accepts either a single key/value pair or a plain object to merge.
     * Multiple calls to the same path are merged; later calls override earlier
     * ones for conflicting keys.
     *
     * Priority (lowest → highest): global → setForPath → set() → system.
     *
     * @param {string} apiPath - Dot-notation path (e.g. `"math"`, `"math.add"`)
     * @param {string|Object} keyOrObj - Key string (with `value`) OR metadata object to merge
     * @param {unknown} [value] - Value when `keyOrObj` is a string key
     * @public
     */
    public setPathMetadata(apiPath: string, keyOrObj: string | any, value?: unknown): void;
    /**
     * Get the user metadata collected from the path store for a given API path.
     *
     * @description
     * Traverses from root segment to leaf, merging parent → child metadata — the same
     * traversal used by `collectMetadataFromParents` inside `getMetadata()`. Does not
     * include immutable system metadata; only user-supplied path store entries are returned.
     *
     * @param {string} apiPath - Dot-notation API path (e.g. `"v1.auth"`, `"math"`).
     * @returns {Object} Merged user metadata for the path (not frozen).
     * @public
     * @example
     * metadata.getPathMetadata("v1.auth"); // { stable: true, category: "auth" }
     */
    public getPathMetadata(apiPath: string): any;
    /**
     * Remove metadata keys (or all metadata) for an API path.
     *
     * @description
     * Removes one specific key, multiple keys, or ALL user metadata stored under
     * the given `apiPath` key in the path store.
     * Only affects metadata set via `setForPath()` / `registerUserMetadata()` for
     * this exact path segment - it does not walk descendant paths.
     *
     * @param {string} apiPath - Dot-notation path (e.g. `"math"`, `"math.add"`)
     * @param {string|string[]} [key] - Key(s) to remove. Omit to remove all metadata for the path.
     * @public
     */
    public removePathMetadata(apiPath: string, key?: string | string[]): void;
    /**
     * Export user-managed metadata state for preservation across reload.
     *
     * @description
     * Captures `#globalUserMetadata` and all entries in `#userMetadataStore`
     * so they can be restored to a fresh Metadata instance after reload.
     * Called by `slothlet.reload()` BEFORE `load()` destroys this instance.
     *
     * @returns {{ globalMetadata: Object, userMetadataStore: Map }} Snapshot of user state
     * @package
     */
    exportUserState(): {
        globalMetadata: any;
        userMetadataStore: Map<any, any>;
    };
    /**
     * Restore user-managed metadata state after a fresh load.
     *
     * @description
     * Merges previously exported state into the new (empty) Metadata instance.
     * Called by `slothlet.reload()` AFTER `load()` creates the new instance and
     * BEFORE operation-history replay so that `registerUserMetadata()` from replay
     * can properly merge over the restored base state.
     *
     * Merge priority: existing (from load) > saved state.
     * This means replay-registered api.add metadata overrides restored values
     * for the same key, which is the desired behaviour.
     *
     * @param {{ globalMetadata: Object, userMetadataStore: Map }} state - Previously exported state
     * @package
     */
    importUserState(state: {
        globalMetadata: any;
        userMetadataStore: Map<any, any>;
    }): void;
    /**
     * Get metadata of any function by API path.
     *
     * Traverses `this.slothlet.api` using the dot-notation path, materializes
     * lazy wrappers as needed, then returns the combined metadata for the
     * resolved target via `getMetadata()`.
     *
     * Called by the `api.slothlet.metadata.get()` closure injected in
     * `slothlet.injectRuntimeMetadataFunctions()`.
     *
     * @param {string} path - Dot-notation API path (e.g. `"math.add"`)
     * @returns {Promise<object|null>} Combined metadata or null
     * @public
     */
    public get(path: string): Promise<object | null>;
    /**
     * Get metadata for the currently-executing API function.
     *
     * Reads `currentWrapper` from the active context-manager store — the same
     * fast synchronous path used by the unified wrapper's `apply` trap.
     * Throws `RUNTIME_NO_ACTIVE_CONTEXT` when called outside of a slothlet
     * execution context.
     *
     * Called by the `api.slothlet.metadata.self()` closure injected in
     * `slothlet.injectRuntimeMetadataFunctions()`.
     *
     * @returns {object} Combined metadata for the current function
     * @public
     */
    public self(): object;
    /**
     * Get metadata for the API function that called the current function.
     *
     * Reads `callerWrapper` from the active context-manager store.
     * Returns `null` when there is no caller in context (e.g. the function
     * was invoked directly from outside the API).
     *
     * Called by the `api.slothlet.metadata.caller()` closure injected in
     * `slothlet.injectRuntimeMetadataFunctions()`.
     *
     * @returns {object|null} Combined metadata for the calling function, or null
     * @public
     */
    public caller(): object | null;
    #private;
}
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=metadata.d.mts.map