/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/runtime/runtime-livebindings.mjs
 *	@Date: 2025-11-10T09:52:57-08:00 (1762797177)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T16:05:46-08:00 (1795651546)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
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

import { segmentsOf } from "#helpers/segments";
import { internals as contextInternals } from "#factories/context";
import { internals as instanceImportsInternals } from "#helpers/instance-imports";
// This module's own namespace, registered below as the one copy of this file.
import * as ownNamespace from "./runtime-livebindings.mjs";
import { SlothletError } from "#errors";
import { internals as unifiedWrapperInternals } from "#handlers/unified-wrapper";
import { internals as trustedRootInternals } from "#handlers/trusted-root";
import { internals as frameworkInternalsInternals } from "#handlers/framework-internals";
import { Objects, String, SymbolMethods } from "#helpers/intrinsics";
import { resolvedAccess } from "#helpers/access-record";
const { registerOwnModule, registerSelfForms, bindInstanceSelf, SELF_BIND_KEY } =
	instanceImportsInternals("lib/runtime/runtime-livebindings");
const { runtimeTraps } = unifiedWrapperInternals("lib/runtime/runtime-livebindings");
const trustedRootOwn = trustedRootInternals("lib/runtime/runtime-livebindings");
const { markSlothletProxy } = frameworkInternalsInternals("lib/runtime/runtime-livebindings");
const { liveRuntime } = contextInternals("lib/runtime/runtime-livebindings");

/**
 * The active store, or `null` while no instance is active. With no active instance there is no call running, which is
 * what each trap below reports, as the async runtime does for a flow with no store; a store that cannot be found for an
 * active instance still throws.
 * @returns {object|null} The active store, or null.
 * @private
 */
function activeContext() {
	try {
		return liveRuntime.getContext();
	} catch (error) {
		if (error?.code === "CONTEXT_NOT_ACTIVE_LIVE") return null;
		throw error;
	}
}

// Active-store resolver threaded into protected context views (see readProtectedContextValue):
// hoisted so the hot get-trap path passes one stable function instead of allocating an arrow per read.

/**
 * Resolve the active store, but only while a module is actually executing.
 *
 * `self` is the in-module view of the api, and what makes it safe is that every access through it is
 * attributed to the module making it. Code that is not a module has no attribution, so resolving
 * `self` for it would resolve it as the host — which is exempt from the rules. Any script that can
 * import the runtime would then hold full authority over a running instance, up to and including
 * `slothlet.permissions.control.mode("off")`.
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
 * @param {{store?: object, identity?: object}|null} [resolved=null] - Receives the caller identity this read
 *   resolved and the store it resolved it on, so the read it decides takes it instead of resolving it again.
 * @returns {object|null} The active store, or `null` when no module is executing.
 * @private
 */
function runtime_resolveExecutingContext(resolved = null) {
	const ctx = activeContext();
	if (!ctx || !ctx.self) return null;
	// `getCallerIdentity` reports no caller when the ambient field is stale, so its answer replaces the
	// raw field rather than falling back to it — a fallback would reinstate exactly what it rejected.
	const identity = liveRuntime.getCallerIdentity?.();
	if (resolved && identity) {
		resolved.store = ctx;
		resolved.identity = identity;
	}
	// The else arm reads the raw field for a context manager without `getCallerIdentity`. The live
	// manager always provides it; the fallback covers a partial or older manager being injected.
	/* v8 ignore next */
	const executing = identity ? identity.currentWrapper : ctx.currentWrapper;
	if (executing) return ctx;

	// A host that entered a context on purpose through `api.slothlet.context.run()` / `.scope()` may use `self`
	// inside its callback, even though a host callback is not a module and so has no caller of its own.
	// A scope store is recognisable by the parent it descends from, and the trusted marker distinguishes
	// one the host opened from one a module opened (a module's scope inherits the module as the caller
	// and is admitted above). This grants nothing extra: reaching `run()` at all means already holding
	// the `api` object, which carries the host's standing anyway. A run's store put back for work the run left behind
	// after it returned is not that flow: the work keeps the run's context, never its standing.
	// A flow slothlet opened over the instance's own store to carry a build's mark stands for that store, which admits no
	// one here.
	if (
		ctx.parentInstanceID &&
		ctx[trustedRootOwn.TRUSTED_ROOT] === true &&
		ctx[trustedRootOwn.REOPENED_FLOW] !== true &&
		ctx[trustedRootOwn.INSTANCE_FLOW] !== true
	)
		return ctx;

	return null;
}

