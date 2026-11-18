/**
 * Bind a callback to the caller active right now, if the runtime supplies a way to.
 *
 * Called by each scheduling boundary at registration time. Returns the callback unchanged when no
 * pinner is registered (the async runtime) or when there is no caller to pin (the host scheduling
 * its own work), so the boundary pays nothing outside a module call.
 *
 * @param {Function} callback - Callback about to be deferred.
 * @returns {Function} The callback, bound to the current caller where one exists.
 * @internal
 */
export function pinToCurrentCaller(callback: Function): Function;
/**
 * Bind a callback to the caller and flow active right now, after one quick check that there is any: outside every
 * `run()` / `scope()` flow and every module call the callback is handed back as it is, as it would run the same either
 * way. For a boundary that sees many calls from host code (Node's callback-style APIs, see
 * `helpers/node-callback-context`). A strategy that offers no `idle` check pins as {@link pinToCurrentCaller} does.
 *
 * @param {Function} callback - Callback about to be deferred.
 * @returns {Function} The callback, bound to the current caller and flow where there is one.
 * @internal
 */
export function pinToCurrentFlow(callback: Function): Function;
/**
 * Bind a callback that runs code in a resource's scope (what an `AsyncResource`, a snapshot or a bound function runs
 * later) to the caller active right now. Whoever holds the resource chooses the code, so the strategy tells it by its
 * frames when it runs: the code of the caller it was pinned to keeps the pin, anyone else's runs as whatever was running
 * where the resource was used. A strategy that offers no `scope` form pins it as any callback.
 *
 * @param {Function} callback - The callback.
 * @returns {Function} The callback, bound to the current caller where one exists.
 * @internal
 */
export function pinScopeToCurrentCaller(callback: Function): Function;
/**
 * Bind several callbacks registered at the same moment to the caller active right now, resolving that
 * caller once for all of them — a promise reaction's two callbacks, say. A strategy that offers no
 * `many` form pins each one in turn.
 *
 * @param {Array<*>} callbacks - Callbacks about to be deferred; anything that is not a function is
 *   handed back as it is.
 * @returns {Array<*>} The callbacks, bound to the current caller where one exists.
 * @internal
 */
export function pinManyToCurrentCaller(callbacks: Array<any>): Array<any>;
/**
 * Pin the reactions registered on the promise a call returned to who made the call, when the runtime knows it (a
 * strategy's `forResult`), instead of resolving who is registering them now; otherwise as
 * {@link pinManyToCurrentCaller} pins them.
 * @param {Promise<*>} result - The promise the call returned.
 * @param {Array<Function|undefined>} callbacks - The reactions.
 * @returns {Array<Function|undefined>} Each reaction, pinned where there is a caller to pin it to.
 * @internal
 * @example
 * const [fulfilled, rejected] = pinManyForResult(result, [onFulfilled, onRejected]);
 */
export function pinManyForResult(result: Promise<any>, callbacks: Array<Function | undefined>): Array<Function | undefined>;
/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer: string): object;
export { guarded_setApiCallerPinner as setApiCallerPinner };
/** @type {typeof setApiCallerPinner} */
declare const guarded_setApiCallerPinner: typeof setApiCallerPinner;
/**
 * Register the strategy for binding a callback to whoever scheduled it.
 *
 * @param {Function|null} strategy - Takes a callback and returns a replacement that re-enters the
 *   registering module's context when it runs. `null` clears the registration.
 * @returns {void}
 * @internal
 */
declare function setApiCallerPinner(strategy: Function | null): void;
//# sourceMappingURL=caller-pinning.d.mts.map