/**
 * AsyncLocalStorage-based context manager for async runtime
 * Uses ALS for full context isolation across async operations
 * @public
 */
export class AsyncContextManager {
    als: any;
    instances: Map<any, any>;
    /**
     * Register the EventEmitter context checker
     * Must be called AFTER EventEmitter patching is enabled
     * @public
     */
    public registerEventEmitterContextChecker(): void;
    /**
     * Initialize context for a new instance
     * @param {string} instanceID - Unique instance identifier
     * @param {Object} config - Instance configuration
     * @returns {Object} Created context store
     * @public
     */
    public initialize(instanceID: string, config?: Object): Object;
    /**
     * Run function with instance context active
     * @param {string} instanceID - Instance to run in context of
     * @param {Function} fn - Function to execute
     * @param {*} thisArg - this binding for function
     * @param {Array} args - Arguments to pass to function
     * @param {Object} [currentWrapper] - Current wrapper being executed (for metadata.self())
     * @param {boolean} [rawErrors=false] - When `true`, let a non-SlothletError thrown by
     *   `fn` propagate unchanged instead of wrapping it as `CONTEXT_EXECUTION_FAILED`. Used
     *   for framework callbacks (`lockCaller`, pinned hooks) where the caller expects the
     *   original error type/code/status.
     * @param {boolean} [asHost=false] - When `true`, run `fn` with **no module caller**: both
     *   `currentWrapper` and `callerWrapper` are cleared for the execution, so `fn` runs as the host
     *   (`metadata.caller()` returns null inside it). `currentWrapper` is ignored. Used by
     *   `lockCaller.caller()` when the pinned caller is the host.
     * @param {object|null} [ceiling=null] - For an identity pinned from a caller-supplied-code read (#597): the
     *   call that code ran inside, which has to allow everything `currentWrapper` does here as well.
     * @param {{store: object|null, identity: object}|null} [resolved=null] - The caller identity already resolved
     *   on the store the call enters (by the permission gate), taken as the call's caller instead of reading it
     *   again. Ignored for another store.
     * @param {boolean} [attribute=false] - When `true`, a function or iterator `fn` returns (or resolves to) is handed back
     *   set up to run as `currentWrapper`'s module, whoever runs it (#597). Set for a leaf's own call.
     * @param {boolean} [madeCode=false] - When `true`, `fn` is code a module made and handed out, run as that module
     *   (#597): the call is always checked for code another module made running inside it.
     * @returns {*} Result of function execution
     * @public
     */
    public runInContext(instanceID: string, fn: Function, thisArg: any, args: any[], currentWrapper?: Object, rawErrors?: boolean, asHost?: boolean, ceiling?: object | null, resolved?: {
        store: object | null;
        identity: object;
    } | null, attribute?: boolean, madeCode?: boolean): any;
    /**
     * Capture the executing async flow's slothlet store so it can be re-entered later.
     *
     * Used by around hooks: a pinned around handler runs as the module that registered it, but the
     * rest of the pipeline its `next()` runs belongs to the intercepted call, whose target must see
     * that call's own caller.
     *
     * @returns {{store: object|undefined}} Snapshot for {@link AsyncContextManager#runInFlow}.
     * @public
     */
    public captureFlow(): {
        store: object | undefined;
    };
    /**
     * Run a callback with a flow captured by {@link AsyncContextManager#captureFlow} active. Only
     * slothlet's own AsyncLocalStorage is switched — any other async context (an application's own
     * `AsyncLocalStorage.run()` scope around `next()`) stays exactly as it is.
     *
     * @param {{store: object|undefined}} flow - Captured flow.
     * @param {function(): *} fn - Callback to run.
     * @returns {*} The callback's return value.
     * @public
     */
    public runInFlow(flow: {
        store: object | undefined;
    }, fn: () => any): any;
    /**
     * Run `fn` as a given module identity, unmarked (#597): the identity a slothlet function was read under, which it
     * keeps whoever ends up calling it. Built on the store executing now (or the instance's base store), so the call
     * keeps that flow's context; the identity is the one given, with the call it is made from as its parent.
     *
     * @param {string} instanceID - Instance to run against.
     * @param {{currentWrapper: object, ceiling?: object|ReadonlyArray<object>|null, callerWrapper?: object|null, callerCeiling?: object|ReadonlyArray<object>|null}} identity - Who runs.
     * @param {function(): *} fn - What to run.
     * @returns {*} What `fn` returned.
     * @throws {SlothletError} CONTEXT_NOT_FOUND when the instance has no store.
     * @internal
     */
    runAsIdentity(instanceID: string, identity: {
        currentWrapper: object;
        ceiling?: object | ReadonlyArray<object> | null;
        callerWrapper?: object | null;
        callerCeiling?: object | ReadonlyArray<object> | null;
    }, fn: () => any): any;
    /**
     * Run `fn` attributed to no module (#597): inside a module's call, the flow keeps its context but no module is
     * executing and it is not the host's, so a permission check made from it fails closed. Outside any module's call
     * `fn` runs as it is. Used where slothlet runs code that is no caller's — a module being built at a module's
     * request.
     *
     * @param {string} instanceID - Instance to run against.
     * @param {function(): *} fn - What to run.
     * @returns {*} What `fn` returned.
     * @internal
     */
    runUnattributed(instanceID: string, fn: () => any): any;
    /**
     * Run the load of a module file inside a store that names the file's module (#726), so what the file starts while
     * it loads (a timer, a listener, an async resource, an `AsyncLocalStorage.snapshot()`) carries the module as its
     * caller when it runs later, instead of running in no store, where it would count as the host's. The module's node
     * does not exist while the file loads and can change with a reload, so the store's identity is read from the load
     * whenever it is asked for. While there is none the store has no `self`, and its code is refused as code no one
     * accounts for.
     *
     * @param {{instanceID: function(): (string|null), wrapper: function(): (object|null), record: function(): (object|null)}} loading - The load (see createModuleLoad).
     * @param {function(): *} fn - What loads the file.
     * @returns {*} What `fn` returned.
     * @internal
     */
    runModuleLoad(loading: {
        instanceID: () => (string | null);
        wrapper: () => (object | null);
        record: () => (object | null);
    }, fn: () => any): any;
    /**
     * Whether no flow of an instance is active: no store at all, or another instance's. Code running then was started
     * by nothing slothlet entered, so only its frames can say whose it is.
     * @param {string} instanceID - The instance.
     * @returns {boolean} True when no store of the instance is active.
     * @internal
     */
    isAmbient(instanceID: string): boolean;
    /**
     * The instance whose flow is running: the one the active store belongs to (a call, a hook, a `run()` or `scope()`
     * callback, a file's load), or null when no store is active. Code of a file that carries no instance tag (a
     * CommonJS file two instances load) is that instance's while its flow runs.
     * @returns {string|null} The instance's id.
     * @internal
     * @example
     * contextManager.runningInstanceID(); // "slothlet_abc" inside one of its calls, null in the host's own flow
     */
    runningInstanceID(): string | null;
    /**
     * Run `fn` outside every instance (#597): no store is active while it runs, nor in what it schedules, so code an
     * instance that has shut down made reaches no instance's api and no module's identity.
     * @param {Function} fn - What to run.
     * @param {*} thisArg - `this` for it.
     * @param {Array} args - Its arguments.
     * @returns {*} What `fn` returned.
     * @internal
     */
    runDetached(fn: Function, thisArg: any, args: any[]): any;
    /**
     * Get current active context
     * @returns {Object} Current context store
     * @throws {SlothletError} If no active context
     * @public
     */
    public getContext(): Object;
    /**
     * Try to get context (returns undefined instead of throwing)
     *
     * @param {string} [instanceID] - When provided, resolve the store scoped to this instance rather
     *   than to the active async flow. The active ALS store is used only when it belongs to this
     *   instance (its own store or a child scope of it); otherwise this instance has no active flow
     *   and its own base store is returned, so host-level checks (e.g. the `TRUSTED_ROOT` read-gate
     *   exemption) evaluate against the right instance. AsyncLocalStorage propagates across `await`,
     *   so a leaf that boots a second `slothlet()` would otherwise carry its own store into the
     *   nested instance's construction (#290). Omit for the legacy "active flow store" behavior.
     * @returns {Object|undefined} Current context store or undefined
     * @public
     */
    public tryGetContext(instanceID?: string): Object | undefined;
    /**
     * Resolve the caller identity for the executing async flow.
     *
     * Counterpart to the live manager's accessor of the same name, so enforcement can ask for
     * identity without knowing which runtime it is on. No disambiguation is needed here:
     * `runInContext` publishes a fresh execution store into AsyncLocalStorage, so the store this
     * returns already belongs to the calling flow and cannot be another call's.
     *
     * @param {string} [instanceID] - When provided, resolve identity from THIS instance's own store
     *   rather than from the active async flow. AsyncLocalStorage propagates across `await`, so an
     *   outer leaf booting this nested instance would otherwise be seen as its caller; scoping to the
     *   instance's own store reports no caller for that nested boot (base store has none) while still
     *   returning the real caller when this instance's own flow is active (#290). Omit for the legacy
     *   "active flow caller" behavior.
     * @returns {{currentWrapper: object, callerWrapper: object, made: boolean}|undefined} Identity (`made` when the call
     *   runs code a module made and handed out), or undefined
     *   when there is no active context.
     * @public
     */
    public getCallerIdentity(instanceID?: string): {
        currentWrapper: object;
        callerWrapper: object;
        made: boolean;
    } | undefined;
    /**
     * Capture the parts of this instance's executing flow that a later, out-of-band run must
     * reproduce: the user context (`context.run()`'s), the caller identity, the owner-locked context
     * keys and whether the flow is host-trusted. Used by the event system (#497) so a deferred
     * delivery runs exactly as an immediate one would have. Holds references only — nothing is cloned
     * or serialized.
     *
     * @param {string} instanceID - Instance whose flow to capture.
     * @returns {object|null} An opaque flow snapshot for {@link runInSnapshotFlow}, or null when the
     *   instance has no context store.
     * @public
     */
    public snapshotFlow(instanceID: string): object | null;
    /**
     * Run `fn` inside a flow rebuilt from a {@link snapshotFlow} snapshot, on top of the instance's
     * CURRENT base store (so a snapshot taken before a reload runs against the reloaded instance).
     * The deliverer's own ambient context is not merged in: the snapshot's context replaces it.
     *
     * @param {string} instanceID - Instance to run against.
     * @param {object} captured - Snapshot from {@link snapshotFlow}.
     * @param {Function} fn - Function to run (may be async).
     * @returns {Promise<*>} Resolves/rejects with `fn`'s outcome.
     * @throws {SlothletError} CONTEXT_NOT_FOUND when the instance has no base store.
     * @public
     */
    public runInSnapshotFlow(instanceID: string, captured: object, fn: Function): Promise<any>;
    /**
     * Run `fn` synchronously inside a flow rebuilt from a {@link snapshotFlow} snapshot (#653), as
     * {@link runInSnapshotFlow} does for a delivery that may be async: a change made through a lazy stand-in and
     * replayed when its node loads runs in the context it was made in, and only for as long as `fn` runs.
     *
     * @param {string} instanceID - Instance to run against.
     * @param {object} captured - Snapshot from {@link snapshotFlow}.
     * @param {function(): *} fn - Synchronous function to run.
     * @returns {*} What `fn` returned.
     * @throws {SlothletError} CONTEXT_NOT_FOUND when the instance has no base store.
     * @internal
     */
    runInSnapshotFlowSync(instanceID: string, captured: object, fn: () => any): any;
    /**
     * Cleanup instance context
     * @param {string} instanceID - Instance to cleanup
     * @public
     */
    public cleanup(instanceID: string): void;
    /**
     * Get diagnostic information
     * @returns {Object} Diagnostic data
     * @public
     */
    public getDiagnostics(): Object;
    #private;
}
/**
 * Singleton async context manager
 * @public
 */
export const asyncContextManager: AsyncContextManager;
//# sourceMappingURL=context-async.d.mts.map