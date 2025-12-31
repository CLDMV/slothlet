/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/als-eventemitter.mjs
 *	@Date: 2025-10-21 16:21:05 -07:00 (1761088865)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-12-30 07:25:32 -08:00 (1767108332)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview AsyncLocalStorage EventEmitter utility for context propagation.
 * @module @cldmv/slothlet/helpers/als-eventemitter
 * @memberof module:@cldmv/slothlet
 * @public
 *
 * @description
 * Provides AsyncLocalStorage-aware EventEmitter patching to preserve context
 * across event handler boundaries using Node.js AsyncResource API.
 *
 * @example
 * // ESM usage
 * import { enableAlsForEventEmitters } from "@cldmv/slothlet/helpers/als-eventemitter";
 *
 * @example
 * // CJS usage
 * const { enableAlsForEventEmitters } = require("@cldmv/slothlet/helpers/als-eventemitter");
 */

import { AsyncResource, AsyncLocalStorage } from "node:async_hooks";
import { EventEmitter } from "node:events";

// Define a default ALS instance to avoid circular imports
const defaultALS = new AsyncLocalStorage();

// Track original methods for restoration
let originalMethods = null;

// Global tracking of AsyncResource instances for proper cleanup
const globalResourceSet = new Set();

// Global tracking of ALL listeners that go through slothlet's patched EventEmitter methods
// This includes both wrapped and unwrapped listeners from any library in the process
const globalListenerTracker = new WeakMap(); // WeakMap<EventEmitter, Set<{event, listener, wrapped}>>
const allPatchedListeners = new Set(); // Set of all listener info that went through our patches

/**
 * Enable AsyncLocalStorage context propagation for all EventEmitter instances.
 *
 * @function enableAlsForEventEmitters
 * @package
 * @param {AsyncLocalStorage} [als] - The AsyncLocalStorage instance to use (defaults to slothlet's shared instance)
 *
 * @description
 * Patches EventEmitter.prototype to automatically preserve AsyncLocalStorage context
 * in event listeners using AsyncResource. This ensures that event handlers maintain
 * the same context that was active when they were registered.
 *
 * Uses Node.js AsyncResource API for proper context propagation, following
 * official guidance for AsyncLocalStorage across callback boundaries.
 *
 * @example
 * // Enable ALS for all EventEmitters
 * import { enableAlsForEventEmitters } from "./als-eventemitter.mjs";
 * enableAlsForEventEmitters(als);
 */
