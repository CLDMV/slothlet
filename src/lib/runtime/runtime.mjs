/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/runtime/runtime.mjs
 *	@Date: 2025-09-09 08:06:19 -07:00 (1725890779)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:39 -08:00 (1772425299)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Runtime dispatcher - proxies to async or live runtime based on configuration
 * @module @cldmv/slothlet/runtime
 * @public
 *
 * @description
 * Provides live bindings for use inside API module functions. Import the exports you need:
 *
 * ```js
 * import { self, context, instanceID } from "@cldmv/slothlet/runtime";
 * ```
 *
 * | Export | Type | Description |
 * | --- | --- | --- |
 * | `self` | `object` | Live reference to the full Slothlet API proxy. Use to call sibling modules without import cycles. |
 * | `context` | `object` | Per-request context data set by `api.slothlet.context.run(ctx, fn)`. Readable and writable. |
 * | `instanceID` | `string` | Unique identifier of the active Slothlet instance. |
 *
 * All three are lazy Proxy objects — they resolve to the correct runtime value at call time,
 * whether the instance uses `"async"` (AsyncLocalStorage) or `"live"` runtime mode.
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
	// Try async runtime first (ALS-based - only set when actively inside an async scope)
	// This must be checked before live so that async functions aren't misidentified as
	// live when a live instance has a stale currentInstanceID from a previous call.
	const asyncCtx = asyncRuntime.tryGetContext();
	if (asyncCtx) {
		return asyncRuntimeModule;
	}

	// Try live runtime (synchronous global binding)
	const liveCtx = liveRuntime.tryGetContext();
	if (liveCtx) {
		return liveRuntimeModule;
	}

	// Default to async if no active context (will throw proper error)
	return asyncRuntimeModule;
}

/**
 * Live binding to the current API instance. Resolves to the running Slothlet proxy,
 * giving API modules access to all other API methods without import cycles.
 *
 * @memberof module:@cldmv/slothlet/runtime
 * @type {object}
 * @example
 * import { self } from "@cldmv/slothlet/runtime";
 * // Inside an API function:
 * const result = await self.math.add(1, 2);
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
 * Per-request context data provided via `api.slothlet.context.run(ctx, fn)` or
 * `slothlet.context.run(ctx, fn)`. Readable and writable inside the current scope.
 *
 * @memberof module:@cldmv/slothlet/runtime
 * @type {object}
 * @example
 * import { context } from "@cldmv/slothlet/runtime";
 * // Inside an API function called within a context.run() scope:
 * const userId = context.userId;
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
 * Current Slothlet instance identifier. Unique per `slothlet()` call; useful when
 * multiple Slothlet instances coexist and you need to identify which one is active.
 *
 * @memberof module:@cldmv/slothlet/runtime
 * @type {string}
 * @example
 * import { instanceID } from "@cldmv/slothlet/runtime";
 * console.log(instanceID); // e.g. "slothlet-1"
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
