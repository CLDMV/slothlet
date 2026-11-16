/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/runtime/runtime-asynclocalstorage.mjs
 *	@Date: 2025-11-10T09:52:57-08:00 (1762797177)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T19:48:25-08:00 (1794800905)
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
import { internals as instanceImportsInternals } from "@cldmv/slothlet/helpers/instance-imports";
// This module's own namespace, registered below as the one copy of this file.
import * as ownNamespace from "./runtime-asynclocalstorage.mjs";
import { SlothletError } from "@cldmv/slothlet/errors";
import { internals as unifiedWrapperInternals } from "#handlers/unified-wrapper";
import { internals as trustedRootInternals } from "#handlers/trusted-root";
import { internals as frameworkInternalsInternals } from "#handlers/framework-internals";
import { Reflect, NativeObject, NativeProxy, Set, Symbol, String } from "@cldmv/slothlet/helpers/intrinsics";
const { registerOwnModule, registerSelfForms, bindInstanceSelf, SELF_BIND_KEY } = instanceImportsInternals(
	"lib/runtime/runtime-asynclocalstorage"
);
const {
	runtime_assertFrameworkRootChange,
	runtime_selfChangeTarget,
	runtime_selfFrameworkView,
	runtime_selfView,
	runtime_unwrapSelfView,
	runtime_selfReadAsDefiner,
	runtime_selfToJSON,
	runtime_contextRead,
	runtime_contextWritten,
	runtime_contextReadAsDefiner,
	registerRuntimeContext,
	registerRuntimeSelf
} = unifiedWrapperInternals("lib/runtime/runtime-asynclocalstorage");
const { enforceContextKeyWrite, readProtectedContextValue, writersOf } = trustedRootInternals("lib/runtime/runtime-asynclocalstorage");
const { markSlothletProxy } = frameworkInternalsInternals("lib/runtime/runtime-asynclocalstorage");
const { asyncRuntime } = contextInternals("lib/runtime/runtime-asynclocalstorage");

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
 * Members of `self` that are the framework's own namespace and functions rather than nodes of the api.
 * @type {Set<string>}
 * @private
 */
const FRAMEWORK_SELF_ROOTS = setFrom(["slothlet", "shutdown", "destroy"]);

/**
 * What a read of `self` hands a module: a node of the api comes back as a view that keeps who read it (#625),
 * so a node a module keeps and writes into later, outside any call, is held to that module's ownership rather
 * than taking the host's. The framework's own members come back as a view that runs what the module later does
 * with them, outside any call, as that module. Everything else is returned as is.
 *
 * @param {string|symbol} prop - Member read.
 * @param {*} value - Its value.
 * @returns {*} The value, or a view of the node.
 * @private
 */
function runtime_selfMember(prop, value) {
	if (typeof prop !== "string") return value;
	return SetMethods.has(FRAMEWORK_SELF_ROOTS, prop) ? runtime_selfFrameworkView(value) : runtime_selfView(value);
}

/**
 * Bind an instance's file's `self` to the instance's form, for this runtime file (#803, see `bindInstanceSelf` in
 * `helpers/instance-imports`).
 * @param {string} instanceID - The instance.
 * @param {function(object): void} assign - Sets the binding.
 * @returns {void}
 * @private
 */
const bindHere = (instanceID, assign) => bindInstanceSelf(import.meta.url, instanceID, assign);

/**
 * The traps both forms of `self` share: each resolves to the correct instance's API in AsyncLocalStorage context.
 * @type {ProxyHandler<object>}
 * @private
 */
