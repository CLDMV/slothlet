/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/runtime/runtime.mjs
 *	@Date: 2025-11-08
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Conditional runtime loader for AsyncLocalStorage and Experimental context management.
 * @module @cldmv/slothlet/runtime
 * @memberof module:@cldmv/slothlet
 * @public
 * @simpleName
 *
 * @description
 * Provides conditional runtime loading based on global configuration.
 * Exports AsyncLocalStorage or Experimental runtime based on slothlet instance settings.
 *
 * @example
 * // ESM usage (public API) - same interface for both runtimes
 * import { self, context, reference } from "@cldmv/slothlet/runtime";
 *
 * @example
 * // CJS usage (public API) - same interface for both runtimes
 * const { self, context, reference } = require("@cldmv/slothlet/runtime");
 */

// Import both runtime implementations at top level
import * as alsRuntime from "./runtime-asynclocalstorage.mjs";
import * as expRuntime from "./runtime-experimental.mjs";

// Global runtime type setting from slothlet.mjs
let activeRuntimeType = "asynclocalstorage";

/**
 * Set the active runtime type. Called by slothlet.mjs before using runtime exports.
 * @param {"asynclocalstorage"|"experimental"} runtimeType - The runtime type to use
 */
export function setActiveRuntimeType(runtimeType) {
	activeRuntimeType = runtimeType;
}

/**
 * Get the current runtime implementation
 * @returns {object} The active runtime implementation
 */
function getCurrentRuntime() {
	return activeRuntimeType === "experimental" ? expRuntime : alsRuntime;
}

// Export runtime functions that delegate to the appropriate implementation
export function runWithCtx(ctx, fn, thisArg, args) {
	return getCurrentRuntime().runWithCtx(ctx, fn, thisArg, args);
}

export function getCtx() {
	return getCurrentRuntime().getCtx();
}

export function makeWrapper(ctx) {
	return getCurrentRuntime().makeWrapper(ctx);
}

// Export live bindings that delegate to the appropriate implementation
export const self = new Proxy(
	{},
	{
		get(target, prop, receiver) {
			return Reflect.get(getCurrentRuntime().self, prop, receiver);
		},
		set(target, prop, value, receiver) {
			return Reflect.set(getCurrentRuntime().self, prop, value, receiver);
		},
		has(target, prop) {
			return Reflect.has(getCurrentRuntime().self, prop);
		},
		ownKeys(_) {
			return Reflect.ownKeys(getCurrentRuntime().self);
		},
		getOwnPropertyDescriptor(target, prop) {
			return Reflect.getOwnPropertyDescriptor(getCurrentRuntime().self, prop);
		}
	}
);

export const context = new Proxy(
	{},
	{
		get(target, prop, receiver) {
			return Reflect.get(getCurrentRuntime().context, prop, receiver);
		},
		set(target, prop, value, receiver) {
			return Reflect.set(getCurrentRuntime().context, prop, value, receiver);
		},
		has(target, prop) {
			return Reflect.has(getCurrentRuntime().context, prop);
		},
		ownKeys(_) {
			return Reflect.ownKeys(getCurrentRuntime().context);
		},
		getOwnPropertyDescriptor(target, prop) {
			return Reflect.getOwnPropertyDescriptor(getCurrentRuntime().context, prop);
		}
	}
);

export const reference = new Proxy(
	{},
	{
		get(target, prop, receiver) {
			return Reflect.get(getCurrentRuntime().reference, prop, receiver);
		},
		set(target, prop, value, receiver) {
			return Reflect.set(getCurrentRuntime().reference, prop, value, receiver);
		},
		has(target, prop) {
			return Reflect.has(getCurrentRuntime().reference, prop);
		},
		ownKeys(_) {
			return Reflect.ownKeys(getCurrentRuntime().reference);
		},
		getOwnPropertyDescriptor(target, prop) {
			return Reflect.getOwnPropertyDescriptor(getCurrentRuntime().reference, prop);
		}
	}
);

// Export additional runtime exports that may vary between implementations
export const instanceId = new Proxy(
	{},
	{
		get(target, prop) {
			const impl = getCurrentRuntime();
			if (impl.instanceId && typeof impl.instanceId === "object") {
				return impl.instanceId[prop];
			}
			return impl.instanceId;
		}
	}
);

export const sharedALS = new Proxy(
	{},
	{
		get(target, prop) {
			const impl = getCurrentRuntime();
			if (impl.sharedALS && typeof impl.sharedALS === "object") {
				return impl.sharedALS[prop];
			}
			return impl.sharedALS;
		}
	}
);
