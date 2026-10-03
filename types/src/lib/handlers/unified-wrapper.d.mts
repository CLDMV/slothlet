/**
 * Whether a property name belongs to the framework rather than to a module's exports.
 *
 * @param {string|symbol} key - Property name to classify.
 * @returns {boolean} True when the name is reserved by the framework.
 * @public
 *
 * @description
 * Matched against the framework's own reserved names — `INTERNAL_KEYS` (wrapper state and control
 * props) plus {@link IMPL_METADATA_KEYS} — never by underscore prefix. The documented hidden-entry
 * rule (docs/MODULE-STRUCTURE.md) hides `.`/`__`-prefixed FILES and FOLDERS; it says nothing about
 * export names, and a module that writes `export const __priv` has deliberately put that member on
 * its surface. Treating the prefix as internal silently dropped such exports from the composed api
 * in lazy mode while eager served them.
 *
 * @example
 * isFrameworkReservedKey("__childFilePaths"); // true
 * isFrameworkReservedKey("__priv"); // false — a module's own export
 */
export function isFrameworkReservedKey(key: string | symbol): boolean;
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
/**
 * Framework metadata that rides on a module implementation but is not an api member.
 *
 * Matched by EXACT name rather than an `__` prefix: a user module may legitimately export an
 * underscore-prefixed member, and dropping those would make the composed surface lie. Shared so
 * enumeration and the collision-merge paths filter exactly the same set.
 * @type {Set<string>}
 * @public
 */
