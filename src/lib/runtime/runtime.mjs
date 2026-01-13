/**
 * @Project: @cldmv/slothlet
 * @Filename: /src/lib/runtime/runtime.mjs
 * @Author: Nate Hyson <CLDMV>
 * @Email: <Shinrai@users.noreply.github.com>
 * @Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Runtime dispatcher - detects and forwards to correct runtime.
 * @module @cldmv/slothlet/runtime
 * @public
 */

import {
	detectCurrentInstanceId,
	getInstanceData,
	setActiveInstance,
	getCurrentActiveInstanceId
} from "@cldmv/slothlet/helpers/instance-manager";

// Pre-load both runtimes at module load time
const asyncRuntimeModule = await import("@cldmv/slothlet/runtime/async");
const liveBindingsRuntime = await import("@cldmv/slothlet/runtime/live");
const asyncRuntimeCache = new Map(); // instanceId -> runtime facade

// Detect runtime type from instance configuration (called on each access)
function detectRuntimeType(preferredInstanceId) {
	const instanceId = preferredInstanceId || detectCurrentInstanceId();

	if (instanceId) {
		const instanceData = getInstanceData(instanceId);
		if (instanceData && instanceData.config && instanceData.config.runtime) {
			return instanceData.config.runtime;
		}
	}

	// Default to async for backward compatibility
	return "async";
}

function getAsyncRuntime(ctx) {
	const preferredId = ctx?.instanceId || detectCurrentInstanceId() || "slothlet_async_default";
	if (asyncRuntimeCache.has(preferredId)) return asyncRuntimeCache.get(preferredId);
	const runtimeFactory = asyncRuntimeModule.createAsyncRuntime || ((___params) => asyncRuntimeModule);
	const runtimeInstance = runtimeFactory({ instanceId: preferredId, als: ctx?.als });
	asyncRuntimeCache.set(preferredId, runtimeInstance);
	return runtimeInstance;
}

/**
 * Clean up cached runtime for an instance.
 * @param {string} instanceId - Instance ID to clean up
 * @package
 */
function cleanupRuntimeCache(instanceId) {
	if (asyncRuntimeCache.has(instanceId)) {
		asyncRuntimeCache.delete(instanceId);
	}
}

// Get the appropriate runtime based on instance configuration
function getCurrentRuntime(ctx) {
	const runtimeType = detectRuntimeType(ctx?.instanceId);
	return runtimeType === "live" ? liveBindingsRuntime : getAsyncRuntime(ctx);
}

// Export proxies that dynamically select the correct runtime
export const self = new Proxy(
	function runtime_selfProxy() {}, // Use function target to match AsyncLocalStorage runtime
	{
		get(_, prop) {
			const runtime = getCurrentRuntime();
			return runtime.self[prop];
		},
		ownKeys(target) {
			const runtime = getCurrentRuntime();
			const runtimeKeys = Reflect.ownKeys(runtime.self);
			const targetKeys = Reflect.ownKeys(target);

			// Combine keys from both runtime and target, ensuring non-configurable target properties are included
			const allKeys = new Set([...runtimeKeys, ...targetKeys]);
			return Array.from(allKeys);
		},
		has(_, prop) {
			const runtime = getCurrentRuntime();
			return prop in runtime.self;
		},
		getOwnPropertyDescriptor(target, prop) {
			const runtime = getCurrentRuntime();
			const descriptor = Reflect.getOwnPropertyDescriptor(runtime.self, prop);

			// If no descriptor from runtime, check if it exists on our proxy target
			if (!descriptor) {
				return Reflect.getOwnPropertyDescriptor(target, prop);
			}

			// If descriptor exists but property doesn't exist on our target,
			// and descriptor is non-configurable, we need to handle this carefully
			const targetDescriptor = Reflect.getOwnPropertyDescriptor(target, prop);
			if (!targetDescriptor && descriptor && descriptor.configurable === false) {
				// For non-configurable properties that don't exist on target,
				// we need to return undefined or Node.js will throw
				return undefined;
			}

			return descriptor;
		},
		getPrototypeOf() {
			const runtime = getCurrentRuntime();
			return Reflect.getPrototypeOf(runtime.self);
		},
		isExtensible() {
			const runtime = getCurrentRuntime();
			return Reflect.isExtensible(runtime.self);
		}
	}
);

