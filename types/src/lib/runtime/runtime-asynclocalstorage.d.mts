/**
 * Cleanup ALS runtime state for an instance.
 * @param {string} instanceId - Instance ID to clean up
 * @memberof module:@cldmv/slothlet.runtime
 * @package
 */
export function cleanup(instanceId: string): void;
/**
 * Create a per-instance AsyncLocalStorage runtime facade.
 * @param {{ instanceId?: string, als?: AsyncLocalStorage }} params - Instance configuration.
 * @returns {{ runWithCtx: typeof runWithCtx, makeWrapper: typeof makeWrapper, getCtx: typeof getCtx, self: typeof self, context: typeof context, reference: typeof reference, sharedALS: AsyncLocalStorage, requestALS: AsyncLocalStorage, metadataAPI: typeof metadataAPI, cleanup: Function }} Runtime API bound to the provided instance ALS.
 * @example
 * const runtime = createAsyncRuntime({ instanceId: "abc", als: new AsyncLocalStorage() });
 * runtime.runWithCtx({ self: {}, context: {}, reference: {} }, fn, thisArg, args);
 * // Later, clean up:
 * runtime.cleanup();
 */
export function createAsyncRuntime({ instanceId, als }?: {
    instanceId?: string;
    als?: AsyncLocalStorage<any>;
}): {
    runWithCtx: typeof runWithCtx;
    makeWrapper: typeof makeWrapper;
    getCtx: typeof getCtx;
    self: typeof self;
    context: typeof context;
    reference: typeof reference;
    sharedALS: AsyncLocalStorage<any>;
    requestALS: AsyncLocalStorage<any>;
    metadataAPI: typeof metadataAPI;
    cleanup: Function;
};
export namespace sharedALS {
    function run(...args: any[]): any;
    function getStore(): any;
    function disable(): any;
}
export namespace requestALS {
    export function run_1(...args: any[]): any;
    export { run_1 as run };
    export function getStore_1(): any;
    export { getStore_1 as getStore };
    export function disable_1(): any;
    export { disable_1 as disable };
}
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
import { AsyncLocalStorage } from "node:async_hooks";
import { metadataAPI } from "@cldmv/slothlet/helpers/metadata-api";
//# sourceMappingURL=runtime-asynclocalstorage.d.mts.map