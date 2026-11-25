/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/runtime/runtime-asynclocalstorage.mjs
 *	@Date: 2025-11-10T09:52:57-08:00 (1762797177)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T12:49:53-08:00 (1795380593)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview AsyncLocalStorage runtime - exports self, context, reference for API modules
 * @module @cldmv/slothlet/runtime/async
 * @internal
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

import { internals as contextInternals } from "#factories/context";
import { internals as instanceImportsInternals } from "#helpers/instance-imports";
// This module's own namespace, registered below as the one copy of this file.
import * as ownNamespace from "./runtime-asynclocalstorage.mjs";
import { internals as unifiedWrapperInternals } from "#handlers/unified-wrapper";
import { internals as frameworkInternalsInternals } from "#handlers/framework-internals";
import { Objects, String } from "#helpers/intrinsics";
const { registerOwnModule, registerSelfForms, bindInstanceSelf, SELF_BIND_KEY } = instanceImportsInternals(
	"lib/runtime/runtime-asynclocalstorage"
);
const { runtime_runtimeTraps } = unifiedWrapperInternals("lib/runtime/runtime-asynclocalstorage");
const { markSlothletProxy } = frameworkInternalsInternals("lib/runtime/runtime-asynclocalstorage");
const { asyncRuntime } = contextInternals("lib/runtime/runtime-asynclocalstorage");

/**
 * Safely retrieve the current ALS context without throwing.
 * `asyncRuntime.getContext()` throws `CONTEXT_NOT_ACTIVE_ASYNC` when no store is active,
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
} = runtime_runtimeTraps(asyncRuntime, {
	current: () => {
		const ctx = safeGetContext();
		return ctx?.self ? ctx : null;
	},
	store: safeGetContext,
	loadingInstance: () => {
		const ctx = safeGetContext();
		return ctx?.moduleLoad ? ctx.instanceID : null;
	},
	refuseUnknown: () => {},
	hostFlow: (ctx) => !ctx.currentWrapper && !ctx.record && !!ctx.parentInstanceID,
	access: () => null,
	bindKey: SELF_BIND_KEY,
	bind: bindHere
});

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
export let self = objectSelf;

/**
 * User-provided context object
 * @type {Proxy}
 * @public
 *
 * @description
 * A proxy that provides access to user-provided context data (e.g., request data, user info).
 * Can be set via `slothlet.context.run()` or `slothlet.context.scope()`.
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
export const context = contextProxy;

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
 * Read-only facts about the running slothlet instance.
 * @type {Readonly<{id: (string|undefined)}>}
 * @public
 *
 * @description
 * `instance.id` is the id of the instance whose call is running, read at access: a real string inside a call (so
 * `instance.id === "slothlet_…"` holds), undefined outside one. Useful for debugging and tracking which instance is
 * handling a request.
 *
 * @example
 * import { instance } from "@cldmv/slothlet/runtime/async";
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
		const ctx = safeGetContext();
		return ctx?.instanceID ? String(ctx.instanceID) : undefined;
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
