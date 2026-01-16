/**
 * @fileoverview AsyncLocalStorage runtime - exports self, context, reference for API modules
 * @module @cldmv/slothlet/runtime/async
 * @public
 *
 * @description
 * Provides live bindings (`self`, `context`, `reference`) for use in API modules.
 * Uses AsyncLocalStorage for context isolation across async operations.
 *
 * @example
 * // In your API module (ESM)
 * import { self, context } from "@cldmv/slothlet/runtime/async";
 *
 * export function myFunction() {
 *   // `self` is the full API object
 *   // `context` is user-provided context data
 *   return { api: self, data: context.userId };
 * }
 *
 * @example
 * // In your API module (CJS)
 * const { self, context } = require("@cldmv/slothlet/runtime/async");
 *
 * exports.myFunction = function() {
 *   return { api: self, data: context.userId };
 * };
 */

import { asyncRuntime } from "@cldmv/slothlet/handlers/context";

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
export const self = new Proxy(
	{},
	{
		get(_, prop) {
			const ctx = asyncRuntime.getContext();
			if (!ctx || !ctx.self) {
				throw new Error("No active context - self can only be accessed within slothlet API calls");
			}
			return ctx.self[prop];
		},
		ownKeys() {
			const ctx = asyncRuntime.getContext();
			if (!ctx || !ctx.self) return [];
			return Reflect.ownKeys(ctx.self);
		},
		has(_, prop) {
			const ctx = asyncRuntime.getContext();
			if (!ctx || !ctx.self) return false;
			return prop in ctx.self;
		},
		getOwnPropertyDescriptor(_, prop) {
			const ctx = asyncRuntime.getContext();
			if (!ctx || !ctx.self) return undefined;
			return Reflect.getOwnPropertyDescriptor(ctx.self, prop);
		}
	}
);

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
export const context = new Proxy(
	{},
	{
		get(_, prop) {
			const ctx = asyncRuntime.getContext();
			if (!ctx || !ctx.context) {
				return undefined;
			}
			return ctx.context[prop];
		},
		set(_, prop, value) {
			const ctx = asyncRuntime.getContext();
			if (!ctx || !ctx.context) {
				throw new Error("No active context - context can only be modified within slothlet API calls");
			}
			ctx.context[prop] = value;
			return true;
		},
		ownKeys() {
			const ctx = asyncRuntime.getContext();
			if (!ctx || !ctx.context) return [];
			return Reflect.ownKeys(ctx.context);
		},
		has(_, prop) {
			const ctx = asyncRuntime.getContext();
			if (!ctx || !ctx.context) return false;
			return prop in ctx.context;
		},
		getOwnPropertyDescriptor(_, prop) {
			const ctx = asyncRuntime.getContext();
			if (!ctx || !ctx.context) return undefined;
			return Reflect.getOwnPropertyDescriptor(ctx.context, prop);
		}
	}
);