export function enableAlsForEventEmitters(als = defaultALS) {
	// Symbol flag so we don't double-patch
	const kPatched = Symbol.for("slothlet.als.patched");

	if (EventEmitter.prototype[kPatched]) return;
	EventEmitter.prototype[kPatched] = true;

	// one map per emitter instance so GC can clean up
	const kMap = Symbol("slothlet.als.listenerMap");

	/**
	 * @function runtime_ensureMap
	 * @internal
	 * @private
	 * @param {EventEmitter} emitter - The EventEmitter instance
	 * @returns {WeakMap} The listener mapping for this emitter
	 *
	 * @description
	 * Ensures each emitter has its own WeakMap for tracking wrapped listeners.
	 */
	function runtime_ensureMap(emitter) {
		if (!emitter[kMap]) emitter[kMap] = new WeakMap();
		return emitter[kMap];
	}

	/**
	 * @function runtime_wrapListener
	 * @internal
	 * @private
	 * @param {Function} listener - The original event listener
	 * @returns {Function} Context-preserving wrapper or original listener
	 *
	 * @description
	 * Wraps a listener function with AsyncResource to preserve AsyncLocalStorage
	 * context. If no active store exists, returns the original listener unchanged.
	 */
	function runtime_wrapListener(listener) {
		// If there is no active store when registering, do not wrap (fast path)
		const store = als.getStore();
		if (!store) return listener;

		// Create a resource now, under the active store
		const resource = new AsyncResource("slothlet-als-listener");

		// Track this resource globally for cleanup
		globalResourceSet.add(resource);

		/**
		 * @function runtime_wrappedListener
		 * @internal
		 * @private
		 * @param {...any} args - Arguments passed to the listener
		 * @returns {any} Result of the original listener
		 *
		 * @description
		 * The context-preserving wrapper that re-enters the AsyncLocalStorage
		 * context using AsyncResource.runInAsyncScope().
		 */
		const runtime_wrappedListener = function (...args) {
			return resource.runInAsyncScope(
				() => {
					return listener.apply(this, args);
				},
				this,
				...args
			);
		};

		// Store reference to resource for cleanup
		runtime_wrappedListener._slothletResource = resource;

		return runtime_wrappedListener;
	}

	const proto = EventEmitter.prototype;

	// Store original methods
	const origOn = proto.on;
	const origOnce = proto.once;
	const origAdd = proto.addListener;
	const origPre = proto.prependListener;
	const origPreO = proto.prependOnceListener;
	const origOff = proto.off ?? proto.removeListener;
	const origRem = proto.removeListener;

	/**
	 * @function runtime_installWrapper
	 * @internal
	 * @private
	 * @param {string} addFnName - Name of the method to wrap
	 * @param {Function} orig - Original method implementation
	 *
	 * @description
	 * Installs a context-preserving wrapper for an EventEmitter method.
	 */
	function runtime_installWrapper(addFnName, orig) {
		proto[addFnName] = function (event, listener) {
			const map = runtime_ensureMap(this);
			const wrapped = runtime_wrapListener(listener);

			// Track ALL listeners that go through our patched methods
			// This ensures we can clean up everything during shutdown
			if (!globalListenerTracker.has(this)) {
				globalListenerTracker.set(this, new Set());
			}
			const listenerInfo = {
				emitter: this,
				event,
				originalListener: listener,
				wrappedListener: wrapped,
				addMethod: addFnName
			};
			globalListenerTracker.get(this).add(listenerInfo);
			allPatchedListeners.add(listenerInfo);

			if (wrapped !== listener) map.set(listener, wrapped);
			return orig.call(this, event, wrapped);
		};
	}

	// Install wrappers for all listener registration methods
	runtime_installWrapper("on", origOn);
	runtime_installWrapper("once", origOnce);
	runtime_installWrapper("addListener", origAdd);
	if (origPre) runtime_installWrapper("prependListener", origPre);
	if (origPreO) runtime_installWrapper("prependOnceListener", origPreO);

	/**
	 * @function runtime_createRemoveWrapper
	 * @internal
	 * @private
	 * @param {Function} method - Original remove method
	 * @returns {Function} Wrapped remove method
	 *
	 * @description
	 * Creates a wrapper for listener removal methods that properly unwraps
	 * listeners that were wrapped during registration.
	 */
	function runtime_createRemoveWrapper(method) {
		/**
		 * @function runtime_removeWrapper
		 * @internal
		 * @private
		 * @param {string} event - Event name
		 * @param {Function} listener - Listener to remove
		 * @returns {EventEmitter} This emitter for chaining
		 *
		 * @description
		 * Removes a listener, unwrapping it if it was wrapped during registration.
		 */
		const runtime_removeWrapper = function (event, listener) {
			const map = runtime_ensureMap(this);
			const wrapped = map.get(listener) || listener;

			// Clean up from global tracking
			if (globalListenerTracker.has(this)) {
				const emitterListeners = globalListenerTracker.get(this);
				for (const info of emitterListeners) {
					if (info.originalListener === listener || info.wrappedListener === wrapped) {
						emitterListeners.delete(info);
						allPatchedListeners.delete(info);
						break;
					}
				}
			}

			// Clean up AsyncResource if this was a wrapped listener
			if (wrapped && wrapped._slothletResource) {
				const resource = wrapped._slothletResource;
				globalResourceSet.delete(resource);
				try {
					resource.emitDestroy();
				} catch (_) {
					// Ignore cleanup errors
				}
			}

			map.delete(listener);
			return method.call(this, event, wrapped);
		};

		return runtime_removeWrapper;
	}

	// Install remove wrappers
	if (proto.off) proto.off = runtime_createRemoveWrapper(origOff);
	proto.removeListener = runtime_createRemoveWrapper(origRem);

	// Optional: also patch removeAllListeners to clear our maps
	const origRemoveAll = proto.removeAllListeners;
	proto.removeAllListeners = function (event) {
		const res = origRemoveAll.call(this, event);
		if (this[kMap]) this[kMap] = new WeakMap();
		return res;
	};

	// Store original methods for potential restoration
	if (!originalMethods) {
		originalMethods = {
			on: origOn,
			once: origOnce,
			addListener: origAdd,
			prependListener: origPre,
			prependOnceListener: origPreO,
			off: origOff,
			removeListener: origRem,
			removeAllListeners: origRemoveAll
		};
	}
}

