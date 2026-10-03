/**
 * Manages hooks for API function interception.
 * Supports before/after/always/error/around hooks with pattern matching and priority ordering.
 *
 * @class HookManager
 * @extends ComponentBase
 */
export class HookManager extends ComponentBase {
    /**
     * Property name for auto-discovery
     * @type {string}
     * @static
     */
    static slothletProperty: string;
    /**
     * Creates a new HookManager instance.
     * @param {object} slothlet - Parent slothlet instance
     */
    constructor(slothlet: object);
    enabled: boolean;
    defaultPattern: string;
    suppressErrors: boolean;
    pinEnforced: boolean;
    enabledPatterns: Set<any>;
    patternFilterActive: boolean;
    hooks: Map<any, any>;
    registrationOrder: number;
    reportedErrors: WeakSet<object>;
    /**
     * Register a hook for API functions.
     *
     * @param {string} typePattern - Path pattern then hook type, `"pattern:type"` (e.g. `"math.*:before"`).
     *   The legacy `"type:pattern"` form (e.g. `"before:math.*"`) is still accepted but deprecated.
     * @param {function} handler - Hook handler function
     * @param {object} [options={}] - Hook options
     * @param {string} [options.id] - Unique identifier (auto-generated if not provided)
     * @param {number} [options.priority=0] - Higher = earlier execution
     * @param {string} [options.subset=DEFAULT_HOOK_SUBSET] - Phase: "before", "primary", or "after" ({@link HOOK_SUBSETS})
     * @param {boolean} [options.lockCaller=true] - Pin the registering module's caller
     *   identity onto the handler so its `self.*` calls and permission checks are
     *   attributed to the module that registered the hook, not the caller whose API
     *   call triggered it. On by default; pass `false` to opt out — the handler then
     *   runs un-pinned, with whatever async context is ambient when it fires (for a
     *   `before` hook, typically none, so a `self.*` call inside it has no context).
     *   No effect when the hook is registered outside a module (no caller identity to
     *   capture) or when `handler` is already a `lockCaller`-wrapped function.
     * @returns {string} Hook ID
     * @public
     *
     * @example
     * hookManager.on("math.*:before", ({ args }) => {
     *   console.log("Args:", args);
     *   return args;
     * }, { priority: 100 });
     */
    public on(typePattern: string, handler: Function, options?: {
        id?: string | undefined;
        priority?: number | undefined;
        subset?: string | undefined;
        lockCaller?: boolean | undefined;
    }): string;
    /**
     * Remove hooks matching filter criteria.
     *
     * @param {object} [filter={}] - Filter criteria
     * @param {string} [filter.id] - Remove hook by ID
     * @param {string} [filter.type] - Remove hooks by type
     * @param {string} [filter.pattern] - Remove hooks matching pattern
     * @returns {number} Number of hooks removed
     * @public
     */
    public remove(filter?: {
        id?: string | undefined;
        type?: string | undefined;
        pattern?: string | undefined;
    }): number;
    /**
     * Enable hooks matching filter criteria.
     *
     * @param {object|string} [filter={}] - Filter criteria (empty = enable all, string = pattern)
     * @param {string} [filter.id] - Enable hook by ID
     * @param {string} [filter.type] - Enable hooks by type
     * @param {string} [filter.pattern] - Enable hooks matching pattern
     * @returns {number} Number of hooks enabled
     * @public
     */
    public enable(filter?: object | string): number;
    /**
     * Disable hooks matching filter criteria.
     *
     * @param {object|string} [filter={}] - Filter criteria (empty = disable all, string = pattern)
     * @param {string} [filter.id] - Disable hook by ID
     * @param {string} [filter.type] - Disable hooks by type
     * @param {string} [filter.pattern] - Disable hooks matching pattern
     * @returns {number} Number of hooks disabled
     * @public
     */
    public disable(filter?: object | string): number;
    /**
     * Restrict hook execution to a path pattern at runtime (the global path filter).
     *
     * Distinct from {@link enable}/{@link disable}, which toggle the `enabled` flag of
     * individual registered hooks by their registration pattern. This narrows *which API
     * paths* the hook system applies to at all — the runtime counterpart of the `hook.pattern`
     * config. Once any pattern is enabled the filter is active, and a hook fires only when the
     * called path matches at least one enabled pattern. Adding `"**"` matches every path.
     *
     * @param {string} pattern - Glob path pattern to restrict execution to (e.g. "math.*").
     * @returns {number} The number of patterns now in the active filter.
     * @public
     *
     * @example
     * api.slothlet.hook.enablePattern("database.*"); // only intercept database.* paths
     */
    public enablePattern(pattern: string): number;
    /**
     * Remove a path pattern from the runtime global path filter.
     *
     * When the last enabled pattern is removed the filter deactivates, so hooks once again
     * apply to every path (an unrestricted state, matching a `"**"` default).
     *
     * @param {string} pattern - The previously-enabled path pattern to remove.
     * @returns {number} The number of patterns remaining in the filter.
     * @public
     *
     * @example
     * api.slothlet.hook.disablePattern("database.*"); // stop restricting to database.*
     */
    public disablePattern(pattern: string): number;
    /**
     * Reset the runtime global path filter back to the configured `hook.pattern` default.
     *
     * Clears any runtime {@link enablePattern}/{@link disablePattern} changes. If the configured
     * default is the catch-all `"**"` the filter ends up inactive (unrestricted); otherwise it is
     * re-seeded with the configured pattern.
     *
     * @returns {void}
     * @public
     */
    public resetPatternFilter(): void;
    /**
     * Set the pin-enforcement policy at runtime (backs `api.slothlet.hook.pin.enable`/`disable`).
     * When true (the default) module hooks are force-pinned to their owner; false permits a
     * per-registration `lockCaller: false`. The public wrapper is host-only when permissions are
     * enabled — `slothlet.hook.pin.*` falls under the `slothlet.hook.**` deny baseline.
     *
     * @param {boolean} value - True to enforce pinning (force-pin module hooks), false to permit unpinned.
     * @returns {boolean} The policy value now in effect.
     * @public
     */
    public setPinEnforced(value: boolean): boolean;
    /**
     * List registered hooks matching filter criteria.
     *
     * @param {object|string} [filter={}] - Filter criteria (empty = list all), type string, or pattern string
     * @param {string} [filter.id] - List hook by ID
     * @param {string} [filter.type] - List hooks by type
     * @param {string} [filter.pattern] - List hooks matching pattern
     * @param {boolean} [filter.enabled] - Filter by enabled state
     * @returns {object} Object with registeredHooks array property
     * @public
     */
    public list(filter?: object | string): object;
    /**
     * Get hooks for a specific API path and type.
     * Used internally by UnifiedWrapper.
     *
     * @param {string} type - Hook type (before/after/always/error/around)
     * @param {string} apiPath - API path (e.g., "math.add")
     * @returns {Array<object>} Sorted array of matching hooks
     * @public
     */
    public getHooksForPath(type: string, apiPath: string): Array<object>;
    /**
     * Derive the dispatch strategy for a path from the current hook set.
     *
     * @param {string} path - API path about to be called
     * @returns {{asyncBefore: boolean, asyncAfter: boolean, asyncAround: boolean, hasAround: boolean}}
     *   Whether any matching transforming hook is asynchronous, and whether the path has around hooks.
     * @public
     *
     * @description
     * The strategy is a property of the CALL, derived per invocation from the registration state —
     * never baked onto the leaf, so removing an async hook returns the path to synchronous
     * dispatch. Only TRANSFORMING hooks (before/after/around) are consulted: `always` and `error` are
     * observers whose return values are never consumed, so they never force promotion. Cached per
     * path behind the registry epoch; the hot-path cost is one integer compare.
     */
    public getDispatchStrategy(path: string): {
        asyncBefore: boolean;
        asyncAfter: boolean;
        asyncAround: boolean;
        hasAround: boolean;
    };
    /**
     * Execute before hooks for an API path.
     *
     * @param {string} path - API path being called
     * @param {Array} args - Function arguments
     * @param {object} api - Bound API object
     * @param {object} ctx - User context object
     * @param {HookErrorSink} [errorSink] - Around-pipeline error sink. When given, a failing hook is
     *   reported to it and rethrown instead of running the error hooks and honouring suppressErrors.
     * @returns {object} Result object: { args, shortCircuit, value }
     * @public
     */
    public executeBeforeHooks(path: string, args: any[], api: object, ctx: object, errorSink?: HookErrorSink): object;
    /**
     * Execute after hooks for an API path.
     *
     * @param {string} path - API path being called
     * @param {*} result - Function return value
     * @param {Array} args - Original function arguments
     * @param {object} api - Bound API object
     * @param {object} ctx - User context object
     * @param {HookErrorSink} [errorSink] - Around-pipeline error sink. When given, a failing hook is
     *   reported to it and rethrown instead of running the error hooks and honouring suppressErrors.
     * @returns {HookExecutionResult} Object indicating if result was modified and the final result
     * @public
     */
    public executeAfterHooks(path: string, result: any, args: any[], api: object, ctx: object, errorSink?: HookErrorSink): HookExecutionResult;
    /**
     * Execute before hooks asynchronously — the promoted-pipeline twin of
     * {@link executeBeforeHooks}.
     *
     * @param {string} path - API path being called
     * @param {Array} args - Function arguments
     * @param {object} api - Bound API object
     * @param {object} ctx - User context object
     * @param {HookErrorSink} [errorSink] - Around-pipeline error sink. When given, a failing hook is
     *   reported to it and rethrown instead of running the error hooks and honouring suppressErrors.
     * @returns {Promise<object>} Result object: { args, shortCircuit, value }
     * @public
     *
     * @description
     * Same protocol and strict registration order as the sync variant, with one difference: a
     * handler's thenable return is AWAITED rather than refused — the caller of a promoted path
     * already receives a Promise, so awaiting the chain changes nothing observable. A synchronous
     * handler's return is used as-is (no microtask tick is inserted for it).
     */
    public executeBeforeHooksAsync(path: string, args: any[], api: object, ctx: object, errorSink?: HookErrorSink): Promise<object>;
    /**
     * Execute after hooks asynchronously — the promoted-pipeline twin of
     * {@link executeAfterHooks}.
     *
     * @param {string} path - API path being called
     * @param {*} result - Function return value (already settled)
     * @param {Array} args - Original function arguments
     * @param {object} api - Bound API object
     * @param {object} ctx - User context object
     * @param {HookErrorSink} [errorSink] - Around-pipeline error sink. When given, a failing hook is
     *   reported to it and rethrown instead of running the error hooks and honouring suppressErrors.
     * @returns {Promise<HookExecutionResult>} Object indicating if result was modified and the final result
     * @public
     *
     * @description
     * Same protocol and ordering as the sync variant; a thenable transform is awaited (that is the
     * cell this pipeline exists for) and a synchronous transform costs no microtask tick.
     */
    public executeAfterHooksAsync(path: string, result: any, args: any[], api: object, ctx: object, errorSink?: HookErrorSink): Promise<HookExecutionResult>;
    /**
     * Run a call through its around hooks, highest priority outermost.
     *
     * @param {Array<object>} hooks - Around hooks for the path, in execution order (from {@link getHooksForPath}).
     * @param {string} path - API path being called
     * @param {Array} args - Arguments the caller passed
     * @param {object} api - Bound API object
     * @param {object} ctx - User context object
     * @param {AroundChainOptions} options - Pipeline wiring supplied by the wrapper.
     * @returns {*} The outermost around hook's return value — the call's result. A Promise when
     *   `options.isAsync` is set.
     * @public
     *
     * @description
     * Each hook receives `next(args?)`, which runs the rest of the pipeline — the remaining around
     * hooks, then `options.core` (before hooks, the function, after hooks) — and returns its result or
     * throws its error. `next()` with no argument forwards the args the hook itself received. A hook
     * that never calls `next` short-circuits: whatever it returns is the result. `next` is single-use
     * per hook invocation; a second call throws `HOOK_AROUND_NEXT_CALLED_TWICE`.
     *
     * `next()` starts the rest of the pipeline synchronously in both modes, so a hook that wraps it in
     * an `AsyncLocalStorage.run()` (or any other synchronous scope) has that scope active while the
     * target runs — including after an `await` inside the target, since async context follows the
     * target's own continuation.
     *
     * In the synchronous pipeline a handler's thenable return is refused with
     * `HOOK_AROUND_RETURNED_PROMISE` (the handler was not detected as asynchronous and did not declare
     * `{ async: true }`), except when it is the very value its own `next()` returned: that is the
     * target's own Promise (a plain function returning one) passed straight through, not something
     * the hook produced. In the asynchronous pipeline thenables are awaited.
     *
     * Failures are reported to `options.errorSink` with an `around` source and rethrown; error hooks
     * and suppression are the caller's concern, since they observe only what escapes the whole chain.
     */
    public executeAroundChain(hooks: Array<object>, path: string, args: any[], api: object, ctx: object, options: AroundChainOptions): any;
    /**
     * Execute always hooks for an API path.
     *
     * @param {string} path - API path being called
     * @param {Array} args - Function arguments
     * @param {*} resultOrError - Function result or error
     * @param {boolean} hasError - Whether an error occurred
     * @param {Array<Error>} errors - Array of errors that occurred
     * @param {object} api - Bound API object
     * @param {object} ctx - User context object
     * @public
     */
    public executeAlwaysHooks(path: string, args: any[], resultOrError: any, hasError: boolean | undefined, errors: Array<Error> | undefined, api: object, ctx: object): void;
    /**
     * Execute error hooks for an API path.
     *
     * @param {string} path - API path being called
     * @param {Error} error - The error that occurred
     * @param {object} source - Error source info with type, hookTag, hookId, timestamp, stack
     * @param {Array} args - Function arguments
     * @param {object} api - Bound API object
     * @param {object} ctx - User context object
     * @public
     */
    public executeErrorHooks(path: string, error: Error, source: object, args: any[], api: object, ctx: object): void;
    /**
     * Get the pattern compilation function for diagnostic purposes.
     * Only exposed when diagnostics mode is enabled.
     *
     * @returns {function} The pattern compilation function
     * @internal
     */
    getCompilePatternForDiagnostics(): Function;
    /**
     * Export all registered hooks (including handler closures) so they can be
     * re-registered on a fresh HookManager instance after a full reload.
     *
     * @returns {Array<object>} Snapshot of all current hook registrations.
     * @public
     */
    public exportHooks(): Array<object>;
    /**
     * Re-register hooks exported by {@link exportHooks} into this (new) instance.
     * Called after a full `api.slothlet.reload()` to restore user-registered hooks.
     *
     * @param {Array<object>} registrations - Snapshot returned by exportHooks().
     * @returns {void}
     * @public
     */
    public importHooks(registrations: Array<object>): void;
    /**
     * Cleanup hook manager on shutdown.
     * @public
     */
    public shutdown(): Promise<void>;
    #private;
}
/**
 * Result returned by hook execution methods.
 */
