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

import { detectCurrentInstanceId, getInstanceData } from "../helpers/instance-manager.mjs";

// Pre-load both runtimes at module load time
const asyncRuntime = await import("./runtime-asynclocalstorage.mjs");
const liveBindingsRuntime = await import("./runtime-livebindings.mjs");

// Detect runtime type from instance configuration (called on each access)
function detectRuntimeType() {
	// Get current instance ID from stack traces (same method as live bindings runtime)
	const instanceId = detectCurrentInstanceId();

	if (instanceId) {
		const instanceData = getInstanceData(instanceId);
		if (instanceData && instanceData.config && instanceData.config.runtime) {
			return instanceData.config.runtime;
		}
	}

	// Default to async for backward compatibility
	return "async";
}

// Get the appropriate runtime based on instance configuration
function getCurrentRuntime() {
	const runtimeType = detectRuntimeType();
	return runtimeType === "live" ? liveBindingsRuntime : asyncRuntime;
}

// Export proxies that dynamically select the correct runtime
export const self = new Proxy(
	{},
	{
		get(_, prop) {
			const runtime = getCurrentRuntime();
			return runtime.self[prop];
		},
		ownKeys() {
			const runtime = getCurrentRuntime();
			return Reflect.ownKeys(runtime.self);
		},
		has(_, prop) {
			const runtime = getCurrentRuntime();
			return prop in runtime.self;
		}
	}
);

export const context = new Proxy(
	{},
	{
		get(_, prop) {
			const runtime = getCurrentRuntime();
			return runtime.context[prop];
		},
		ownKeys() {
			const runtime = getCurrentRuntime();
			return Reflect.ownKeys(runtime.context);
		},
		has(_, prop) {
			const runtime = getCurrentRuntime();
			return prop in runtime.context;
		}
	}
);

export const reference = new Proxy(
	{},
	{
		get(_, prop) {
			const runtime = getCurrentRuntime();
			return runtime.reference[prop];
		},
		ownKeys() {
			const runtime = getCurrentRuntime();
			return Reflect.ownKeys(runtime.reference);
		},
		has(_, prop) {
			const runtime = getCurrentRuntime();
			return prop in runtime.reference;
		}
	}
);

export function runWithCtx(ctx, fn, thisArg, args) {
	const runtime = getCurrentRuntime();
	return runtime.runWithCtx(ctx, fn, thisArg, args);
}

export function makeWrapper(ctx) {
	const runtime = getCurrentRuntime();
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