const selfTraps = {
	get(_, prop) {
		// The binder an instance's file is given its own `self` through (#803), answered whoever reads it.
		if (prop === SELF_BIND_KEY) return bindHere;
		const ctx = safeGetContext();
		if (!ctx || !ctx.self) {
			// Code a module handed out, run while no call runs, reads `self` as its definer, told by its frames (#726).
			// Code a file started while it loaded has a store of its own: without a module to run as, it has no `self`.
			// Another instance's code running in that flow (a function an instance built by the loading file handed
			// out) is not the load's: it is read as its definer, as with no store.
			const read = runtime_selfReadAsDefiner(objectSelf, prop, ctx?.moduleLoad ? ctx.instanceID : null);
			if (read) return read.value;
			throw new SlothletError("RUNTIME_NO_ACTIVE_CONTEXT_SELF", {}, null, { validationError: true });
		}
		// A flow the host opened (`run()` / `scope()`) names no module. A module's code running in it (a function it
		// handed out, run by the host there) still reads `self` as its definer; the host's own code reads it as the host.
		if (!ctx.currentWrapper && !ctx.record && ctx.parentInstanceID) {
			const read = runtime_selfReadAsDefiner(objectSelf, prop, null, ctx.parentInstanceID);
			if (read) return read.value;
		}
		const value = ctx.self[prop];
		// An object root with no `toJSON` of its own serializes as `api` does for the host, less what the reader is refused,
		// which is left out rather than thrown for (#803).
		if (prop === "toJSON" && value === undefined && typeof ctx.self !== "function") return runtime_selfToJSON;
		return runtime_selfMember(prop, value);
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
			return "value" in desc
				? { ...desc, value: runtime_selfMember(prop, desc.value), configurable: true }
				: { ...desc, configurable: true };
		}
		return undefined;
	},
	// A change to `self` itself follows the rule a top-level `self.X = …` does and lands on the running
	// instance's api, never on the object behind `self`, which every module of every instance shares (#625).
	deleteProperty(_, prop) {
		const ctx = safeGetContext();
		if (!ctx || !ctx.self) {
			throw new SlothletError("RUNTIME_NO_ACTIVE_CONTEXT_SELF", {}, null, { validationError: true });
		}
		return Reflect.deleteProperty(runtime_selfChangeTarget(ctx, prop), prop);
	},
	defineProperty(_, prop, descriptor) {
		const ctx = safeGetContext();
		if (!ctx || !ctx.self) {
			throw new SlothletError("RUNTIME_NO_ACTIVE_CONTEXT_SELF", {}, null, { validationError: true });
		}
		const target = runtime_selfChangeTarget(ctx, prop);
		// A member `self` reported fixed would have to be fixed on that shared object: such a definition is refused.
		if (descriptor.configurable === false) return false;
		if ("value" in descriptor) descriptor = { ...descriptor, value: runtime_unwrapSelfView(descriptor.value) };
		return Reflect.defineProperty(target, prop, descriptor);
	},
	// `self` keeps its prototype and stays extensible: it is shared, so neither change could be confined to
	// one instance. The change is refused, after the rule for `self` as a whole has been applied.
	setPrototypeOf() {
		const ctx = safeGetContext();
		if (ctx?.self) runtime_selfChangeTarget(ctx, null);
		return false;
	},
	preventExtensions() {
		const ctx = safeGetContext();
		if (ctx?.self) runtime_selfChangeTarget(ctx, null);
		return false;
	},
	set(_, prop, value) {
		// A view `self` handed out stands for its node: the node is what is stored (#625).
		value = runtime_unwrapSelfView(value);
		// Route through `apiManager.setOwnedProperty` so the assignment is
		// validated against the caller's owned apiPath. Falls back to a
		// direct `ctx.self[prop] = value` (Stage 1 behavior) if the slothlet
		// reference isn't available, so the silent-loss bug stays closed
		// even in unusual lifecycle states.
		const ctx = safeGetContext();
		// Mirror the get-trap guard. The set trap is only reachable when
		// `self.X = …` runs from inside a slothlet context, which always
		// has ctx.self set; the test surface is the same as the get path.
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
		// JS semantics hold. A symbol is no api path of its own: the write is
		// held to the root of the tree, as a change to `self` as a whole is (#625).
		if (typeof prop === "symbol") {
			runtime_selfChangeTarget(ctx, prop);
			ctx.self[prop] = value;
			return true;
		}
		// A module never replaces the framework's namespace or root functions, isolated scope or not (#625).
		if (ctx.slothlet) runtime_assertFrameworkRootChange(ctx.slothlet, prop);
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
			// `currentWrapper` is the module currently executing (the one
			// doing `self.X = …`); `callerWrapper` is who *called* it.
			// Ownership is anchored to the currently executing module.
			// Code a caller supplied to another module's call writes as the supplier and every call of its ceiling,
			// and each of them has to own the path (#597).
			apiManager.setOwnedProperty(String(prop), value, writersOf(ctx));
		} else {
			/* v8 ignore next */
			ctx.self[prop] = value;
		}
		return true;
	}
};

/**
 * Use the api root `self` stands for now, as `get` reads a member of it (#803): in the running call's context, or, for
 * code a module handed out run while no call runs, as its definer.
 * @param {function(object): *} use - What is done with it.
 * @returns {*} What `use` returned.
 * @throws {SlothletError} RUNTIME_NO_ACTIVE_CONTEXT_SELF outside any context, with no definer to run as.
 * @private
 */
