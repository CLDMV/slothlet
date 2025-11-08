/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/runtime/runtime.mjs
 *	@Date: 2025-11-05 19:45:00 -08:00 (1762400700)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-11-05 19:45:00 -08:00 (1762400700)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Instance-based runtime system for live bindings.
 * @module @cldmv/slothlet/runtime
 * @memberof module:@cldmv/slothlet
 * @public
 * @simpleName
 *
 * @description
 * Provides per-instance live bindings using instance ID detection from stack traces.
 * Eliminates AsyncLocalStorage overhead while maintaining full context isolation.
 *
 * @example
 * // ESM usage (same as before - user doesn't need to change anything)
 * import { self, context, reference } from "@cldmv/slothlet/runtime";
 *
 * @example
 * // CJS usage (same as before - user doesn't need to change anything)
 * const { self, context, reference } = require("@cldmv/slothlet/runtime");
 */

import {
	detectCurrentInstanceId,
	getInstanceData,
	setActiveInstance,
	getCurrentActiveInstanceId
} from "@cldmv/slothlet/helpers/instance-manager";

/**
 * Gets the current instance context, either from instance detection or ALS fallback.
 * @internal
 * @returns {object|null} The current context or null
 */
function getCurrentInstanceContext() {
	// Debug the stack trace to see if runtime import has instance ID
	if (process.env.DEBUG_RUNTIME) {
		const stack = new Error().stack;
		console.log("[RUNTIME DEBUG] Full stack trace:");
		console.log(stack);
		console.log("[RUNTIME DEBUG] Looking for slothlet_instance in stack...");
		const instanceMatch = stack.match(/slothlet_instance=([^&\s)]+)/g);
		console.log("[RUNTIME DEBUG] All slothlet_instance matches:", instanceMatch);
	}

	// Try instance detection first using existing function
	const instanceId = detectCurrentInstanceId();

	// Add debugging to see what's happening
	if (process.env.DEBUG_RUNTIME) {
		console.log("[RUNTIME DEBUG] Detected instance ID:", instanceId);
		if (instanceId) {
			const instanceData = getInstanceData(instanceId);
			console.log("[RUNTIME DEBUG] Instance data found:", !!instanceData);
			if (instanceData) {
				console.log("[RUNTIME DEBUG] Instance data keys:", Object.keys(instanceData));
			}
		}
	}

	if (instanceId) {
		const instanceData = getInstanceData(instanceId);
		if (instanceData) {
			return instanceData;
		}
	}

	if (process.env.DEBUG_RUNTIME) {
		console.log("[RUNTIME DEBUG] No context found");
	}
	return null;
}

/**
 * Live-binding reference to the current API instance.
 * Automatically resolves to the appropriate instance based on calling context.
 * @type {object}
 * @public
 */
export const self = new Proxy(
	{},
	{
		get(target, prop) {
			const ctx = getCurrentInstanceContext();
			if (ctx && ctx.self) {
				return ctx.self[prop];
			}
			return undefined;
		},

		set(target, prop, value) {
			const ctx = getCurrentInstanceContext();
			if (ctx && ctx.self) {
				ctx.self[prop] = value;
				return true;
			}
			return false;
		},

		ownKeys(_) {
			console.log("[RUNTIME DEBUG] ownKeys called - dumping stack trace:");
			console.log(new Error().stack);
			const ctx = getCurrentInstanceContext();
			if (ctx && ctx.self) {
				return Reflect.ownKeys(ctx.self);
			}
			return [];
		},

		has(target, prop) {
			const ctx = getCurrentInstanceContext();
			if (ctx && ctx.self) {
				return prop in ctx.self;
			}
			return false;
		},

		getOwnPropertyDescriptor(target, prop) {
			const ctx = getCurrentInstanceContext();
			if (ctx && ctx.self) {
				return Reflect.getOwnPropertyDescriptor(ctx.self, prop);
			}
			return undefined;
		}
	}
);

/**
 * Live-binding reference for contextual data.
 * Automatically resolves to the appropriate instance context.
 * @type {object}
 * @public
 */
export const context = new Proxy(
	{},
	{
		get(target, prop) {
			const ctx = getCurrentInstanceContext();
			if (ctx && ctx.context) {
				return ctx.context[prop];
			}
			return undefined;
		},

		set(target, prop, value) {
			const ctx = getCurrentInstanceContext();
			if (ctx && ctx.context) {
				ctx.context[prop] = value;
				return true;
			}
			return false;
		},

		ownKeys(_) {
			const ctx = getCurrentInstanceContext();
			if (ctx && ctx.context) {
				return Reflect.ownKeys(ctx.context);
			}
			return [];
		},

		has(target, prop) {
			const ctx = getCurrentInstanceContext();
			if (ctx && ctx.context) {
				return prop in ctx.context;
			}
			return false;
		},

		getOwnPropertyDescriptor(target, prop) {
			const ctx = getCurrentInstanceContext();
			if (ctx && ctx.context) {
				return Reflect.getOwnPropertyDescriptor(ctx.context, prop);
			}
			return undefined;
		}
	}
);

