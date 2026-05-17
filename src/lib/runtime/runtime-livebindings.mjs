/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/runtime/runtime-livebindings.mjs
 *	@Date: 2025-11-10 09:52:57 -08:00 (1731258777)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:39 -08:00 (1772425299)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Live bindings runtime - exports self, context, reference for API modules
 * @module @cldmv/slothlet/runtime/live
 * @internal
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
import { SlothletError } from "@cldmv/slothlet/errors";

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
			const desc = Reflect.getOwnPropertyDescriptor(ctx.self, prop);
			// If the property exists, return a descriptor that's always configurable
			// to avoid proxy invariant violations (since the proxy target is an empty object)
			if (desc) {
				return { ...desc, configurable: true };
			}
			return undefined;
		},
		set(_, prop, value) {
			// Route through `apiManager.setOwnedProperty` so the assignment is
			// validated against the caller's owned apiPath. Falls back to a
			// direct `ctx.self[prop] = value` (Stage 1 behavior) if the slothlet
			// reference isn't available.
			const ctx = liveRuntime.getContext();
			// Mirror the get-trap guard; same defensive shape.
			/* v8 ignore next 3 */
			if (!ctx || !ctx.self) {
				throw new SlothletError("RUNTIME_NO_ACTIVE_CONTEXT_SELF", {}, null, { validationError: true });
			}
			// Symbol-keyed writes (`self[sym] = …`) are never apiPaths — apiPaths
			// are dotted strings and ownership is path-based. Routing a symbol
			// through `setOwnedProperty(String(prop), …)` would stringify it to
			// "Symbol(…)" and set THAT string key instead of the symbol-keyed
			// property the assignment targeted. Write straight to `ctx.self` (the
			// copy-on-write set trap under isolation, or `boundApi`) so ordinary
			// JS semantics hold; apiPath ownership validation does not apply.
			if (typeof prop === "symbol") {
				ctx.self[prop] = value;
				return true;
			}
			// In full-isolation scopes (`api.slothlet.scope({ isolation: "full" }, ...)`)
			// `ctx.self` is a copy-on-write view (`makeCopyOnWriteSelf`) — a distinct
			// object from `slothlet.boundApi` that reads through to the live tree but
			// captures writes in a per-scope overlay. Routing through apiManager would
			// persist the write to the GLOBAL boundApi, defeating isolation AND bypassing
			// the overlay. Detect that case and write to `ctx.self` directly so the
			// copy-on-write set trap captures it in the scope's overlay.
			if (ctx.slothlet?.boundApi && ctx.self !== ctx.slothlet.boundApi) {
				ctx.self[prop] = value;
				return true;
			}
			const apiManager = ctx.slothlet?.handlers?.apiManager;
			if (apiManager && typeof apiManager.setOwnedProperty === "function") {
				// `currentWrapper` is the module currently executing — that's
				// the writer for ownership purposes.
				apiManager.setOwnedProperty(String(prop), value, ctx.currentWrapper ?? null);
			} else {
				/* v8 ignore next */
				ctx.self[prop] = value;
			}
			return true;
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
