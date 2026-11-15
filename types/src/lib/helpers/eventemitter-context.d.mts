/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer: string): object;
/** @type {typeof setApiContextChecker} */
declare const guarded_setApiContextChecker: typeof setApiContextChecker;
/** @type {typeof enableEventEmitterPatching} */
declare const guarded_enableEventEmitterPatching: typeof enableEventEmitterPatching;
/** @type {typeof disableEventEmitterPatching} */
declare const guarded_disableEventEmitterPatching: typeof disableEventEmitterPatching;
/** @type {typeof cleanupEventEmitterResources} */
declare const guarded_cleanupEventEmitterResources: typeof cleanupEventEmitterResources;
/**
 * Set the context checker callback
 * Called by the runtime to register a way to detect API context
 * @param {Function} checker - Function that returns true if in API context
 * @public
 */
declare function setApiContextChecker(checker: Function): void;
/**
 * Enable EventEmitter context propagation by patching EventEmitter.prototype.
 * This should be called ONCE globally when the first slothlet instance is created.
 * Subsequent calls will be ignored (patching is global).
 *
 * @public
 */
declare function enableEventEmitterPatching(): void;
/**
 * Disable EventEmitter context propagation and restore original methods.
 * This should only be called when ALL slothlet instances have been shut down.
 *
 * @public
 */
declare function disableEventEmitterPatching(): void;
/**
 * Release the EventEmitter state slothlet holds, when the last instance shuts down (#605).
 *
 * No listener is removed: an emitter a module created can outlive slothlet (undici keeps a `fetch`
 * socket in its keep-alive pool and later destroys it with an error), and the listeners on it belong to
 * the code that registered them. Every listener wrapper is released, so one firing later calls its
 * listener directly, with no instance context. On each tracked emitter, a wrapper registered with
 * `on` / `prependListener` is swapped in place for the function the code registered, and a `once` /
 * `prependOnceListener` wrapper for a plain one-shot wrapper with no slothlet state, which reports its
 * listener through `.listener` as Node's own does. The emitter then holds what it would without
 * slothlet. The swap edits the listener table directly, so no `removeListener` / `newListener` event
 * fires; a table the emitter keeps read-only is left as it is, its wrappers released. Every wrapper
 * drops its captured context (its AsyncResource and pinned caller) first, so one left on such a table
 * keeps no instance alive.
 *
 * @public
 */
declare function cleanupEventEmitterResources(): void;
export { guarded_setApiContextChecker as setApiContextChecker, guarded_enableEventEmitterPatching as enableEventEmitterPatching, guarded_disableEventEmitterPatching as disableEventEmitterPatching, guarded_cleanupEventEmitterResources as cleanupEventEmitterResources };
//# sourceMappingURL=eventemitter-context.d.mts.map