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
 *
 * @example
 * // In your API module (CJS)
 * const { self, context } = require("@cldmv/slothlet/runtime/live");
 *
 * exports.myFunction = function() {
 *   return { api: self, data: context.userId };
 * };
 */

import { liveRuntime } from "#factories/context";
import { SlothletError } from "@cldmv/slothlet/errors";
import { enforceContextKeyWrite, readProtectedContextValue, TRUSTED_ROOT } from "#handlers/trusted-root";

// Active-store resolver threaded into protected context views (see readProtectedContextValue):
// hoisted so the hot get-trap path passes one stable function instead of allocating an arrow per read.
const resolveActiveContext = () => liveRuntime.getContext();

/**
 * Resolve the active store, but only while a module is actually executing.
 *
 * `self` is the in-module view of the api, and what makes it safe is that every access through it is
 * attributed to the module making it. Code that is not a module has no attribution, so resolving
 * `self` for it would resolve it as the host — which is exempt from the rules. Any script that can
 * import the runtime would then hold full authority over a running instance, up to and including
 * `slothlet.permissions.control.disable()`.
 *
 * The async runtime refuses this for free: outside a module call there is no AsyncLocalStorage store
 * to read through. The live runtime holds its store in a field that stays populated for the whole
 * lifetime of the instance, so being live was by itself enough to make `self` resolve for anyone —
 * hence the extra condition here. Reaching the api from outside is what the bound `api` object
 * returned by `slothlet()` is for; this narrows `self` alone.
 *
 * An identity that resolved to no caller counts as no module, including the case where two suspended
 * calls could not be told apart. Refusing there is the conservative answer: an unattributable access
 * would otherwise be handed the host's exemption.
 *
 * @returns {object|null} The active store, or `null` when no module is executing.
 * @private
 */
function runtime_resolveExecutingContext() {
	const ctx = liveRuntime.getContext();
	if (!ctx || !ctx.self) return null;
	// `getCallerIdentity` reports no caller when the ambient field is stale, so its answer replaces the
	// raw field rather than falling back to it — a fallback would reinstate exactly what it rejected.
	const identity = liveRuntime.getCallerIdentity?.();
	const executing = identity ? identity.currentWrapper : ctx.currentWrapper;
	if (executing) return ctx;

	// A host that entered a context on purpose through `api.slothlet.run()` / `.scope()` may use `self`
	// inside its callback, even though a host callback is not a module and so has no caller of its own.
	// A scope store is recognisable by the parent it descends from, and the trusted marker distinguishes
	// one the host opened from one a module opened (a module's scope inherits the module as the caller
	// and is admitted above). This grants nothing extra: reaching `run()` at all means already holding
	// the `api` object, which carries the host's standing anyway.
	if (ctx.parentInstanceID && ctx[TRUSTED_ROOT] === true) return ctx;

	return null;
}

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
			const ctx = runtime_resolveExecutingContext();
			if (!ctx) {
				throw new SlothletError("RUNTIME_NO_ACTIVE_CONTEXT_SELF", {}, null, { validationError: true });
			}
			return ctx.self[prop];
		},
		// The enumeration traps answer on the same condition as `get`. A proxy that refuses reads but
		// still answers `ownKeys` / `in` / `getOwnPropertyDescriptor` discloses the shape of the api to
		// a caller with no standing to see it — the same trap-by-trap inconsistency that once left
		// denied leaves enumerable.
		ownKeys() {
			const ctx = runtime_resolveExecutingContext();
			if (!ctx) return [];
			return Reflect.ownKeys(ctx.self);
		},
		has(_, prop) {
			const ctx = runtime_resolveExecutingContext();
			if (!ctx) return false;
			return prop in ctx.self;
		},
		getOwnPropertyDescriptor(_, prop) {
			const ctx = runtime_resolveExecutingContext();
			if (!ctx) return undefined;
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
			// Gated exactly like the read traps, and for a sharper reason: a write claims ownership of the
			// path it lands on, attributed to the module making it. With no module executing there is nobody
			// to attribute it to, and letting it through would let any script holding the runtime import
			// reshape the api tree of a running instance.
			const ctx = runtime_resolveExecutingContext();
			if (!ctx) {
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
				// Per-flow identity: the writer decides ownership of owner-locked keys, so a stale
				// shared field would attribute this write to another module.
				apiManager.setOwnedProperty(String(prop), value, liveRuntime.getCallerIdentity?.()?.currentWrapper ?? ctx.currentWrapper ?? null);
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
			// Owner-locked keys (scope({ protect, owners })) read back as a recursive protected view so
			// nested writes stay enforced (#207); every other key returns the raw value unchanged. The
			// resolver lets the view identify the WRITER from the store active at write time rather
			// than a stale wrap-time snapshot.
			return readProtectedContextValue(ctx, prop, resolveActiveContext);
		},
		set(_, prop, value) {
			const ctx = liveRuntime.getContext();
			if (!ctx || !ctx.context) {
				throw new SlothletError("RUNTIME_NO_ACTIVE_CONTEXT_CONTEXT", {}, null, { validationError: true });
			}
			// Owner-locked context keys (opt-in via scope({ protect, owners })): reject a write the
			// current caller doesn't own before mutating the context.
			enforceContextKeyWrite(ctx, prop);
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