export const IMPL_METADATA_KEYS: Set<string>;
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
     * Whether an impl makes its wrapper callable: a function, or an object with a default-exported
     * function.
     * @param {*} impl - The impl.
     * @returns {boolean} True for a callable impl.
     * @private
     *
     * @example
     * UnifiedWrapper._isCallableImpl({ default() {} }); // true
     */
    private static _isCallableImpl;
    /**
     * @param {Object} slothlet - Slothlet instance (provides contextManager, instanceID, ownership)
     * @param {Object} options - Configuration options
     * @param {string} options.mode - "lazy" or "eager"
     * @param {string} options.apiPath - API path for this wrapper (e.g., "math.advanced.calc")
     * @param {Function|Object|null} [options.initialImpl=null] - Initial implementation (null for lazy mode)
     * @param {Function} [options.materializeFunc=null] - Async function to materialize lazy modules
     * @param {boolean} [options.isCallable=false] - Whether the wrapper should be callable
     * @param {boolean} [options.materializeOnCreate=false] - Whether to materialize on creation
     * @param {string} [options.filePath=null] - File path of the module source
     * @param {string[]|null} [options.exportPath] - Access path within `filePath`'s module namespace
     *   that produced `initialImpl` (#484). When omitted it is looked up from the ownership export index
     *   by `initialImpl`'s identity; `null` records "no module origin".
     * @param {string} [options.moduleID=null] - Module identifier
     * @param {string} [options.sourceFolder=null] - Source folder for metadata
     * @param {WeakSet<object>|null} [options.__adoptVisited=null] - Internal: one-shot cycle-guard set
     *   threaded through the eager child-adoption recursion so a self-referential value cannot recurse
     *   forever (#330). Set only on nested wrappers built during a single adopt traversal; null for a
     *   normal (root / reload) construction.
     * @param {boolean} [options.deferChildAdopt=false] - Internal: defer eager child adoption to first
     *   getTrap access (and propagate the deferral to descendants). Used for wrap-on-set of a
     *   user-assigned object so an arbitrarily deep runtime-grafted chain is wrapped one level per
     *   access instead of recursing synchronously through every level at assignment and overflowing
     *   the stack (#329 / #247 unbounded depth).
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
    constructor(slothlet: Object, { mode, apiPath, initialImpl, materializeFunc, isCallable, materializeOnCreate, filePath, exportPath, moduleID, sourceFolder, __adoptVisited, deferChildAdopt }: {
        mode: string;
        apiPath: string;
        initialImpl?: Object | Function | null | undefined;
        materializeFunc?: Function | undefined;
        isCallable?: boolean | undefined;
        materializeOnCreate?: boolean | undefined;
        filePath?: string | undefined;
        exportPath?: string[] | null | undefined;
        moduleID?: string | undefined;
        sourceFolder?: string | undefined;
        __adoptVisited?: WeakSet<object> | null | undefined;
        deferChildAdopt?: boolean | undefined;
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
     * @returns {Record<string, any>|undefined} Internal state container, or undefined for non-instances
     */
    get ____slothletInternal(): Record<string, any> | undefined;
    /**
     * Custom inspect output for Node.js `util.inspect`.
     *
     * Defined as an ordinary named method and wired to the `util.inspect.custom`
     * symbol via a prototype assignment after the class. A computed
     * `[util.inspect.custom]` member in the class body makes tsc emit a spurious
     * numeric index signature (`[x: number]`) into the generated `.d.mts`; an
     * ordinary named method emits cleanly instead.
     * @returns {*} The actual implementation for inspection.
     * @internal
     */
    ____inspectCustom(____depth: any, ____options: any, ____inspect: any): any;
    /**
     * Get current implementation
     * @returns {Function|Object|null} Current __impl value
     * @public
     */
    public get __impl(): Function | Object | null;
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
     * Give a namespace the function a later contribution supplies, keeping its children (#533).
     *
     * @description
     * A merge (`merge` / `merge-replace`) keeps the existing node and only adds the incoming children,
     * so the incoming module's own function was dropped and a namespace created by an earlier module
     * could never become callable. The function is resolved like any other merged member: a namespace
     * with no function yet always takes it; one that already has a function keeps it under `merge`
     * (first writer wins) and takes the incoming one under `merge-replace` (incoming wins). The children
     * are untouched: the incoming impl's own members were already adopted into child wrappers, which the
     * caller merges separately.
     *
     * @param {*} impl - The incoming contribution's impl at this node.
     * @param {boolean} [replaceExisting=false] - True under `merge-replace`: the incoming function
     *   replaces an existing one.
     * @returns {boolean} True when the namespace took the function.
     * @private
     *
     * @example
     * existingWrapper.___adoptCallableImpl(nextWrapper.____slothletInternal.impl, collisionMode === "merge-replace");
     */
    private ___adoptCallableImpl;
    /**
     * Replace this wrapper's non-callable proxy with a callable one (#533).
     *
     * @description
     * A Proxy's callability is fixed when it is created, and a namespace that started non-callable
     * uses the wrapper itself as its target (so `typeof` reads "object"). When a function arrives, a new
     * proxy is built from the same handler on a function target, registered for this wrapper, and
     * installed in the parent in place of the old one, so `api.<path>` is callable from then on. The
     * old proxy's traps are re-pointed at the new proxy (the same forwarding restart() gives a held
     * reference, #504), so a reference held from before keeps reading, enumerating and writing through
     * to the live namespace — but stays non-callable itself and keeps `typeof` "object".
     *
     * The upgrade is one-way: when the function later goes away (a remove or a reload), the callable
     * proxy stays and a call throws `INVALID_CONFIG_NOT_A_FUNCTION`, the same as for a namespace that
     * was callable from the start.
     *
     * @returns {void}
     * @private
     *
     * @example
     * if (internal.proxyTraps !== null) wrapper.___upgradeToCallableProxy();
     */
    private ___upgradeToCallableProxy;
    /**
     * Swap the proxy the parent node holds for this wrapper at its apiPath (#533).
     *
     * @description
     * Walks the live api tree from the root along `apiPath` through raw wrappers' own properties (no
     * proxy traps, so nothing materializes) and replaces the child only where it is exactly `oldProxy`,
     * keeping its property descriptor (children are defined configurable). `boundApi`/`self` forward to
     * the same root, so one swap covers them. When the path no longer leads to `oldProxy` (the node was
     * detached or replaced), nothing changes; the old proxy forwards to the new one regardless.
     *
     * @param {object} oldProxy - The proxy being replaced.
     * @param {object} newProxy - Its replacement.
     * @returns {void}
     * @private
     *
     * @example
     * wrapper.___replaceInParent(oldProxy, newProxy);
     */
    private ___replaceInParent;
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
     * @param {boolean} [attributeChildren=false] - When true, the children this call adopts (new ones and
     *   reused ones, all the way down) belong to `moduleID` rather than to this wrapper's own module. A
     *   reload passes it when it rebuilds one module's contribution to a namespace that another module
     *   created, so the rebuilt leaves stay attributed to the module that exports them (#525).
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
     * Whether the value at `key` on this wrapper was assigned by the user rather than adopted from a
     * module's impl (#543).
     * @param {string} key - Own child key.
     * @returns {boolean} True for a key assigned through the proxy outside a build (any value kind), or
     *   holding a wrap-on-set `userAssigned` wrapper.
     * @private
     */
    private ___isUserAssignedKey;
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
     * @param {WeakSet<object>|null} [visited=null] - Cycle-guard set threaded through an eager adopt
     *   traversal so a self-referential value cannot recurse forever (#330); null outside a traversal.
     * @param {boolean} [deferChildAdopt=false] - Defer the child's own eager adoption to first getTrap
     *   access, so a deep wrap-on-set graft is wrapped one level per access instead of recursively (#329).
     * @returns {Object|Function|null|undefined} Wrapped child proxy, or null/undefined when the value is
     *   stored unwrapped (opaque built-ins, null, cycle bail-out) or is undefined.
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
    #private;
}
import { ComponentBase } from "#factories/component-base";
//# sourceMappingURL=unified-wrapper.d.mts.map