/**
 * Register reactions on a promise without pinning them to the current caller.
 *
 * For framework reactions that restore or inspect identity state themselves. A pinned reaction runs
 * inside a re-entered context, which would put back the state it was trying to change.
 *
 * @param {Promise<*>} promise - A promise, or a Proxy around one.
 * @param {Function} [onFulfilled] - Fulfillment reaction.
 * @param {Function} [onRejected] - Rejection reaction.
 * @returns {Promise<*>} The derived promise, as `then` returns it.
 * @internal
 */
export function nativeThen(promise: Promise<any>, onFulfilled?: Function, onRejected?: Function): Promise<any>;
/**
 * Pin promise reactions to the module that registers them.
 *
 * Called once globally when the first instance is created; later calls are ignored, matching the other
 * boundary patches. Costs one check per registration when no runtime registered a pinning strategy —
 * the reactions are handed straight through.
 *
 * @returns {void}
 * @public
 */
export function enablePromisePatching(): void;
/**
 * Restore the original `Promise.prototype.then`.
 *
 * Restores it only when the wrapper installed here is still in place, so anything that replaced it
 * afterwards keeps ownership of its own restore. Otherwise the wrapper is left where it is, passing
 * through. A restore puts back what is underneath every such wrapper, so copies of slothlet that
 * unpatch out of order still end with the engine's `then` installed.
 *
 * @returns {void}
 * @public
 */
export function disablePromisePatching(): void;
//# sourceMappingURL=promise-context.d.mts.map