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
     * @returns {*} Result of function execution
     * @public
     */
    public runInContext(instanceID: string, fn: Function, thisArg: any, args: any[], currentWrapper?: Object, rawErrors?: boolean, asHost?: boolean): any;
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
     * @returns {{currentWrapper: object, callerWrapper: object}|undefined} Identity, or undefined
     *   when there is no active context.
     * @public
     */
    public getCallerIdentity(instanceID?: string): {
        currentWrapper: object;
        callerWrapper: object;
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