/**
 * Live binding to the current API instance. Resolves to the running Slothlet proxy,
 * giving API modules access to all other API methods without import cycles.
 *
 * @memberof module:@cldmv/slothlet/runtime
 * @type {object}
 * @example
 * import { self } from "@cldmv/slothlet/runtime";
 * // Inside an API function:
 * const result = await self.math.add(1, 2);
 */
export const self: object;
/**
 * The current ambient context object. Seeded at instance startup via `config.context` and
 * persists for the lifetime of the instance. `api.slothlet.context.run()` and `.scope()` can
 * temporarily override it for the duration of a single call, after which the previous context
 * is restored. Readable and writable.
 *
 * @memberof module:@cldmv/slothlet/runtime
 * @type {object}
 * @example
 * import { context } from "@cldmv/slothlet/runtime";
 * // Read the ambient context set via config.context or written by a previous call:
 * const userId = context.userId;
 * // context.run() overrides it only for the duration of that one call:
 * await api.slothlet.context.run({ userId: 42 }, myFn);
 */
export const context: object;
/**
 * Current Slothlet instance identifier. Unique per `slothlet()` call; useful when
 * multiple Slothlet instances coexist and you need to identify which one is active.
 *
 * @memberof module:@cldmv/slothlet/runtime
 * @type {string}
 * @example
 * import { instanceID } from "@cldmv/slothlet/runtime";
 * console.log(instanceID); // e.g. "slothlet-1"
 */
export const instanceID: string;
//# sourceMappingURL=runtime.d.mts.map