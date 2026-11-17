/**
 * Live binding to the current API (self-reference). In live mode, this directly references the active instance
 * without AsyncLocalStorage. Each instance's files get the form its api root takes: an object for an object root, a
 * function for a function root (#803). This file's own binding, which a file of no instance imports (a browser's
 * leaves among them), is the callable form while every running instance has a function root.
 * @type {Proxy}
 * @public
 *
 * @example
 * import { self } from "@cldmv/slothlet/runtime/live";
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
/**
 * Read-only facts about the running slothlet instance, as the async runtime's `instance` gives them.
 * @type {{readonly id: (string|undefined)}}
 * @public
 *
 * @description
 * `instance.id` is the id of the instance whose call is running, read at access: a real string inside a call (so
 * `instance.id === "slothlet_…"` holds), undefined outside one.
 *
 * @example
 * import { instance } from "@cldmv/slothlet/runtime/live";
 *
 * export function getInstanceInfo() {
 *   return { id: instance.id };
 * }
 */
export const instance: {
    readonly id: (string | undefined);
};
//# sourceMappingURL=runtime-livebindings.d.mts.map