/**
 * Live-binding reference for reference data.
 * Automatically resolves to the appropriate instance reference.
 * @type {object}
 * @public
 */
export const reference = new Proxy(
	{},
	{
		get(target, prop) {
			const ctx = getCurrentInstanceContext();
			if (ctx && ctx.reference) {
				return ctx.reference[prop];
			}
			return undefined;
		},

		set(target, prop, value) {
			const ctx = getCurrentInstanceContext();
			if (ctx && ctx.reference) {
				ctx.reference[prop] = value;
				return true;
			}
			return false;
		},

		ownKeys(_) {
			const ctx = getCurrentInstanceContext();
			if (ctx && ctx.reference) {
				return Reflect.ownKeys(ctx.reference);
			}
			return [];
		},

		has(target, prop) {
			const ctx = getCurrentInstanceContext();
			if (ctx && ctx.reference) {
				return prop in ctx.reference;
			}
			return false;
		},

		getOwnPropertyDescriptor(target, prop) {
			const ctx = getCurrentInstanceContext();
			if (ctx && ctx.reference) {
				return Reflect.getOwnPropertyDescriptor(ctx.reference, prop);
			}
			return undefined;
		}
	}
);

/**
 * Live-binding reference to the current instance ID.
 * Automatically resolves to the current instance identifier.
 * @type {string}
 * @public
 */
export const instanceId = new Proxy(
	{},
	{
		get(target, prop) {
			if (prop === "valueOf" || prop === "toString" || prop === Symbol.toPrimitive) {
				const currentId = detectCurrentInstanceId();
				return () => currentId || "unknown";
			}
			return detectCurrentInstanceId() || "unknown";
		},

		ownKeys(_) {
			return ["valueOf", "toString"];
		},

		has(target, prop) {
			return prop === "valueOf" || prop === "toString" || prop === Symbol.toPrimitive;
		},

		getOwnPropertyDescriptor(target, prop) {
			if (prop === "valueOf" || prop === "toString" || prop === Symbol.toPrimitive) {
				return {
					configurable: true,
					enumerable: false,
					writable: false,
					value: () => detectCurrentInstanceId() || "unknown"
				};
			}
			return undefined;
		}
	}
);

/**
 * Context-aware function execution with temporary active instance override.
 * Sets the active instance based on the context before calling the function,
 * ensuring CJS runtime imports detect the correct instance.
 * @param {object} ctx - Context object containing instanceId
 * @param {Function} fn - Function to execute
 * @param {any} thisArg - The this argument
 * @param {Array} args - The function arguments
 * @returns {any} The function result
 */
export function runWithCtx(ctx, fn, thisArg, args) {
	// Save current active instance
	const previousActiveInstance = getCurrentActiveInstanceId();

	// Temporarily set active instance from context
	if (ctx && ctx.instanceId) {
		setActiveInstance(ctx.instanceId);
	}

	try {
		// Execute function with correct instance context
		return Reflect.apply(fn, thisArg, args);
	} finally {
		// Restore previous active instance
		setActiveInstance(previousActiveInstance);
	}
}

/**
 * Legacy makeWrapper function for backwards compatibility.
 * @internal
 * @param {object} ctx - The context to bind
 * @returns {function} A wrapper function
 */
export function makeWrapper(_) {
	return function wrapperFunction(obj) {
		// Since we have instance detection, we might not need complex wrapping
		// But keep the interface for backwards compatibility
		return obj;
	};
}

// Legacy exports for backwards compatibility - removed ALS

/**
 * Legacy context management functions - kept for backwards compatibility
 * but may not be needed with instance detection approach.
 */

export function getContext() {
	return getCurrentInstanceContext();
}

export function setContext(newContext) {
	// Instance contexts are managed by the registry,
	// but we can still support ALS setting for compatibility
	const ctx = getCurrentInstanceContext();
	if (ctx) {
		// Update the detected instance context
		Object.assign(ctx, newContext);
	}
	// Note: We can't really "set" the ALS context from here since it needs to run in ALS.run()
}

export const contextManager = {
	get: getContext,
	set: setContext,
	runWithCtx
};