/**
 * Refuse a read of `self` whose caller the live runtime cannot determine (#726): calls are in flight and it cannot tell
 * which of them runs the code (two api paths of one module resuming in a file they share), or that it is none of them,
 * and the code's frames named no definer to read it as. That is module code no one can be named for, so the read is
 * `PERMISSION_DENIED`, as every other access under that caller is. Code no call accounts for is left to the caller of
 * this function, which reports no module running.
 * @param {string|symbol} prop - The member read.
 * @returns {void}
 * @throws {SlothletError} `PERMISSION_DENIED` when the caller cannot be determined and permissions are on.
 * @private
 */
function runtime_refuseUnknownCaller(prop) {
	const store = activeContext();
	if (!store?.slothlet?.handlers?.permissionManager?.isEnabled?.()) return;
	const identity = liveRuntime.getCallerIdentity?.();
	if (!identity?.unresolved) return;
	// Code no call accounts for has no module running. Code no one is named for inside a call of a module that is gone
	// (removed, or replaced by a restart) is that module's code, which has no standing: it is refused, as the async
	// runtime refuses it.
	if (identity.unaccounted && identity.inCallOf?.____slothlet?.handlers?.apiManager?.isRemovedCaller?.(identity.inCallOf) !== true) return;
	const target = typeof prop === "symbol" ? String(SymbolMethods.description(prop) ?? "") : String(prop);
	throw new SlothletError("PERMISSION_DENIED", { caller: null, target: segmentsOf(target) });
}

const bindHere = (instanceID, assign) => bindInstanceSelf(import.meta.url, instanceID, assign);

/**
 * This runtime's `self` (an object form for an api whose root is an object, a callable one for a function root, #803)
 * and `context`, built by the wrapper's runtime bridge over how this runtime reads its stores.
 * @private
 */
const {
	objectSelf,
	callableSelf,
	context: contextProxy
} = runtimeTraps(liveRuntime, {
	current: (resolved) => runtime_resolveExecutingContext(resolved),
	store: activeContext,
	loadingInstance: () => null,
	refuseUnknown: runtime_refuseUnknownCaller,
	hostFlow: (ctx, resolved) =>
		!!(resolved.identity && !resolved.identity.currentWrapper && !resolved.identity.unresolved && ctx.parentInstanceID),
	access: (resolved) => (resolved.identity ? resolvedAccess(liveRuntime, resolved.store, resolved.identity) : null),
	bindKey: SELF_BIND_KEY,
	bind: bindHere
});

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
export let self = objectSelf;

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
export const context = contextProxy;

/**
 * The id of the store the running code's flow is on, as the async runtime's `instanceID` reads it from its store: the
 * instance's own id inside one of its calls, a `run()` / `scope()` store's id inside that flow, and none outside any
 * call or flow of an instance. The live runtime's store stays set between calls, so it is read only while a module is
 * executing or a flow the host opened runs (see runtime_resolveExecutingContext).
 * @returns {string|null} The id, or null.
 * @private
 */
function runtime_executingInstanceID() {
	let ctx;
	try {
		ctx = runtime_resolveExecutingContext();
	} catch {
		// No live instance at all: no store to read.
		return null;
	}
	return ctx ? ctx.instanceID : null;
}

/**
 * Read-only facts about the running slothlet instance, as the async runtime's `instance` gives them.
 * @type {Readonly<{id: (string|undefined)}>}
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
export const instance = Objects.freeze({
	/**
	 * The running instance's id, or undefined outside a call.
	 * @returns {string|undefined} The id.
	 */
	get id() {
		const id = runtime_executingInstanceID();
		return id === null ? undefined : String(id);
	}
});

// The runtime's own Proxies are slothlet's, never a module's (#597).
for (let ofIndex = 0, ofList = [objectSelf, callableSelf, context]; ofIndex < ofList.length; ofIndex++) {
	const proxy = ofList[ofIndex];
	markSlothletProxy(proxy);
}
// Each instance's files get the form of `self` its api root takes (#803).
registerSelfForms(import.meta.url, ownNamespace, { object: objectSelf, callable: callableSelf }, (form) => {
	self = form;
});

// One runtime per process: a second loader asked for this file is given this module (#760).
registerOwnModule(import.meta.url, ownNamespace);
