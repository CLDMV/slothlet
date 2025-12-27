/**
 * Enable AsyncLocalStorage context propagation for all EventEmitter instances.
 *
 * @function enableAlsForEventEmitters
 * @package
 * @param {AsyncLocalStorage} [als] - The AsyncLocalStorage instance to use (defaults to slothlet's shared instance)
 *
 * @description
 * Patches EventEmitter.prototype to automatically preserve AsyncLocalStorage context
 * in event listeners using AsyncResource. This ensures that event handlers maintain
 * the same context that was active when they were registered.
 *
 * Uses Node.js AsyncResource API for proper context propagation, following
 * official guidance for AsyncLocalStorage across callback boundaries.
 *
 * @example
 * // Enable ALS for all EventEmitters
 * import { enableAlsForEventEmitters } from "./als-eventemitter.mjs";
 * enableAlsForEventEmitters(als);
 */
export function enableAlsForEventEmitters(als?: AsyncLocalStorage<any>): void;
/**
 * Disable AsyncLocalStorage context propagation for EventEmitter instances.
 *
 * @function disableAlsForEventEmitters
 * @package
 *
 * @description
 * Restores original EventEmitter methods, removing the AsyncLocalStorage
 * context propagation. This should be called during cleanup to prevent
 * hanging AsyncResource instances that can keep the event loop alive.
 *
 * @example
 * // Disable ALS patching during shutdown
 * disableAlsForEventEmitters();
 */
/**
 * Clean up ALL listeners that went through slothlet's EventEmitter patching.
 *
 * @function cleanupAllSlothletListeners
 * @package
 *
 * @description
 * Removes all event listeners that were registered through slothlet's patched
 * EventEmitter methods. This includes listeners from third-party libraries
 * that got wrapped with AsyncResource instances. This nuclear cleanup option
 * should be called during shutdown to prevent hanging listeners.
 *
 * @example
 * // Clean up all patched listeners during shutdown
 * cleanupAllSlothletListeners();
 */
export function cleanupAllSlothletListeners(): void;
export function disableAlsForEventEmitters(): void;
import { AsyncLocalStorage } from "node:async_hooks";
//# sourceMappingURL=als-eventemitter.d.mts.map