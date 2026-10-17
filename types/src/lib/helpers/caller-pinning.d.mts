/**
 * Register the strategy for binding a callback to whoever scheduled it.
 *
 * @param {Function|null} strategy - Takes a callback and returns a replacement that re-enters the
 *   registering module's context when it runs. `null` clears the registration.
 * @returns {void}
 * @internal
 */
export function setApiCallerPinner(strategy: Function | null): void;
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
//# sourceMappingURL=caller-pinning.d.mts.map