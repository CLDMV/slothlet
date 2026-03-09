/**
 * Live binding to the current API (self-reference)
 * @type {Proxy}
 * @public
 *
 * @description
 * A proxy that provides access to the full API object within the current context.
 * Automatically resolves to the correct instance's API in AsyncLocalStorage context.
 *
 * @example
 * import { self } from "@cldmv/slothlet/runtime/async";
 *
 * export function callOtherFunction() {
 *   // Call another function in the same API
 *   return self.otherFunction();
 * }
 */
export const self: ProxyConstructor;
/**
 * User-provided context object
 * @type {Proxy} * @public
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