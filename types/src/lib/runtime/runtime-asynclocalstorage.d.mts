/**
 * Shared AsyncLocalStorage instance for all slothlet instances.
 * Provides unified context management across all EventEmitter wrappers.
 * @type {AsyncLocalStorageType}
 * @public
 */
export const sharedALS: AsyncLocalStorageType;
/**
 * Per-request AsyncLocalStorage instance for request-scoped context.
 * Stores temporary context data that merges with instance context.
 * @type {AsyncLocalStorageType}
 * @public
 */
export const requestALS: AsyncLocalStorageType;
export function runWithCtx(ctx: object, fn: Function, thisArg: any, args: any[]): any;
export function getCtx(): object | null;
export function makeWrapper(ctx: object): Function;
/**
 * @constant self
 * @memberof module:@cldmv/slothlet/runtime
 * @export module:@cldmv/slothlet/runtime
 * @public
 * @type {function|object}
 *
 * @description
 * Live binding to the current instance's 'self' reference from AsyncLocalStorage context.
 *
 * @example
 * // Access current instance self
 * console.log(self); // Current slothlet instance
 */
export const self: Function | object;
/**
 * @constant context
 * @memberof module:@cldmv/slothlet/runtime
 * @export module:@cldmv/slothlet/runtime
 * @public
 * @type {object}
 *
 * @description
 * Live binding to the current instance's 'context' data from AsyncLocalStorage context.
 *
 * @example
 * // Access current context data
 * console.log(context); // Current context object
 */
export const context: object;
/**
 * @constant reference
 * @memberof module:@cldmv/slothlet/runtime
 * @export module:@cldmv/slothlet/runtime
 * @public
 * @type {object}
 *
 * @description
 * Live binding to the current instance's 'reference' object from AsyncLocalStorage context.
 *
 * @example
 * // Access current reference object
 * console.log(reference); // Current reference data
 */
export const reference: object;
export { metadataAPI };
export type AsyncLocalStorageType = AsyncLocalStorage<any>;
import { metadataAPI } from "@cldmv/slothlet/helpers/metadata-api";
import { AsyncLocalStorage } from "node:async_hooks";
//# sourceMappingURL=runtime-asynclocalstorage.d.mts.map