export type HookExecutionResult = {
    /**
     * - Whether any hook modified the result value.
     */
    modified: boolean;
    /**
     * - The final (possibly hook-modified) return value.
     */
    result?: any;
};
/**
 * Receives a failure raised inside an around pipeline together with where it came from, so the
 * pipeline can report the right source once the error escapes the around chain.
 */
export type HookErrorSink = (error: any, source: object) => void;
/**
 * The innermost stage of an around pipeline: before hooks, the target function and after hooks.
 */
export type HookAroundCore = (args: any[]) => any;
/**
 * Runs a callback with the slothlet caller identity that was active when the call entered the
 * pipeline, so a pinned around hook's `next()` does not leak the hook owner's identity into the
 * target.
 */
export type HookFlowRunner = (fn: () => any) => any;
/**
 * Options for {@link HookManager#executeAroundChain}.
 */
export type AroundChainOptions = {
    /**
     * - Innermost stage invoked by the last around hook's `next()`.
     */
    core: HookAroundCore;
    /**
     * - Whether the call runs the asynchronous pipeline.
     */
    isAsync: boolean;
    /**
     * - Calling module's metadata, or null for an entry call.
     */
    caller: object | null;
    /**
     * - True when the call has no module caller.
     */
    entry: boolean;
    /**
     * - Records where each failure originated.
     */
    errorSink: HookErrorSink;
    /**
     * - Restores the call's own identity inside a pinned hook's `next()`.
     */
    runInCallerFlow: HookFlowRunner | null;
};
import { ComponentBase } from "#factories/component-base";
//# sourceMappingURL=hook-manager.d.mts.map