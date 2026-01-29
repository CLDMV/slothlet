/**
 * @fileoverview Runtime dispatcher - proxies to async or live runtime based on configuration
 * @module @cldmv/slothlet/runtime
 * @public
 */

// Import context managers
import { asyncRuntime, liveRuntime } from "@cldmv/slothlet/factories/context";

// Pre-load both runtime modules at initialization
const asyncRuntimeModule = await import("@cldmv/slothlet/runtime/async");
const liveRuntimeModule = await import("@cldmv/slothlet/runtime/live");

/**
 * Determine which runtime to use by checking which context manager has an active context
 * @returns {Object} Runtime module (async or live)
 * @private
 */
function getCurrentRuntime() {
	// Try live runtime first (synchronous check)
	const liveCtx = liveRuntime.tryGetContext();
	if (liveCtx) {
		return liveRuntimeModule;
	}

	// Try async runtime (synchronous check)
	const asyncCtx = asyncRuntime.tryGetContext();
	if (asyncCtx) {
		return asyncRuntimeModule;
	}

	// Default to async if no active context (will throw proper error)
	return asyncRuntimeModule;
}

/**
 * Live binding to the current API (self-reference)
 * Proxies to the appropriate runtime's self export
 * @type {Proxy}
 * @public
 */
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
		},
		getOwnPropertyDescriptor(_, prop) {
			const runtime = getCurrentRuntime();
			const desc = Reflect.getOwnPropertyDescriptor(runtime.self, prop);
			// If the property exists, return a descriptor that's always configurable
			// to avoid proxy invariant violations (since the proxy target is an empty object)
			if (desc) {
				return { ...desc, configurable: true };
			}
			return undefined;
		}
	}
);

/**
 * User-provided context data for live bindings
 * Proxies to the appropriate runtime's context export
 * @type {Proxy}
 * @public
 */
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
		},
		getOwnPropertyDescriptor(_, prop) {
			const runtime = getCurrentRuntime();
			return Reflect.getOwnPropertyDescriptor(runtime.context, prop);
		},
		set(_, prop, value) {
			const runtime = getCurrentRuntime();
			runtime.context[prop] = value;
			return true;
		}
	}
);

/**
 * Current instance ID
 * Proxies to the appropriate runtime's instanceID export
 * @type {Proxy}
 * @public
 */
export const instanceID = new Proxy(
	{},
	{
		get(_, prop) {
			const runtime = getCurrentRuntime();
			return runtime.instanceID ? runtime.instanceID[prop] : undefined;
		},
		has(_, prop) {
			const runtime = getCurrentRuntime();
			return runtime.instanceID ? prop in runtime.instanceID : false;
		}
	}
);
