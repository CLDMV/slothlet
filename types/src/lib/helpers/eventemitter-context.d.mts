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
 * Cleanup all tracked EventEmitters created within slothlet API context.
 * This removes all listeners from tracked emitters and clears tracking structures.
 * Should be called during shutdown to prevent memory leaks and hanging processes.
 *
 * @public
 */
export function cleanupEventEmitterResources(): void;
//# sourceMappingURL=eventemitter-context.d.mts.map