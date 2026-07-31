/**
 * Live bindings context manager (direct global state)
 * Uses direct instance tracking without AsyncLocalStorage overhead.
 *
 * Concurrency boundary: the active instance is tracked in a single global field
 * ({@link LiveContextManager#currentInstanceID}), so this manager isolates *sequential*
 * `run()`/`scope()` calls (each restores the prior instance on exit) but NOT *interleaved*
 * concurrent calls on the same instance — across an `await`, a sibling `run()` overwrites the
 * global and a resumed callback reads the wrong context. True per-async-flow isolation requires
 * AsyncLocalStorage (see {@link module:@cldmv/slothlet/handlers/context-async}); the live manager
 * is the deliberate trade-off for environments without `node:async_hooks` (browser/worker, see
 * #123) and for the lowest-overhead single-flow case. See docs/CONTEXT-PROPAGATION.md.
 * @public
 */
export class LiveContextManager {
    instances: Map<any, any>;
    currentInstanceID: any;
    /**
     * Resolve the caller identity for the call that is executing right now.
     *
     * Enforcement asks for identity through here rather than reading `store.currentWrapper`
     * directly, because that field can only name one call. Two paths:
     *
     * - **At most one call suspended** — the field is necessarily that call's (or a synchronous
     *   nested call's, which set it on the way in), so it is returned as-is. This is the ordinary
     *   case and costs nothing.
     * - **Two or more suspended** — the field names whichever entered last, so a call resuming
     *   from its `await` would read another module's identity and inherit its rights. The true
     *   caller is taken from the call stack instead: the gated access happens synchronously inside
     *   the caller's own function body, so its frame is on the stack. Interleaving can scramble a
     *   shared field; it cannot scramble the stack, since each flow has its own.
     *
     * Only the suspended calls are candidates, so this never needs a global file→module index —
     * and when the stack matches none of them (or matches ambiguously), identity is reported as
     * unresolved so enforcement fails closed rather than guessing.
     *
     * Live runtime only. The async manager scopes identity per flow with AsyncLocalStorage and has
     * no such ambiguity.
     *
     * @returns {{currentWrapper: object|null, callerWrapper: object, unresolved?: boolean}|undefined}
     *   Identity for the executing call, or undefined when there is no active context.
     * @public
     */
    public getCallerIdentity(): {
        currentWrapper: object | null;
        callerWrapper: object;
        unresolved?: boolean;
    } | undefined;
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
     * Run function with instance context active (live mode)
     * @param {string} instanceID - Instance to run in context of
     * @param {Function} fn - Function to execute
     * @param {*} thisArg - this binding for function
     * @param {Array} args - Arguments to pass to function
     * @param {Object} [currentWrapper] - Current wrapper being executed (for metadata.self())
     * @param {boolean} [rawErrors=false] - When `true`, let a non-SlothletError thrown by
     *   `fn` propagate unchanged instead of wrapping it as `CONTEXT_EXECUTION_FAILED`. Used
     *   for framework callbacks (`lockCaller`, pinned hooks) where the caller expects the
     *   original error type/code/status.
     * @returns {*} Result of function execution
     * @public
     */
    public runInContext(instanceID: string, fn: Function, thisArg: any, args: any[], currentWrapper?: Object, rawErrors?: boolean): any;
    /**
     * Get current active context
     * @returns {Object} Current context store
     * @throws {SlothletError} If no active context
     * @public
     */
    public getContext(): Object;
    /**
     * Try to get context (returns undefined instead of throwing)
     * @returns {Object|undefined} Current context store or undefined
     * @public
     */
    public tryGetContext(): Object | undefined;
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
 * Singleton live context manager
 * @public
 */
export const liveContextManager: LiveContextManager;
//# sourceMappingURL=context-live.d.mts.map