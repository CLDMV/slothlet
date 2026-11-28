/**
 * Internal delimiter joining a module's id and apiPath in the composite `moduleID` metadata key
 * (`` `${moduleID}${MODULE_ID_SEPARATOR}${apiPath}` ``). Deliberately a readable, slothlet-branded
 * multi-character token rather than a lone `:` — a `:` is common in real module ids (a `vine:abc`
 * namespacing convention, the internal `versionDispatcher:<path>` id), and using it as the splitter
 * made those ids un-round-trippable. A moduleID containing this token is refused at `add()`, so the
 * composite is always unambiguous to split.
 * @type {string}
 * @internal
 */
export const MODULE_ID_SEPARATOR: string;
/**
 * Add-option key (a symbol, so no consumer option can name it) carrying the parsed `slothlet.module.json` of a package
 * mount from `modules.add` to the add that mounts it; reported as `slothlet.node(target).manifest`. Recorded with the
 * add, so a reload's replay records it again.
 * @type {symbol}
 * @internal
 */
export const MODULE_MANIFEST: symbol;
export class Metadata extends ComponentBase {
    [x: symbol]: () => Metadata;
    static slothletProperty: string;
    /**
     * Create Metadata instance
     * @param {Object} slothlet - Slothlet instance
     */
    constructor(slothlet: Object);
    /** @type {string | null} */
    _instanceId: string | null;
    /**
     * Tag system metadata (SECURE, IMMUTABLE)
     * Called internally during wrapper/function creation
     *
     * The `token` parameter must be the module-private `LIFECYCLE_TOKEN` Symbol exported
     * from `#handlers/lifecycle-token`. Because a Symbol is a unique,
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
     * The system facts slothlet recorded for a node: its file, folder, api path and owning module.
     *
     * @description
     * Looked up on the wrapper first, then on its impl (for a node whose wrapper was never tagged), the order every
     * reader uses, so set(), get() and node() always agree on which node they mean. Internal only: consumers read
     * these facts through `slothlet.node(target)`; user metadata never carries them.
     *
     * @param {Function|Object} target - Wrapper, proxy or function.
     * @returns {{filePath: string, sourceFolder: string, apiPath: string, moduleID: string, baseModuleID: string, taggedAt: number}|null}
     *   The frozen system record, or null when the target was never tagged.
     * @package
     * @example
     * metadata.getSystemMetadata(api.math.add)?.baseModuleID; // "base"
     */
    getSystemMetadata(target: Function | Object): {
        filePath: string;
        sourceFolder: string;
        apiPath: string;
        moduleID: string;
        baseModuleID: string;
        taggedAt: number;
    } | null;
    /**
     * While a full reload builds its new copy in a host with no AsyncLocalStorage, calls reach the new copy's handler,
     * and the nodes they run are the copy the instance has: this handler answers the system facts of those nodes from
     * that copy's handler until the reload ends.
     * @param {Metadata|null} handler - The handler of the copy being replaced, or null to stop.
     * @returns {void}
     * @package
     * @example
     * metadata.readThrough(previous.metadata);
     */
    readThrough(handler: Metadata | null): void;
    /**
     * The user metadata of a node: global < api path chain < the node's own.
     *
     * @description
     * Only what consumers set (through `metadata.global`, `metadata.set`, or the `metadata` option of an add). The system
     * facts slothlet records (file, folder, path, module) are never merged in; `slothlet.node(target)` reports them.
     *
     * @param {Function|Object} target - Wrapper, proxy or function.
     * @returns {Object} The merged user metadata (deeply frozen).
     * @public
     * @example
     * metadata.getMetadata(api.math.add); // { category: "math" }
     */
    public getMetadata(target: Function | Object): Object;
    /**
     * Record (or clear) the parsed `slothlet.module.json` of a package mount, reported as `node(target).manifest`.
     * @param {string} moduleID - The raw module id of the mount.
     * @param {object|null|undefined} manifest - The normalized manifest, or nothing to clear it.
     * @returns {void}
     * @package
     * @example
     * metadata.setModuleManifest("pkg-a", manifest);
     */
    setModuleManifest(moduleID: string, manifest: object | null | undefined): void;
    /**
     * The parsed `slothlet.module.json` of the package mount that owns a module id.
     * @param {string|null|undefined} moduleID - The raw module id.
     * @returns {object|undefined} The manifest, or undefined when the module is no package mount.
     * @package
     * @example
     * metadata.getModuleManifest("pkg-a")?.name; // "@acme/pkg-a"
     */
    getModuleManifest(moduleID: string | null | undefined): object | undefined;
    /**
     * Set global user metadata (applies to all functions)
     * @param {string} key - Metadata key
     * @param {unknown} value - Metadata value
     * @public
     */
    public setGlobalMetadata(key: string, value: unknown): any;
    /**
     * Add/update user metadata for specific function
     * @param {Function} target - Function to tag with metadata
     * @param {string} key - Metadata key
     * @param {unknown} value - Metadata value
     * @public
     */
    public setUserMetadata(target: Function, key: string, value: unknown): any;
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
    }): any;
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
     * earlier scalar values, while nested plain objects merge recursively.
     *
     * @param {string} identifier - Module ID or dot-notation API path
     * @param {Object} metadata - User metadata object to merge
     * @package
     */
    registerUserMetadata(identifier: string, metadata: Object): void;
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
     * Priority (lowest → highest): global → path (closer to the leaf wins) → the function's own.
     *
     * @param {string} apiPath - Dot-notation path (e.g. `"math"`, `"math.add"`)
     * @param {string|Object} keyOrObj - Key string (with `value`) OR metadata object to merge
     * @param {unknown} [value] - Value when `keyOrObj` is a string key
     * @public
     */
    public setPathMetadata(apiPath: string, keyOrObj: string | Object, value?: unknown): any;
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
    public getPathMetadata(apiPath: string): Object;
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
    public removePathMetadata(apiPath: string, key?: string | string[]): any;
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
        globalMetadata: Object;
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
        globalMetadata: Object;
        userMetadataStore: Map<any, any>;
    }): any;
    /**
     * Start keeping which user metadata is written to this handler, for a full reload that has just read its state
     * ({@link Metadata#exportUserState}) and builds its new copy while this handler keeps answering calls: what those
     * calls write is handed to the new copy at the swap ({@link Metadata#takeUserChanges}).
     * @returns {void}
     * @package
     */
    trackUserChanges(): void;
    /**
     * Stop keeping which user metadata is written here (a reload that ended without taking it).
     * @returns {void}
     * @package
     */
    endUserChanges(): void;
    /**
     * Take the user metadata written to `from` since its {@link Metadata#trackUserChanges}: each key written there has
     * here the value it has there, and one removed there is removed here. Written later than anything this handler has,
     * it wins over it. Ends `from`'s tracking.
     * @param {Metadata} from - The handler of the copy a full reload replaces.
     * @returns {void}
     * @package
     */
    takeUserChanges(from: Metadata): void;
    /**
     * The currently-executing API function, as a caller object ({ path, module, metadata, version }).
     *
     * Reads `currentWrapper` from the active context-manager store — the same
     * fast synchronous path used by the unified wrapper's `apply` trap.
     * Throws `CONTEXT_NOT_ACTIVE` when called outside of a slothlet
     * execution context.
     *
     * Called by the `api.slothlet.metadata.self()` closure injected in
     * `slothlet.injectRuntimeMetadataFunctions()`.
     *
     * @returns {{path: string[], module: string|null, metadata: object, version: object|null}} The current leaf, as a caller object
     * @public
     */
    public self(): {
        path: string[];
        module: string | null;
        metadata: object;
        version: object | null;
    };
    /**
     * The API function that called the current function, as a caller object ({ path, module, metadata, version }).
     *
     * Reads `callerWrapper` from the active context-manager store.
     * Returns `null` when there is no caller in context (e.g. the function
     * was invoked directly from outside the API).
     *
     * Called by the `api.slothlet.metadata.caller()` closure injected in
     * `slothlet.injectRuntimeMetadataFunctions()`.
     *
     * @returns {{path: string[], module: string|null, metadata: object, version: object|null}|null} The calling leaf, as a caller object, or null
     * @public
     */
    public caller(): {
        path: string[];
        module: string | null;
        metadata: object;
        version: object | null;
    } | null;
    /**
     * Resolve the wrapper of the API function that called the current function.
     *
     * The single resolution behind {@link Metadata#caller}: reads `callerWrapper` from the active
     * context-manager store. `self.slothlet.pin.caller()` pins exactly this identity, so the
     * two can never disagree about who "the caller" is.
     *
     * @returns {object|null} The calling function's wrapper, or null when there is no module caller
     *   in context (the function was invoked from the host or outside the API).
     * @public
     */
    public callerWrapper(): object | null;
    #private;
}
import { ComponentBase } from "#factories/component-base";
//# sourceMappingURL=metadata.d.mts.map