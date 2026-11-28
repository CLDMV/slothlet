/**
 * Register reactions on a promise without pinning them to the current caller.
 *
 * For framework reactions that restore or inspect identity state themselves. A pinned reaction runs
 * inside a re-entered context, which would put back the state it was trying to change.
 *
 * @param {Promise<*>} promise - A promise, or a Proxy around one.
 * @param {Function} [onFulfilled] - Fulfillment reaction.
 * @param {Function} [onRejected] - Rejection reaction.
 * @returns {Promise<*>} The derived promise, as `then` returns it, made by slothlet (see {@link runtime_derive}).
 * @internal
 */
export function nativeThen(promise: Promise<any>, onFulfilled?: Function, onRejected?: Function): Promise<any>;
/**
 * Register reactions on a promise of the engine's own as its `then` would while this copy's patch is installed: through
 * this copy's wrapper, which pins them to the current caller (see {@link enablePromisePatching}), or the engine's `then`
 * when no patch is installed. Neither is read off the promise or `Promise.prototype`, so a `then` module code put there
 * is never called, and the promise handed back is slothlet's own, so a `constructor` or `Symbol.species` module code
 * put on `Promise.prototype` or `Promise` does not decide what it is or what it settles with (see {@link runtime_derive}).
 *
 * @param {Promise<*>} promise - A promise of the engine's own (not a Proxy).
 * @param {Function} [onFulfilled] - Fulfillment reaction.
 * @param {Function} [onRejected] - Rejection reaction.
 * @returns {Promise<*>} The derived promise.
 * @internal
 * @example
 * pinnedThen(promise, (value) => value, (error) => { throw error; });
 */
export function pinnedThen(promise: Promise<any>, onFulfilled?: Function, onRejected?: Function): Promise<any>;
/**
 * Register reactions on the promise a call returned, as {@link pinnedThen} does, pinned to who made the call rather
 * than to whoever the stack says is registering them: the runtime that ran the call already knows its caller (see
 * `pinManyForResult` in `helpers/caller-pinning`). A promise the runtime does not know is pinned as `pinnedThen` pins.
 *
 * @param {Promise<*>} promise - The promise a call returned, of the engine's own (not a Proxy).
 * @param {Function} [onFulfilled] - Fulfillment reaction.
 * @param {Function} [onRejected] - Rejection reaction.
 * @returns {Promise<*>} The derived promise.
 * @internal
 * @example
 * pinnedResultThen(result, (value) => value, (error) => { throw error; });
 */
export function pinnedResultThen(promise: Promise<any>, onFulfilled?: Function, onRejected?: Function): Promise<any>;
/**
 * The engine's `Promise.prototype.then` a function stands for: the engine's itself, or a wrapper of this copy's
 * installed over it (see {@link enablePromisePatching}). Anything else, a module's own `then` among them, is null.
 * @param {*} fn - A function read as a promise's `then`.
 * @returns {Function|null} The engine's `then`, or null.
 * @internal
 * @example
 * engineThenOf(Promise.prototype.then) === engineThenOf(Promise.resolve().then); // true
 */
export function engineThenOf(fn: any): Function | null;
/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer: string): object;
/** @type {typeof enablePromisePatching} */
declare const guarded_enablePromisePatching: typeof enablePromisePatching;
/** @type {typeof disablePromisePatching} */
declare const guarded_disablePromisePatching: typeof disablePromisePatching;
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
declare function enablePromisePatching(): void;
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
declare function disablePromisePatching(): void;
export { guarded_enablePromisePatching as enablePromisePatching, guarded_disablePromisePatching as disablePromisePatching };
//# sourceMappingURL=promise-context.d.mts.map