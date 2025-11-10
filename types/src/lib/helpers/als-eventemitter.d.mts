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
import { AsyncLocalStorage } from "node:async_hooks";
//# sourceMappingURL=als-eventemitter.d.mts.map