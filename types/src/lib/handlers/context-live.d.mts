/**
 * Reduce a source location — a filesystem path or a URL — to a form two spellings of the same file
 * compare equal in.
 *
 * A stack frame names a module by URL (`file:///…/x.mjs?slothlet_instance=…`, percent-encoded),
 * while a wrapper records its file and a module its root folder as whatever the loader was handed —
 * usually a plain path. The scheme, query, hash and percent-encoding are dropped from a URL,
 * separators are made forward slashes, and a trailing slash is removed, so a root compares as a
 * prefix of the files inside it.
 *
 * @param {string} value - A path or URL.
 * @returns {string} The comparable form.
 * @internal
 *
 * @example
 * toComparablePath("file:///srv/app/api/x.mjs?slothlet_instance=a"); // "/srv/app/api/x.mjs"
 * toComparablePath("C:\\app\\api\\"); // "C:/app/api"
 */
export function toComparablePath(value: string): string;
/**
 * Split one stack-trace line into the text naming the function and the location it runs at.
 *
 * Attribution must be decided by the location alone. The function name is printed first and is not
 * trustworthy — a computed method key (`{ ["/path/to/other/module.mjs"]() {} }`) puts arbitrary text,
 * including another module's path, into it. So the location is taken from where each engine puts
 * it, never searched for anywhere in the line:
 *
 * - V8: `at name (location)` — the last balanced parenthesis group — or `at [async ]location`.
 * - SpiderMonkey / JavaScriptCore: `name@location` — after the last `@` that starts a URL or path.
 *
 * The trailing `:line:column` is removed and the location reduced with {@link toComparablePath}.
 *
 * @param {string} line - One line of `Error#stack`.
 * @returns {{head: string, path: string}|null} The text before the location and the location's
 *   comparable path, or null for a line that is not a frame (the message line, an unbalanced one).
 * @internal
 *
 * @example
 * parseStackFrame("    at run (file:///srv/app/api/run.mjs?q=1:4:9)"); // { head: "at run ", path: "/srv/app/api/run.mjs" }
 * parseStackFrame("run@http://host/api/run.mjs:4:9"); // { head: "run", path: "http://host/api/run.mjs" }
 */
export function parseStackFrame(line: string): {
    head: string;
    path: string;
} | null;
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
     * directly, because that field can only name one call and is restored out of order once calls
     * overlap. In order:
     *
     * - **A synchronously entered call** — the top of the entered stack is executing now and is the
     *   answer outright, however many other calls are suspended (see {@link LiveContextManager#enteredFor}).
     * - **No call in flight** — the store's baseline: the host for an instance store, the inherited
     *   caller for a `run()`/`scope()` store.
     * - **One call suspended** — nothing else is in flight, so that call is the caller. The field is
     *   not consulted: a call that settled after the synchronous caller that started it had returned
     *   restores the field to that caller, which is then neither running nor suspended.
     * - **Two or more suspended** — the true caller is taken from the call stack. The gated access
     *   happens synchronously inside the resumed call's code, so a frame of it is on the stack;
     *   interleaving can scramble a shared field, but not the stack, since each flow has its own.
     *
     * Only the suspended calls are candidates, so when the stack names none of them the caller is not
     * one of the ambiguous calls and the baseline applies; when it names several it cannot tell apart,
     * identity is reported as unresolved so enforcement fails closed rather than guessing.
     *
     * Live runtime only. The async manager scopes identity per flow with AsyncLocalStorage and has
     * no such ambiguity.
     *
     * @param {string} [instanceID] - When provided, resolve identity from THIS instance's own store
     *   rather than from whichever instance is globally active. The manager is a singleton shared by
     *   every instance, so the global `currentInstanceID` can point at a different `slothlet()` at the
     *   moment this instance's access is enforced — either an outer leaf mid-boot of this nested
     *   instance (its base store has no caller → treated as uncalled) or a concurrent sibling that
     *   transiently overwrote the global while this instance's own call is parked at an `await` (its
     *   store still holds the in-flight caller → resolved and enforced). Scoping the store keeps both
     *   correct; a bare `currentInstanceID` read conflates them (#290). Omit for the legacy behavior.
     * @returns {{currentWrapper: object|null, callerWrapper: object, unresolved?: boolean}|undefined}
     *   Identity for the executing call, or undefined when there is no active context.
     * @public
     */
    public getCallerIdentity(instanceID?: string): {
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
     * @param {boolean} [asHost=false] - When `true`, run `fn` with **no module caller**: both
     *   `currentWrapper` and `callerWrapper` are cleared for the execution, so `fn` runs as the host
     *   (`metadata.caller()` returns null inside it). `currentWrapper` is ignored. Used by
     *   `lockCaller.caller()` when the pinned caller is the host.
     * @returns {*} Result of function execution
     * @public
     */
    public runInContext(instanceID: string, fn: Function, thisArg: any, args: any[], currentWrapper?: Object, rawErrors?: boolean, asHost?: boolean): any;
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
     *   than to the globally-active one. If the active flow belongs to this instance (base or a
     *   `run()`/`scope()` child) its store is returned; otherwise the instance has no active flow and
     *   its own base store is returned, so host-level checks (e.g. the `TRUSTED_ROOT` read-gate
     *   exemption) evaluate against the right instance instead of an unrelated ambient caller (#290).
     *   Omit for the legacy "globally-active store" behavior.
     * @returns {Object|undefined} Current context store or undefined
     * @public
     */
    public tryGetContext(instanceID?: string): Object | undefined;
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