/**
 * Context-aware function execution with temporary active instance override.
 * Sets the active instance based on the context before calling the function,
 * ensuring CJS runtime imports detect the correct instance.
 * @param {object} ctx - Context object containing instanceId
 * @param {Function} fn - Function to execute
 * @param {any} thisArg - The this argument
 * @param {Array} args - The function arguments
 * @returns {any} The function result
 */
export function runWithCtx(ctx: object, fn: Function, thisArg: any, args: any[]): any;
/**
 * Create a wrapper function that sets __slothletPath on API functions.
 * Required for hook pattern matching to work correctly.
 * @internal
 * @param {object} ctx - The context to bind
 * @returns {function} A wrapper function that proxies the API
 */
export function makeWrapper(ctx: object): Function;
/**
 * Legacy context management functions - kept for backwards compatibility
 * but may not be needed with instance detection approach.
 */
export function getContext(): any;
export function setContext(newContext: any): void;
/**
 * Per-request AsyncLocalStorage instance for request-scoped context.
 * Works alongside live bindings to provide per-request context isolation.
 * @type {AsyncLocalStorage}
 * @public
 */
export const requestALS: AsyncLocalStorage<any>;
/**
 * Live-binding reference to the current API instance.
 * Automatically resolves to the appropriate instance based on calling context.
 * @type {object}
 * @public
 */
export const self: object;
/**
 * Live-binding reference for contextual data.
 * Automatically resolves to the appropriate instance context.
 * @type {object}
 * @public
 */
export const context: object;
/**
 * Live-binding reference for reference data.
 * Automatically resolves to the appropriate instance reference.
 * @type {object}
 * @public
 */
export const reference: object;
/**
 * Live-binding reference to the current instance ID.
 * Automatically resolves to the current instance identifier.
 * @type {string}
 * @public
 */
export const instanceId: string;
export namespace contextManager {
    export { getContext as get };
    export { setContext as set };
    export { runWithCtx };
}
export { metadataAPI };
import { AsyncLocalStorage } from "node:async_hooks";
import { metadataAPI } from "@cldmv/slothlet/helpers/metadata-api";
//# sourceMappingURL=runtime-livebindings.d.mts.map