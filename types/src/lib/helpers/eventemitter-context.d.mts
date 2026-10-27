/**
 * Set the context checker callback
 * Called by the runtime to register a way to detect API context
 * @param {Function} checker - Function that returns true if in API context
 * @public
 */
export function setApiContextChecker(checker: Function): void;
/**
 * Enable EventEmitter context propagation by patching EventEmitter.prototype.
 * This should be called ONCE globally when the first slothlet instance is created.
 * Subsequent calls will be ignored (patching is global).
 *
 * @public
 */
export function enableEventEmitterPatching(): void;
/**
 * Disable EventEmitter context propagation and restore original methods.
 * This should only be called when ALL slothlet instances have been shut down.
 *
 * @public
 */
export function disableEventEmitterPatching(): void;
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
export function cleanupEventEmitterResources(): void;
//# sourceMappingURL=eventemitter-context.d.mts.map