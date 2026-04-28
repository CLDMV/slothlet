/**
 * Resolves a value to its backing UnifiedWrapper instance.
 * Accepts a proxy registered via createProxy() or a raw UnifiedWrapper instance.
 * Returns null for any other value.
 *
 * @param {unknown} value - Value to resolve
 * @returns {UnifiedWrapper|null} The backing wrapper, or null
 *
 * @example
 * const wrapper = resolveWrapper(someProxy);
 * if (wrapper) wrapper.____slothletInternal.impl = newImpl;
 */
export function resolveWrapper(value: unknown): UnifiedWrapper | null;
export namespace TYPE_STATES {
    let UNMATERIALIZED: symbol;
    let IN_FLIGHT: symbol;
}
/**
 * Unified wrapper class that handles all proxy concerns in one place:
 * - __impl pattern for reload support
 * - Lazy/eager mode materialization
 * - Recursive waiting proxy for deep lazy loading
 * - Context binding through contextManager
 *
 * @class
 * @extends ComponentBase
 * @public
 */
export class UnifiedWrapper extends ComponentBase {

    /**
     * Shallow-clone a non-Proxy object implementation to prevent ___adoptImplChildren
     * from mutating shared module export references via its `delete this.____slothletInternal.impl[key]`
     * operations. When concurrent materializations (e.g., old + new wrapper during reload)
     * both load the same cached module, the first ___adoptImplChildren would destroy the
     * shared export, causing subsequent wrappers to receive empty objects.
     *
     * Returns the value unchanged if it is not a plain object, or if it IS a Proxy
     * (cloning a Proxy destroys its trap behavior - e.g., LG TV controllers using
     * numeric-index access through custom get traps).
     *
     * @param {*} value - The implementation value to (maybe) clone.
     * @returns {*} A shallow clone of `value` when it is a non-Proxy plain object,
     *              otherwise the original `value`.
     * @static
     * @private
     */
    private static _cloneImpl;
    /**
     * Reconstruct a full implementation object from a wrapper whose _impl may have
     * been depleted by ___adoptImplChildren.
     *
     * @description
     * After ___adoptImplChildren runs, children are moved from _impl onto the wrapper as
     * own properties and deleted from _impl. This helper reconstructs the original
     * impl by merging the remaining _impl keys with the adopted children extracted
     * from the wrapper.
     *
     * Recursively walks the wrapper tree so nested objects whose _impl was also
     * depleted are properly reconstructed. For callable (function) impls, returns
     * the function directly since keepImplProperties prevents depletion.
     *
     * @param {Object} wrapper - The UnifiedWrapper instance to extract from
     * @returns {*} The reconstructed implementation mirroring original module exports
     * @static
     * @private
     */
    private static _extractFullImpl;
    /**
     * @param {Object} slothlet - Slothlet instance (provides contextManager, instanceID, ownership)
     * @param {Object} options - Configuration options
     * @param {string} options.mode - "lazy" or "eager"
     * @param {string} options.apiPath - API path for this wrapper (e.g., "math.advanced.calc")
     * @param {Object} [options.initialImpl=null] - Initial implementation (null for lazy mode)
     * @param {Function} [options.materializeFunc=null] - Async function to materialize lazy modules
     * @param {boolean} [options.isCallable=false] - Whether the wrapper should be callable
     * @param {boolean} [options.materializeOnCreate=false] - Whether to materialize on creation
     * @param {string} [options.filePath=null] - File path of the module source
     * @param {string} [options.moduleID=null] - Module identifier
     * @param {string} [options.sourceFolder=null] - Source folder for metadata
     *
     * @description
     * Creates a unified wrapper instance for a specific API path. Extends ComponentBase
     * to access slothlet.contextManager, slothlet.instanceID, and slothlet.handlers.ownership.
     *
     * @example
     * const wrapper = new UnifiedWrapper(this.slothlet, {
     * 	mode: "lazy",
     * 	apiPath: "math",
     * 	initialImpl: null,
     * 	materializeFunc: async () => import("./math.mjs")
     * });
     */
    constructor(slothlet: Object, { mode, apiPath, initialImpl, materializeFunc, isCallable, materializeOnCreate, filePath, moduleID, sourceFolder }: {
        mode: string;
        apiPath: string;
        initialImpl?: Object | undefined;
        materializeFunc?: Function | undefined;
        isCallable?: boolean | undefined;
        materializeOnCreate?: boolean | undefined;
        filePath?: string | undefined;
        moduleID?: string | undefined;
        sourceFolder?: string | undefined;
    });
    /**
     * Internal state accessor used by framework-internal code only.
     * Backed by the private `#internal` field - prototype property, not an own property,
     * so proxy invariants never apply and getTrap can legally return undefined for it.
     *
     * Uses a private-field brand check (`#internal in this`) so the getter is safe to
     * invoke with any receiver - including `UnifiedWrapper.prototype` itself during a
     * prototype chain walk via `Object.getPrototypeOf` - without throwing a TypeError.
     * Without the brand check, `Object.getPrototypeOf(proxy).____slothletInternal` would
     * throw because the prototype object was never constructed and has no `#internal` field.
     * @returns {Object|undefined} Internal state container, or undefined for non-instances
     */
    get ____slothletInternal(): Object | undefined;
    /**
     * Get current implementation
     * @returns {Object|null} Current __impl value
     * @public
     */
    public get __impl(): Object | null;
    /**
     * Core implementation-application logic shared by ___setImpl and lazy materialization.
     * Clones the implementation (protecting the API cache from ___adoptImplChildren's
     * delete operations), clears the invalid flag, upgrades __isCallable when a
     * callable impl arrives on a configurable wrapper, updates __filePath for lazy
     * folder wrappers, and adopts children.
     *
     * @param {*} newImpl - The new implementation value.
     * @param {boolean} [forceReuseChildren=false] - When true, always reuse existing child
     *   wrappers regardless of mode (used by ___setImpl to preserve live references).
     * @private
     */
    private _applyNewImpl;
    /**
     * Set new implementation and adopt children.
     * Delegates core impl work to _applyNewImpl, then emits lifecycle events
     * and updates materialization state.
     *
     * @param {*} newImpl - New implementation
     * @param {string} [moduleID] - Optional moduleID for lifecycle event (for replacements)
     * @param {boolean} [forceReuseChildren=false] - When true, always reuse existing child
     *   wrappers and bypass collision-merged key guards. Use this for direct/explicit
     *   ___setImpl calls where reference preservation is the intent. Do NOT set for
     *   hot-reload paths (syncWrapper) where lazy refs should intentionally break.
     * @private
     */
    private ___setImpl;
    /**
     * Reset wrapper to un-materialized lazy state with a fresh materialization function.
     * Used during reload to restore lazy wrappers to their shell state instead of
     * eagerly loading all implementations. Preserves proxy identity so existing
     * references continue to work - next property access triggers materialization
     * from the fresh materializeFunc (which reads updated source files from disk).
     * @param {Function} newMaterializeFunc - Fresh materialization function from rebuild
     * @returns {void}
     * @private
     */
    private ___resetLazy;
    /**
     * Trigger materialization (lazy mode only)
     * @returns {Promise<void>}
     * @private
     */
    private ___materialize;
    /**
     * @private
     * @returns {Promise<void>}
     *
     * @description
     * Exposes lazy materialization for waiting proxies and nested wrappers.
     *
     * @example
     * await wrapper._materialize();
     */
    private _materialize;
    /**
     * @private
     * @returns {void}
     *
     * @description
     * Invalidates this wrapper when its parent removes the API path.
     *
     * @example
     * wrapper.___invalidate();
     */
    private ___invalidate;
    /**
     * @private
     * @returns {void}
     *
     * @description
     * Moves child properties off the impl and attaches them to wrapper as properties
     * so this wrapper only represents the current API path.
     *
     * @example
     * wrapper.___adoptImplChildren();
     */
    private ___adoptImplChildren;
    /**
     * @private
     * @param {string|symbol} key - Child property name
     * @param {unknown} value - Child value
     * @returns {Object|Function|undefined} Wrapped child proxy when applicable
     *
     * @description
     * Creates a child wrapper for impl values, including primitives.
     *
     * @example
     * const child = wrapper.___createChildWrapper("add", fn);
     */
    private ___createChildWrapper;
    /**
     * Create recursive waiting proxy for deep lazy loading
     * Builds property chain (e.g., ["advanced", "calc", "power"]) and waits for all parent
     * wrappers to materialize before accessing the final property.
     *
     * Waiting proxies are ONLY created when not materialized or in-flight.
     * Once materialized, we return actual cached values, not waiting proxies.
     * Therefore, waiting proxies always represent in-flight/unmaterialized state.
     *
     * CRITICAL: Caches waiting proxies by propChain key to ensure subsequent accesses
     * return the SAME proxy object, which can then delegate once materialization completes.
     * This matches v2's propertyProxyCache behavior.
     *
     * @private
     * @param {Array<string|symbol>} [propChain=[]] - Property chain to resolve.
     * @returns {Proxy} Proxy that waits for materialization before applying calls.
     */
    private ___createWaitingProxy;
    /**
     * Create main proxy for this wrapper
     * Handles lazy/eager mode logic, property access, and context binding
     *
     * @returns {Proxy} Main proxy for API
     * @public
     */
    public createProxy(): ProxyConstructor;
    lastSyncError: unknown;
    #private;
}
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=unified-wrapper.d.mts.map