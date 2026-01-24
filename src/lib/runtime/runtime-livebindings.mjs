/**
 * @fileoverview Live bindings runtime - exports self, context, reference for API modules
 * @module @cldmv/slothlet/runtime/live
 * @public
 *
 * @description
 * Provides live bindings (`self`, `context`, `reference`) for use in API modules.
 * Uses direct global bindings (no AsyncLocalStorage) for maximum performance.
 *
 * @example
 * // In your API module (ESM)
 * import { self, context } from "@cldmv/slothlet/runtime/live";
 *
 * export function myFunction() {
 *   return { api: self, data: context.userId };
 * }
import { SlothletError } from "@cldmv/slothlet/errors"; *
 * @example
 * // In your API module (CJS)
 * const { self, context } = require("@cldmv/slothlet/runtime/live");
 *
 * exports.myFunction = function() {
 *   return { api: self, data: context.userId };
 * };
 */

import { liveRuntime } from "@cldmv/slothlet/factories/context";

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
export const self = new Proxy(
	{},
	{
		get(_, prop) {
			const ctx = liveRuntime.getContext();
			if (!ctx || !ctx.self) {
				throw new SlothletError("RUNTIME_NO_ACTIVE_CONTEXT_SELF", {}, null, { validationError: true });
			}
			return ctx.self[prop];
		},
		ownKeys() {
			const ctx = liveRuntime.getContext();
			if (!ctx || !ctx.self) return [];
			return Reflect.ownKeys(ctx.self);
		},
		has(_, prop) {
			const ctx = liveRuntime.getContext();
			if (!ctx || !ctx.self) return false;
			return prop in ctx.self;
		},
		getOwnPropertyDescriptor(_, prop) {
			const ctx = liveRuntime.getContext();
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
export const context = new Proxy(
	{},
	{
		get(_, prop) {
			const ctx = liveRuntime.getContext();
			if (!ctx || !ctx.context) {
				return undefined;
			}
			return ctx.context[prop];
		},
		set(_, prop, value) {
			const ctx = liveRuntime.getContext();
			if (!ctx || !ctx.context) {
				throw new SlothletError("RUNTIME_NO_ACTIVE_CONTEXT_CONTEXT", {}, null, { validationError: true });
			}
			ctx.context[prop] = value;
			return true;
		},
		ownKeys() {
			const ctx = liveRuntime.getContext();
			if (!ctx || !ctx.context) return [];
			return Reflect.ownKeys(ctx.context);
		},
		has(_, prop) {
			const ctx = liveRuntime.getContext();
			if (!ctx || !ctx.context) return false;
			return prop in ctx.context;
		},
		getOwnPropertyDescriptor(_, prop) {
			const ctx = liveRuntime.getContext();
			if (!ctx || !ctx.context) return undefined;
			return Reflect.getOwnPropertyDescriptor(ctx.context, prop);
		}
	}
);