/**
 * Disable AsyncLocalStorage context propagation for EventEmitter instances.
 *
 * @function disableAlsForEventEmitters
 * @package
 *
 * @description
 * Restores original EventEmitter methods, removing the AsyncLocalStorage
 * context propagation. This should be called during cleanup to prevent
 * hanging AsyncResource instances that can keep the event loop alive.
 *
 * @example
 * // Disable ALS patching during shutdown
 * disableAlsForEventEmitters();
 */
/**
 * Clean up ALL listeners that went through slothlet's EventEmitter patching.
 *
 * @function cleanupAllSlothletListeners
 * @package
 *
 * @description
 * Removes all event listeners that were registered through slothlet's patched
 * EventEmitter methods. This includes listeners from third-party libraries
 * that got wrapped with AsyncResource instances. This nuclear cleanup option
 * should be called during shutdown to prevent hanging listeners.
 *
 * @example
 * // Clean up all patched listeners during shutdown
 * cleanupAllSlothletListeners();
 */
export function cleanupAllSlothletListeners() {
	let cleanedCount = 0;
	let errorCount = 0;

	// Remove all tracked listeners from their emitters
	for (const listenerInfo of allPatchedListeners) {
		try {
			const { emitter, event, wrappedListener } = listenerInfo;
			if (emitter && typeof emitter.removeListener === "function") {
				emitter.removeListener(event, wrappedListener);
				cleanedCount++;
			}
		} catch (_) {
			errorCount++;
			// Continue cleaning up other listeners even if one fails
		}
	}

	// Clear all tracking data
	allPatchedListeners.clear();
	// globalListenerTracker will be cleaned up automatically

	if (process.env.SLOTHLET_DEBUG === "1" || process.env.SLOTHLET_DEBUG === "true") {
		console.log(`[slothlet] Cleaned up ${cleanedCount} listeners (${errorCount} errors)`);
	}
}

export function disableAlsForEventEmitters() {
	const kPatched = Symbol.for("slothlet.als.patched");

	if (!EventEmitter.prototype[kPatched] || !originalMethods) return;

	// Clean up all slothlet listeners first
	cleanupAllSlothletListeners();

	// Clean up all tracked AsyncResource instances
	for (const resource of globalResourceSet) {
		try {
			resource.emitDestroy();
		} catch (err) {
			// Ignore individual cleanup errors but continue
			console.warn("[slothlet] AsyncResource cleanup warning:", err.message);
		}
	}
	globalResourceSet.clear();

	// Restore original methods
	const proto = EventEmitter.prototype;
	proto.on = originalMethods.on;
	proto.once = originalMethods.once;
	proto.addListener = originalMethods.addListener;
	if (originalMethods.prependListener) proto.prependListener = originalMethods.prependListener;
	if (originalMethods.prependOnceListener) proto.prependOnceListener = originalMethods.prependOnceListener;
	if (originalMethods.off) proto.off = originalMethods.off;
	proto.removeListener = originalMethods.removeListener;
	proto.removeAllListeners = originalMethods.removeAllListeners;

	// Clear the patched flag
	delete EventEmitter.prototype[kPatched];

	// Clear stored references
	originalMethods = null;
}
