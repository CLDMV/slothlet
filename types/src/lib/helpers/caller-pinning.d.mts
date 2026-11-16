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