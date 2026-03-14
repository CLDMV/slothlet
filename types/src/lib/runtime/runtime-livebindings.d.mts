/**
 * Live binding to the current API (self-reference)
 * @type {Proxy}
 * @public
 *
 * @description
 * A proxy that provides direct access to the current instance's API.
 * In live mode, this directly references the active instance without AsyncLocalStorage.
 *
 * @example
 * import { self } from "@cldmv/slothlet/runtime/live";
 *
 * export function callOtherFunction() {
 *   return self.otherFunction();
 * }
 */
export const self: ProxyConstructor;
/**
 * User-provided context object
 * @type {Proxy}
 * @public
 *
 * @description
 * A proxy that provides access to user-provided context data.
 * In live mode, this directly accesses the current instance's context.
 *
 * @example
 * import { context } from "@cldmv/slothlet/runtime/live";
 *
 * export function getUserInfo() {
 *   return {
 *     userId: context.userId,
 *     userName: context.userName
 *   };
 * }
 */
export const context: ProxyConstructor;
//# sourceMappingURL=runtime-livebindings.d.mts.map