/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/runtime/runtime-asynclocalstorage.mjs
 *	@Date: 2025-11-10 09:52:57 -08:00 (1731258777)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-22 13:12:22 -08:00 (1771794742)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

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

import { asyncRuntime } from "@cldmv/slothlet/factories/context";
import { SlothletError } from "@cldmv/slothlet/errors";

/**
 * Safely retrieve the current ALS context without throwing.
 * `asyncRuntime.getContext()` throws `NO_ACTIVE_CONTEXT_ASYNC` when no store is active,
 * so every proxy trap that needs a graceful fallback should use this helper instead.
 * @returns {object|null} Current context store, or null if no context is active.
 * @private
 */
function safeGetContext() {
	try {
		return asyncRuntime.getContext();
	} catch {
		return null;
	}
}

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
			const ctx = safeGetContext();
			if (!ctx || !ctx.self) {
				throw new SlothletError("RUNTIME_NO_ACTIVE_CONTEXT_SELF", {}, null, { validationError: true });
			}
			return ctx.self[prop];
		},
		ownKeys() {
			const ctx = safeGetContext();
			if (!ctx || !ctx.self) return [];
			return Reflect.ownKeys(ctx.self);
		},
		has(_, prop) {
			const ctx = safeGetContext();
			if (!ctx || !ctx.self) return false;
			return prop in ctx.self;
		},
		getOwnPropertyDescriptor(_, prop) {
			const ctx = safeGetContext();
			if (!ctx || !ctx.self) return undefined;
			const desc = Reflect.getOwnPropertyDescriptor(ctx.self, prop);
			// If the property exists on ctx.self, return a descriptor that's always configurable
			// to avoid proxy invariant violations (since the proxy target is an empty object)
			if (desc) {
				return { ...desc, configurable: true };
			}
			return undefined;
		}
	}
);

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
export const context = new Proxy(
	{},
	{
		get(_, prop) {
			const ctx = safeGetContext();
			if (!ctx || !ctx.context) {
				return undefined;
			}
			return ctx.context[prop];
		},
		set(_, prop, value) {
			const ctx = safeGetContext();
			if (!ctx || !ctx.context) {
				throw new SlothletError("RUNTIME_NO_ACTIVE_CONTEXT_CONTEXT", {}, null, { validationError: true });
			}
			ctx.context[prop] = value;
			return true;
		},
		ownKeys() {
			const ctx = safeGetContext();
			if (!ctx || !ctx.context) return [];
			return Reflect.ownKeys(ctx.context);
		},
		has(_, prop) {
			const ctx = safeGetContext();
			if (!ctx || !ctx.context) return false;
			return prop in ctx.context;
		},
		getOwnPropertyDescriptor(_, prop) {
			const ctx = safeGetContext();
			if (!ctx || !ctx.context) return undefined;
			return Reflect.getOwnPropertyDescriptor(ctx.context, prop);
		}
	}
);

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
export const instanceID = new Proxy(
	{},
	{
		get(_, prop) {
			const ctx = safeGetContext();
			if (!ctx || !ctx.instanceID) {
				return undefined;
			}
			// If accessing the proxy directly (toString, valueOf), return the instanceID
			if (prop === Symbol.toPrimitive || prop === "toString" || prop === "valueOf") {
				return () => ctx.instanceID;
			}
			return ctx.instanceID[prop];
		},
		has(_, prop) {
			const ctx = safeGetContext();
			if (!ctx || !ctx.instanceID) return false;
			// ctx.instanceID is a string — wrap in Object() so `in` doesn't throw
			return prop in Object(ctx.instanceID);
		}
	}
);