export const context = new Proxy(
	{}, // Use object target since context should be an object, not a function
	{
		get(_, prop) {
			const runtime = getCurrentRuntime();
			return runtime.context[prop];
		},
		ownKeys(target) {
			const runtime = getCurrentRuntime();
			const runtimeKeys = Reflect.ownKeys(runtime.context);
			const targetKeys = Reflect.ownKeys(target);

			// Combine keys from both runtime and target, ensuring non-configurable target properties are included
			const allKeys = new Set([...runtimeKeys, ...targetKeys]);
			return Array.from(allKeys);
		},
		has(_, prop) {
			const runtime = getCurrentRuntime();
			return prop in runtime.context;
		},
		getOwnPropertyDescriptor(target, prop) {
			const runtime = getCurrentRuntime();
			const descriptor = Reflect.getOwnPropertyDescriptor(runtime.context, prop);

			// If no descriptor from runtime, check if it exists on our proxy target
			if (!descriptor) {
				return Reflect.getOwnPropertyDescriptor(target, prop);
			}

			// If descriptor exists but property doesn't exist on our target,
			// and descriptor is non-configurable, we need to handle this carefully
			const targetDescriptor = Reflect.getOwnPropertyDescriptor(target, prop);
			if (!targetDescriptor && descriptor && descriptor.configurable === false) {
				// For non-configurable properties that don't exist on target,
				// we need to return undefined or Node.js will throw
				return undefined;
			}

			return descriptor;
		},
		getPrototypeOf() {
			const runtime = getCurrentRuntime();
			return Reflect.getPrototypeOf(runtime.context);
		},
		isExtensible() {
			const runtime = getCurrentRuntime();
			return Reflect.isExtensible(runtime.context);
		}
	}
);

export const reference = new Proxy(
	{}, // Use object target since reference should be an object, not a function
	{
		get(_, prop) {
			const runtime = getCurrentRuntime();
			return runtime.reference[prop];
		},
		ownKeys(target) {
			const runtime = getCurrentRuntime();
			const runtimeKeys = Reflect.ownKeys(runtime.reference);
			const targetKeys = Reflect.ownKeys(target);

			// Combine keys from both runtime and target, ensuring non-configurable target properties are included
			const allKeys = new Set([...runtimeKeys, ...targetKeys]);
			return Array.from(allKeys);
		},
		has(_, prop) {
			const runtime = getCurrentRuntime();
			return prop in runtime.reference;
		},
		getOwnPropertyDescriptor(target, prop) {
			const runtime = getCurrentRuntime();
			const descriptor = Reflect.getOwnPropertyDescriptor(runtime.reference, prop);

			// If no descriptor from runtime, check if it exists on our proxy target
			if (!descriptor) {
				return Reflect.getOwnPropertyDescriptor(target, prop);
			}

			// If descriptor exists but property doesn't exist on our target,
			// and descriptor is non-configurable, we need to handle this carefully
			const targetDescriptor = Reflect.getOwnPropertyDescriptor(target, prop);
			if (!targetDescriptor && descriptor && descriptor.configurable === false) {
				// For non-configurable properties that don't exist on target,
				// we need to return undefined or Node.js will throw
				return undefined;
			}

			return descriptor;
		},
		getPrototypeOf() {
			const runtime = getCurrentRuntime();
			return Reflect.getPrototypeOf(runtime.reference);
		},
		isExtensible() {
			const runtime = getCurrentRuntime();
			return Reflect.isExtensible(runtime.reference);
		}
	}
);

export function runWithCtx(ctx, fn, thisArg, args) {
	const previous = getCurrentActiveInstanceId();
	if (ctx?.instanceId) setActiveInstance(ctx.instanceId);
	try {
		const runtime = getCurrentRuntime(ctx);
		return runtime.runWithCtx(ctx, fn, thisArg, args);
	} finally {
		setActiveInstance(previous);
	}
}

export function makeWrapper(ctx) {
	const runtime = getCurrentRuntime(ctx);
	return runtime.makeWrapper(ctx);
}

export function getCtx() {
	const runtime = getCurrentRuntime();
	return (runtime.getCtx || runtime.getContext)();
}

export const instanceId = (() => {
	const runtimeType = detectRuntimeType();
	if (runtimeType === "async") {
		return null;
	}
	const runtime = getCurrentRuntime();
	return runtime.instanceId;
})();

export const sharedALS = getCurrentRuntime().sharedALS;

// Forward metadataAPI from the appropriate runtime
export const metadataAPI = new Proxy(
	{},
	{
		get(_, prop) {
			const runtime = getCurrentRuntime();
			return runtime.metadataAPI[prop];
		}
	}
);

/**
 * Clean up runtime cache for an instance (exported for cleanup)
 * @param {string} instanceId - Instance ID to clean up
 * @package
 */
export function cleanup(instanceId) {
	// First, cleanup the runtime-specific resources (AsyncLocalStorage.disable(), etc.)
	const cachedRuntime = asyncRuntimeCache.get(instanceId);
	if (cachedRuntime && typeof cachedRuntime.cleanup === "function") {
		cachedRuntime.cleanup();
	}

	// Also call live bindings cleanup if this is a live runtime
	const runtimeType = detectRuntimeType(instanceId);
	if (runtimeType === "live" && typeof liveBindingsRuntime.cleanup === "function") {
		liveBindingsRuntime.cleanup(instanceId);
	}

	// Finally, clean up the cache entry
	cleanupRuntimeCache(instanceId);
}
