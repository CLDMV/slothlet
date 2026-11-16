/**
 * Live binding to the current API (self-reference). Each instance's files get the form its api root takes: an object
 * for an object root, a function for a function root (#803). This file's own binding, which a file of no instance
 * imports, is the callable form while every running instance has a function root.
 * @type {Proxy}
 * @public
 *
 * @example
 * import { self } from "@cldmv/slothlet/runtime/async";
 *
 * export function callOtherFunction() {
 *   return self.otherFunction();
 * }
 */
export let self: ProxyConstructor;
/**
 * User-provided context object
 * @type {Proxy}
 * @public
 *
 * @description
 * A proxy that provides access to user-provided context data (e.g., request data, user info).
 * Can be set via `slothlet.run()` or `slothlet.scope()`.
 *
 * @example
 * import { context } from "@cldmv/slothlet/runtime/async";
 *
 * export function getUserInfo() {
 *   // Access user-provided context
 *   return {
 *     userId: context.userId,
 *     userName: context.userName
 *   };
 * }
 */
export const context: ProxyConstructor;
/**
 * Reference to initialization reference object
 * @type {Proxy}
 * @public
 *
 * @description
 * The reference object is merged directly into the API at initialization using the add API system.
 * It is NOT available as a runtime export. Access it directly from the API or via api.slothlet.diag.reference().
 *
 * @example
 * // Reference merged into API - access directly:
 * export function useReferenceData() {
 *   return self.myData; // if reference had myData property
 * }
 */
/**
 * Current instance ID
 * @type {Proxy}
 * @public
 *
 * @description
 * A proxy that provides access to the current slothlet instance ID.
 * Useful for debugging and tracking which instance is handling a request.
 *
 * @example
 * import { instanceID } from "@cldmv/slothlet/runtime/async";
 *
 * export function getInstanceInfo() {
 *   return { instanceID };
 * }
 */
export const instanceID: ProxyConstructor;
//# sourceMappingURL=runtime-asynclocalstorage.d.mts.map