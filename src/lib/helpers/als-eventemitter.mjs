/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/als-eventemitter.mjs
 *	@Date: 2025-10-21 16:21:05 -07:00 (1761088865)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-21 16:26:51 -07:00 (1761089211)
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
 * import { enableAlsForEventEmitters } from '@cldmv/slothlet/helpers/als-eventemitter';
 *
 * @example
 * // CJS usage
 * const { enableAlsForEventEmitters } = require('@cldmv/slothlet/helpers/als-eventemitter');
 */

import { AsyncLocalStorage, AsyncResource } from "node:async_hooks";
import { EventEmitter } from "node:events";

/**
 * Enable AsyncLocalStorage context propagation for all EventEmitter instances.
 *
 * @function enableAlsForEventEmitters
 * @package
 * @param {import('node:async_hooks').AsyncLocalStorage} [als] - The AsyncLocalStorage instance to use
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
 * import { enableAlsForEventEmitters } from './als-eventemitter.mjs';
 * enableAlsForEventEmitters(als);
 */
export function enableAlsForEventEmitters(als = new AsyncLocalStorage()) {
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
}