function runtime_selfUse(use) {
	const ctx = safeGetContext();
	if (!ctx || !ctx.self) {
		const read = runtime_selfReadAsDefiner(objectSelf, "", ctx?.moduleLoad ? ctx.instanceID : null, null, use);
		if (read) return read.value;
		throw new SlothletError("RUNTIME_NO_ACTIVE_CONTEXT_SELF", {}, null, { validationError: true });
	}
	if (!ctx.currentWrapper && !ctx.record && ctx.parentInstanceID) {
		const read = runtime_selfReadAsDefiner(objectSelf, "", null, ctx.parentInstanceID, use);
		if (read) return read.value;
	}
	return use(ctx.self);
}

/**
 * `self` for an api whose root is an object: an object target, as the api root's own is.
 * @type {Proxy}
 * @private
 */
const objectSelf = new NativeProxy({}, selfTraps);

/**
 * The target of {@link callableSelf}: a bound function, as the api root's own target is when its root is a function,
 * so it is callable and constructible and has no `prototype` of its own to report.
 * @type {Function}
 * @private
 */
const callableTarget = function () {}.bind();

/**
 * `self` for an api whose root is a function (#803): a call or construction of it is one of the api root, held to the
 * root's call rule as `self.call()` is, and it reports the root's prototype.
 * @type {Proxy}
 * @private
 */
const callableSelf = new NativeProxy(callableTarget, {
	...selfTraps,
	apply(_, thisArg, args) {
		return runtime_selfUse((root) => Reflect.apply(root, thisArg, args));
	},
	construct(_, args) {
		return runtime_selfUse((root) => Reflect.construct(root, args));
	},
	getPrototypeOf() {
		const ctx = safeGetContext();
		return ctx?.self ? Reflect.getPrototypeOf(ctx.self) : Reflect.getPrototypeOf(callableTarget);
	}
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
export const context = new NativeProxy(
	{},
	{
		get(_, prop) {
			const ctx = safeGetContext();
			if (!ctx || !ctx.context) {
				// Code a module handed out, run while no call runs, reads the context of its definer's instance (#726).
				return runtime_contextReadAsDefiner(context, prop);
			}
			// Owner-locked keys (scope({ protect, owners })) read back as a recursive protected view so
			// nested writes stay enforced (#207); every other key returns the raw value unchanged. The
			// resolver lets the view identify the WRITER from the store active at write time — each
			// module call runs in its own derived store, so the wrap-time store's identity is stale.
			// What a module stored there reaches another module as values one module hands another do.
			return runtime_contextRead(ctx, readProtectedContextValue(ctx, prop, safeGetContext));
		},
		set(_, prop, value) {
			const ctx = safeGetContext();
			// Defensive guard, mirrored from the self set-trap guard above: in
			// normal use the context set trap runs inside a slothlet context,
			// which always has ctx.context. v8's parallel-worker coverage merge
			// miscounts this `if (...) { throw }` — the synthetic else-arm
			// resolves to a phantom -1 — so it is ignored, matching the self guard.
			/* v8 ignore next 3 */
			if (!ctx || !ctx.context) {
				throw new SlothletError("RUNTIME_NO_ACTIVE_CONTEXT_CONTEXT", {}, null, { validationError: true });
			}
			// Owner-locked context keys (opt-in via scope({ protect, owners })): reject a write the
			// current caller doesn't own before mutating the context.
			enforceContextKeyWrite(ctx, prop);
			runtime_contextWritten(ctx, value);
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
			const descriptor = Reflect.getOwnPropertyDescriptor(ctx.context, prop);
			if (!descriptor || !("value" in descriptor)) return descriptor;
			return { __proto__: null, ...descriptor, value: runtime_contextRead(ctx, descriptor.value) };
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
export const instanceID = new NativeProxy(
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
			return prop in NativeObject(ctx.instanceID);
		}
	}
);

// The runtime's own Proxies are slothlet's, never a module's (#597).
for (const proxy of [objectSelf, callableSelf, context, instanceID]) markSlothletProxy(proxy);
// A read of `self` made while no call runs, through any runtime's `self`, reads through this one for an async instance (#726).
registerRuntimeSelf(asyncRuntime, objectSelf, callableSelf);
// Each instance's files get the form of `self` its api root takes (#803).
registerSelfForms(import.meta.url, ownNamespace, { object: objectSelf, callable: callableSelf }, (form) => {
	self = form;
});
registerRuntimeContext(asyncRuntime, context);

// One runtime per process: a second loader asked for this file is given this module (#760).
registerOwnModule(import.meta.url, ownNamespace);
