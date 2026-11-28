/**
 * How many settle hooks slothlet has installed on the engine to follow promises and not yet stopped, for a test that
 * checks a followed promise is let go.
 * @returns {number} The count.
 * @internal
 * @example
 * settleHookCount(); // 0 while no promise is followed
 */
export function settleHookCount(): number;
/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer: string): object;
export class LiveContextManager {
    instances: Map<any, any>;
    /**
     * Whether a flow a call starts carries that call however long it runs: not here. Once the call that started an
     * async function has returned, nothing says which call that was when the function picks up again (see
     * frameDefiner in frame-placement).
     * @type {boolean}
     * @internal
     */
    get carriesFlowCaller(): boolean;
    /**
     * The call that started the flow running now, once that call has returned: the module call the promise whose
     * reaction is running was created in, directly or in a flow it started. Null for a flow the host started, and where
     * Node's promise hooks are not available (a browser), or no live instance has permissions on.
     * @returns {{wrapper: object, ceiling?: object|ReadonlyArray<object>|null}|null} The starting call's record.
     * @internal
     */
    runningFlowStarter(): {
        wrapper: object;
        ceiling?: object | ReadonlyArray<object> | null;
    } | null;
    /**
     * How many stores have a call suspended right now, across every instance.
     * @type {number}
     * @internal
     */
    get suspendedStoreCount(): number;
    /**
     * How many calls are suspended right now, across every instance.
     * @type {number}
     * @internal
     */
    get suspendedCallCount(): number;
    public set currentInstanceID(value: string | null);
    /**
     * The instance whose flow is executing right now.
     *
     * The field behind it is one value shared by every instance and restored in settle order, so with
     * two instances in flight it can be left naming the other one — and every reader that takes no
     * instance id (the `self` and `context` bindings, the boundary pinner) would then resolve against
     * the wrong instance (#592). It is trusted while code is executing synchronously inside a call, and
     * while the only suspended calls belong to the instance it names. Otherwise the suspended calls of
     * every instance are told apart from the call stack, the same way {@link LiveContextManager#getCallerIdentity}
     * tells apart the calls of one; a stack that names none of them leaves the field's answer standing.
     *
     * Assigning sets the field directly.
     *
     * @type {string|null}
     * @public
     */
    public get currentInstanceID(): string | null;
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
     * @returns {{currentWrapper: object|null, callerWrapper: object, unresolved?: boolean, unaccounted?: boolean}|undefined}
     *   Identity for the executing call, or undefined when there is no active context.
     * @public
     */
    public getCallerIdentity(instanceID?: string): {
        currentWrapper: object | null;
        callerWrapper: object;
        unresolved?: boolean;
        unaccounted?: boolean;
    } | undefined;
    /**
     * Register the EventEmitter context checker
     * Must be called AFTER EventEmitter patching is enabled
     * @public
     */
    public registerEventEmitterContextChecker(): void;
    /**
     * Run a host-registered deferred callback as the host.
     *
     * The synchronous body runs with a host entry on every instance's stack, so any identity read inside
     * it — on whichever instance it calls into — is the host's rather than whichever call happens to be
     * suspended there. Unlike `runInContext(…, asHost)` the store's fields are left untouched: the host
     * registered it, so there is no module identity to keep alive.
     *
     * A callback that returns a promise (an async callback) resumes between its own awaits with nothing
     * entered. It needs nothing more: a suspended call is told apart from the stack, and code the stack
     * attributes to none of them, such as the resumed callback, runs as the host.
     *
     * @param {string} instanceID - Instance the callback was registered against.
     * @param {Function} fn - The callback.
     * @param {*} thisArg - `this` for the callback.
     * @param {Array} args - Arguments for the callback.
     * @returns {*} The callback's return value; its own errors propagate unchanged.
     * @public
     */
    public runRegisteredAsHost(instanceID: string, fn: Function, thisArg: any, args: any[]): any;
    /**
     * Run the load of a module file, remembered as in progress until it settles (#726): what the file's top level
     * registers meanwhile (a timer, a listener, a reaction) is pinned to the load, and runs later as the file's module.
     * The async manager carries the same identity in a store.
     *
     * @param {object} loading - The load (see createModuleLoad).
     * @param {function(): *} fn - What loads the file.
     * @returns {*} What `fn` returned.
     * @internal
     */
    runModuleLoad(loading: object, fn: () => any): any;
    /**
     * Whether nothing slothlet entered is executing on an instance's store: no call, no pin to the host, no code run as
     * no module. Code running then was started by nothing slothlet entered, so only its frames can say whose it is.
     * @param {string} instanceID - The instance.
     * @returns {boolean} True when nothing is entered.
     * @internal
     */
    isAmbient(instanceID: string): boolean;
    /**
     * The instance whose flow is running: the one slothlet entered synchronously (a call, a pinned callback, a `run()`
     * or `scope()` callback) or whose waiting call the stack shows to have picked up, or null when nothing names one.
     * The active-instance field alone does not: it keeps naming the last instance used while no flow of any runs. Code
     * of a file that carries no instance tag (a CommonJS file two instances load) is that instance's while its flow
     * runs.
     * @returns {string|null} The instance's id.
     * @internal
     * @example
     * contextManager.runningInstanceID(); // "slothlet_abc" inside one of its calls, null in the host's own flow
     */
    runningInstanceID(): string | null;
    /**
     * Run a `run()` / `scope()` callback in its store, marked on the stack as one (see {@link slothlet_liveRunBody}).
     * Where each flow is carried across its promise jobs (see {@link LiveContextManager#holdFlowHooks}) the store is the
     * active one only while the callback runs synchronously, and its own promise jobs pick up in it; code after the
     * `run()` call goes on in the flow it was in. Without promise hooks (a browser) the store stays active until the
     * callback's promise settles, so the callback's own code after a bare `await` finds it.
     * @param {string} flowID - The `run()` / `scope()` store's id.
     * @param {Function} fn - The callback.
     * @param {Array<*>} args - Its arguments.
     * @returns {Promise<*>} What it returned.
     * @internal
     */
    runFlowBody(flowID: string, fn: Function, args: Array<any>): Promise<any>;
    /**
     * Run `fn` in a flow of its own that carries `value` as the mark `key` (slothlet's marks of a reload's, a restart's
     * or a run's copy's build, and of the ID a lazy load runs under), as the async runtime carries them in an
     * `AsyncLocalStorage`. The flow is a store over the one the running code is part of (see
     * {@link LiveContextManager#runParent}): the same instance, context, `self`, caller and run, with the mark added,
     * carried as every flow of this manager is (its promise jobs, the patched schedulers, pinned listeners), so a mark
     * reaches exactly as far as a `run()`'s context does. The store leaves the instances once `fn` has settled; work it
     * left behind runs in it, as work a `run()` left behind runs in the run's (see reopenFlowStore).
     * @param {string} instanceID - The instance.
     * @param {symbol} key - The mark.
     * @param {*} value - Its value.
     * @param {function(): *} fn - What runs in the flow.
     * @returns {*} What `fn` returned.
     * @internal
     */
    runMarked(instanceID: string, key: symbol, value: any, fn: () => any): any;
    /**
     * Run a lazy node's load apart from every flow (see `runtime_loadApart` in unified-wrapper), as
     * {@link LiveContextManager#runDetached} runs code, keeping the marks the flow asking for it carries (see
     * {@link LiveContextManager#runMarked}): a load into a run's tree runs as that tree's build, with no caller, in a flow
     * over the instance's own store, as an eager tree's build does. With no mark to keep, it runs detached.
     * @param {function(): *} fn - The load.
     * @returns {*} What it returned.
     * @internal
     */
    runLoadApart(fn: () => any): any;
    /**
     * The mark `key` the flow of an instance's code running now carries (see {@link LiveContextManager#runMarked}).
     * @param {string} instanceID - The instance.
     * @param {symbol} key - The mark.
     * @returns {*} Its value, or undefined.
     * @internal
     */
    markOf(instanceID: string, key: symbol): any;
    /**
     * Give a store opened in a flow (a `run()` / `scope()`) the marks that flow carries (see
     * {@link LiveContextManager#runMarked}), as an `AsyncLocalStorage` value reaches a run opened in its flow.
     * @param {object} from - The store of the flow.
     * @param {object} to - The new store.
     * @returns {void}
     * @internal
     */
    carryMarks(from: object, to: object): void;
    /**
     * The store a new `run()` / `scope()` of an instance takes its context and caller from. The active-instance field
     * names the store of the last `run()` / `scope()` entered until it returns, so a `run()` that is still waiting at an
     * `await` would hand its context to a sibling `run()` opened meanwhile from elsewhere. That store is the parent only
     * when the code opening the new one is part of its flow: a call of the instance is executing on it, a call waiting on
     * it is the code that picked up, or a `run()` / `scope()` callback is on the stack (synchronously or at an `await`
     * further out). Otherwise the instance's own store is the parent. Where each flow is carried across its promise jobs
     * (Node) the field names the code's own flow, and is taken as it is.
     * @param {string} instanceID - The instance.
     * @returns {object|undefined} The store; undefined when the instance has none.
     * @internal
     */
    runParent(instanceID: string): object | undefined;
    /**
     * Run `fn` outside every instance (#597), as the async manager does: no instance is active while its synchronous
     * body runs, so code an instance that has shut down made reaches no instance's api through the active one.
     * @param {Function} fn - What to run.
     * @param {*} thisArg - `this` for it.
     * @param {Array} args - Its arguments.
     * @returns {*} What `fn` returned.
     * @internal
     */
    runDetached(fn: Function, thisArg: any, args: any[]): any;
    /**
     * Run `fn` attributed to no module (#597), as the async manager does: inside a module's call, neither the call nor
     * the host is executing while `fn` runs — nor, for a promise `fn` returns, until it settles — so a permission check
     * made from it fails closed instead of reading the store's emptied fields as the host. Tracked as suspended like a
     * host-pinned call, so a module call resuming meanwhile is resolved from its own stack. Outside any module's call
     * `fn` runs as it is.
     *
     * While it is suspended, code it runs is told from the host's by the stack: a stack holding the instance's code — a
     * frame of one of its modules, or of a folder being built — fails closed, and one holding none of it is the host's.
     *
     * @param {string} instanceID - Instance to run against.
     * @param {function(): *} fn - What to run.
     * @param {{slothlet?: object, roots?: Array<string>}} [building] - The instance, and the folders being built for it.
     * @returns {*} What `fn` returned.
     * @internal
     */
    runUnattributed(instanceID: string, fn: () => any, building?: {
        slothlet?: object;
        roots?: Array<string>;
    }): any;
    /**
     * Initialize context for a new instance
     * @param {string} instanceID - Unique instance identifier
     * @param {Object} config - Instance configuration
     * @param {import("#helpers/clock").Clock} [clock] - The instance's clock, which stamps the store.
     * @returns {Object} Created context store
     * @public
     */
    public initialize(instanceID: string, config?: Object, clock?: import("#helpers/clock").Clock): Object;
    /**
     * Whether a promise is one a leaf's call handed back through {@link LiveContextManager#runInContext}: slothlet made it,
     * with the `Promise` taken at load, and settles it with the leaf's own result, so a caller with no reaction to add
     * can be handed it as it is.
     * @param {*} value - The value a call returned.
     * @returns {boolean} True for such a promise.
     * @public
     */
    public ownsResult(value: any): boolean;
    /**
     * Run function with instance context active (live mode)
     * @param {string} instanceID - Instance to run in context of
     * @param {Function} fn - Function to execute
     * @param {*} thisArg - this binding for function
     * @param {Array} args - Arguments to pass to function
     * @param {Object} [currentWrapper] - Current wrapper being executed (for metadata.self())
     * @param {boolean} [rawErrors=false] - When `true`, let a non-SlothletError thrown by
     *   `fn` propagate unchanged instead of wrapping it as `CONTEXT_EXECUTION_FAILED`. Used
     *   for framework callbacks (`pin`, pinned hooks) where the caller expects the
     *   original error type/code/status.
     * @param {boolean} [asHost=false] - When `true`, run `fn` with **no module caller**: both
     *   `currentWrapper` and `callerWrapper` are cleared for the execution, so `fn` runs as the host
     *   (`metadata.caller()` returns null inside it). `currentWrapper` is ignored. Used by
     *   `pin.caller()` when the pinned caller is the host.
     * @param {object|null} [ceiling=null] - For an identity pinned from a caller-supplied-code read (#597): the
     *   call that code ran inside, which has to allow everything `currentWrapper` does here as well.
     * @param {{store: object|null, identity: object}|null} [resolved=null] - The caller identity already resolved
     *   on the store the call enters (by the permission gate), taken as the call's caller instead of reading it
     *   again. Ignored for another store.
     * @param {boolean} [attribute=false] - When `true`, a function or iterator `fn` returns (or resolves to) is handed back
     *   set up to run as `currentWrapper`'s module, whoever runs it (#597). Set for a leaf's own call.
     * @param {boolean} [madeCode=false] - When `true`, `fn` is code a module made and handed out, run as that module
     *   (#597): the call is always checked for code another module made running inside it.
     * @param {boolean} [follow=true] - When `false`, a promise `fn` returns is handed back as it is and followed without
     *   a reaction (a pinned callback's, whose rejections are reported as the callback leaves them, #597).
     * @param {object|null} [load=null] - The record of a file's load (see createModuleLoad), when `fn` is a callback the
     *   file registered while it loaded (#726).
     * @param {object|null} [loading=null] - The load itself, with `load`: what the file's own code registers in the
     *   callback is pinned to it again.
     * @returns {*} Result of function execution
     * @public
     */
    public runInContext(instanceID: string, fn: Function, thisArg: any, args: any[], currentWrapper?: Object, rawErrors?: boolean, asHost?: boolean, ceiling?: object | null, resolved?: {
        store: object | null;
        identity: object;
    } | null, attribute?: boolean, madeCode?: boolean, follow?: boolean, load?: object | null, loading?: object | null): any;
    /**
     * Capture the caller identity of the executing flow so it can be re-entered later.
     *
     * Used by around hooks: a pinned around handler runs as the module that registered it, but the
     * rest of the pipeline its `next()` runs belongs to the intercepted call, whose target must see
     * that call's own caller.
     *
     * @param {string} instanceID - Instance whose flow to capture.
     * @returns {{instanceID: string|null, store: object, currentWrapper: object|null, callerWrapper: object|null, unresolved: boolean}|null}
     *   Snapshot for {@link LiveContextManager#runInFlow}, or null when the instance has no store.
     * @public
     */
    public captureFlow(instanceID: string): {
        instanceID: string | null;
        store: object;
        currentWrapper: object | null;
        callerWrapper: object | null;
        unresolved: boolean;
    } | null;
    /**
     * Run a callback with a flow captured by {@link LiveContextManager#captureFlow} active, then put
     * back whatever was active before. Only the synchronous portion runs under the captured identity;
     * a call started inside it holds its own identity until it settles, as every live call does.
     *
     * @param {{instanceID: string|null, store: object, currentWrapper: object|null, callerWrapper: object|null, ceiling?: object|null, callerCeiling?: object|null, unresolved?: boolean}} flow - Captured flow.
     * @param {function(): *} fn - Callback to run.
     * @returns {*} The callback's return value.
     * @public
     */
    public runInFlow(flow: {
        instanceID: string | null;
        store: object;
        currentWrapper: object | null;
        callerWrapper: object | null;
        ceiling?: object | null;
        callerCeiling?: object | null;
        unresolved?: boolean;
    }, fn: () => any): any;
    /**
     * Run `fn` as a given module identity, unmarked (#597): the identity a slothlet function was read under, which it
     * keeps whoever ends up calling it. Its synchronous part runs under that identity, as {@link LiveContextManager#runInFlow}
     * runs a captured flow, on the store executing now (or the instance's base store).
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
     * The replayed store is made the active instance for the duration of `fn` — including its async
     * tail — exactly as `run()`/`scope()` do in the live runtime. The deliverer's own ambient context
     * is not merged in: the snapshot's context replaces it.
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
     * Retire the base store a full reload leaves behind when it moves the instance to a new ID. A call made before the
     * swap that is still waiting (a module's function awaiting the instance's own `reload()`) goes on in this store once
     * its `await` resumes, as the module it is, with `self` the instance's api: the store stays until the last such call
     * has settled, and is cleaned up then. With no module's call waiting it is cleaned up at once.
     * @param {string} instanceID - The ID the instance left.
     * @returns {void}
     * @public
     */
    public retire(instanceID: string): void;
    /**
     * Cleanup instance context
     * @param {string} instanceID - Instance to cleanup
     * @param {{keepFlows?: boolean}} [options] - `keepFlows`: leave the instance's run() / scope() stores in place (a
     *   reload that keeps the instance's ID makes a new base store under the same ID).
     * @public
     */
    public cleanup(instanceID: string, { keepFlows }?: {
        keepFlows?: boolean;
    }): void;
    /**
     * Diagnostics for one instance (#837): what this manager holds for that instance only, never the other instances
     * the process-wide manager also serves.
     * @param {string} instanceID - The instance.
     * @returns {{ type: "live", running: boolean, at: number|null, context: object|null, self: string[], current: { context: object, nested: boolean }|null }}
     *   The runtime word, whether code of the instance (a call, a `run()` / `scope()` callback, a load) is running now,
     *   when its record was made, its context data, the top-level names its `self` shows, and the running flow's context
     *   (and whether it is a nested run/scope).
     * @public
     */
    public getInstanceDiagnostics(instanceID: string): {
        type: "live";
        running: boolean;
        at: number | null;
        context: object | null;
        self: string[];
        current: {
            context: object;
            nested: boolean;
        } | null;
    };
    #private;
}
/**
 * A promise's record of the flow it was made in: the store id the active-instance field named, and with permissions on
 * the call it was created in, while it ran synchronously or in a flow such a promise's reaction ran: the flow's starter.
 * A promise made in a `run()` / `scope()` flow also holds that flow's store, so its jobs run in the flow after the
 * `run()` has returned, for as long as the promise lives (see {@link LiveContextManager#reopenFlowStore}).
 */
export type PromiseFlowRecord = string | null | {
    flow: string | null;
    starter: object | null;
    store?: object;
};
/**
 * The functions of the engine's promise hooks slothlet calls, as they were when slothlet loaded.
 */
export type CapturedPromiseHooks = {
    /**
     * - Installs a hook run when any promise settles; returns what stops it.
     */
    onSettled: (arg0: (arg0: Promise<any>) => void) => () => void;
    /**
     * - Installs a set of promise hooks; returns what stops them. Absent where the engine has none.
     */
    createHook?: ((arg0: object) => () => void) | undefined;
};
import { parseStackFrame } from "#handlers/frame-placement";
import { toComparablePath } from "#handlers/frame-placement";
/** @type {typeof liveContextManager} */
declare const guarded_liveContextManager: typeof liveContextManager;
/**
 * Singleton live context manager
 * @public
 */
declare const liveContextManager: LiveContextManager;
export { parseStackFrame, toComparablePath, guarded_liveContextManager as liveContextManager };
//# sourceMappingURL=context-live.d.mts.map