/**
 * @fileoverview EventEmitter context propagation via AsyncResource wrapping
 *
 * @description
 * Node.js EventEmitter does NOT automatically propagate AsyncLocalStorage context
 * to event listeners. This module patches EventEmitter.prototype methods to wrap
 * all listeners with AsyncResource, preserving the context where they were registered.
 *
 * @module @cldmv/slothlet/helpers/eventemitter-context
 */
import { EventEmitter } from "node:events";
import { AsyncResource } from "node:async_hooks";

/**
 * Storage for original EventEmitter methods
 * @type {Map<string, Function>}
 * @private
 */
const originalMethods = new Map();

/**
 * Storage for wrapped listeners per emitter
 * WeakMap<emitter, Map<event, Map<originalListener, wrappedListener>>>
 * @type {WeakMap}
 * @private
 */
const wrappedListeners = new WeakMap();

/**
 * Whether EventEmitter patching is currently enabled
 * @type {boolean}
 * @private
 */
let isPatchingEnabled = false;

/**
 * Wrap an event listener to preserve AsyncLocalStorage context.
 * The key insight: We don't need to pass contextManager/instanceID explicitly.
 * AsyncResource.runInAsyncScope() automatically restores the ALS context that
 * was active when the AsyncResource was created.
 *
 * @param {Function} listener - Original listener function
 * @returns {Function} Wrapped listener that preserves context
 * @private
 */
function runtime_wrapEventListener(listener) {
	// Create AsyncResource to capture the CURRENT ALS context at registration time
	const resource = new AsyncResource("slothlet-event-listener");

	// Create wrapped listener that executes within captured context
	const runtime_wrappedListener = function (...args) {
		// AsyncResource.runInAsyncScope() automatically restores the ALS context
		// that was active when the resource was created, no need for explicit contextManager!
		return resource.runInAsyncScope(() => {
			return listener.apply(this, args);
		}, this);
	};

	// Attach metadata for cleanup and identification
	runtime_wrappedListener._slothletOriginal = listener;
	runtime_wrappedListener._slothletResource = resource;

	return runtime_wrappedListener;
}

/**
 * Get or create listener tracking structure for an emitter
 * @param {EventEmitter} emitter - EventEmitter instance
 * @returns {Map<string, Map<Function, Function>>} Tracking structure
 * @private
 */
function runtime_getListenerTracking(emitter) {
	let emitterTracking = wrappedListeners.get(emitter);
	if (!emitterTracking) {
		emitterTracking = new Map();
		wrappedListeners.set(emitter, emitterTracking);
	}
	return emitterTracking;
}

/**
 * Track a wrapped listener for cleanup
 * @param {EventEmitter} emitter - EventEmitter instance
 * @param {string} event - Event name
 * @param {Function} originalListener - Original listener function
 * @param {Function} wrappedListener - Wrapped listener function
 * @private
 */
function runtime_trackListener(emitter, event, originalListener, wrappedListener) {
	const emitterTracking = runtime_getListenerTracking(emitter);

	let eventTracking = emitterTracking.get(event);
	if (!eventTracking) {
		eventTracking = new Map();
		emitterTracking.set(event, eventTracking);
	}

	eventTracking.set(originalListener, wrappedListener);
}

/**
 * Get wrapped listener for an original listener
 * @param {EventEmitter} emitter - EventEmitter instance
 * @param {string} event - Event name
 * @param {Function} originalListener - Original listener function
 * @returns {Function|undefined} Wrapped listener or undefined
 * @private
 */
function runtime_getWrappedListener(emitter, event, originalListener) {
	const emitterTracking = wrappedListeners.get(emitter);
	if (!emitterTracking) return undefined;

	const eventTracking = emitterTracking.get(event);
	if (!eventTracking) return undefined;

	return eventTracking.get(originalListener);
}

/**
 * Untrack and cleanup a wrapped listener
 * @param {EventEmitter} emitter - EventEmitter instance
 * @param {string} event - Event name
 * @param {Function} originalListener - Original listener function
 * @private
 */
function runtime_untrackListener(emitter, event, originalListener) {
	const emitterTracking = wrappedListeners.get(emitter);
	if (!emitterTracking) return;

	const eventTracking = emitterTracking.get(event);
	if (!eventTracking) return;

	const wrappedListener = eventTracking.get(originalListener);
	if (wrappedListener) {
		// Cleanup AsyncResource reference
		if (wrappedListener._slothletResource) {
			wrappedListener._slothletResource = null;
		}
		eventTracking.delete(originalListener);
	}

	// Cleanup empty maps
	if (eventTracking.size === 0) {
		emitterTracking.delete(event);
	}
	if (emitterTracking.size === 0) {
		wrappedListeners.delete(emitter);
	}
}

/**
 * Check if a listener should be wrapped
 * @param {Function} listener - Listener function to check
 * @returns {boolean} True if listener should be wrapped
 * @private
 */
function runtime_shouldWrapListener(listener) {
	// Don't wrap if not a function
	if (typeof listener !== "function") return false;

	// Don't double-wrap
	if (listener._slothletOriginal) return false;

	return true;
}

/**
 * Patch EventEmitter.prototype.on and addListener
 * @private
 */
function runtime_patchOn() {
	const original = EventEmitter.prototype.on;
	originalMethods.set("on", original);

	EventEmitter.prototype.on = function (event, listener) {
		if (runtime_shouldWrapListener(listener)) {
			const wrapped = runtime_wrapEventListener(listener);
			runtime_trackListener(this, event, listener, wrapped);
			return original.call(this, event, wrapped);
		}
		return original.call(this, event, listener);
	};

	// addListener is an alias for on
	EventEmitter.prototype.addListener = EventEmitter.prototype.on;
}

/**
 * Patch EventEmitter.prototype.once
 * @private
 */
function runtime_patchOnce() {
	const original = EventEmitter.prototype.once;
	originalMethods.set("once", original);

	EventEmitter.prototype.once = function (event, listener) {
		if (runtime_shouldWrapListener(listener)) {
			const wrapped = runtime_wrapEventListener(listener);

			// Wrap again to add auto-cleanup after first execution
			const runtime_onceWrapper = function (...args) {
				const result = wrapped.apply(this, args);
				// Auto-cleanup after execution
				runtime_untrackListener(this, event, listener);
				return result;
			};

			// Copy metadata
			runtime_onceWrapper._slothletOriginal = listener;
			runtime_onceWrapper._slothletResource = wrapped._slothletResource;

			runtime_trackListener(this, event, listener, runtime_onceWrapper);
			return original.call(this, event, runtime_onceWrapper);
		}
		return original.call(this, event, listener);
	};
}

/**
 * Patch EventEmitter.prototype.prependListener
 * @private
 */
function runtime_patchPrependListener() {
	const original = EventEmitter.prototype.prependListener;
	originalMethods.set("prependListener", original);

	EventEmitter.prototype.prependListener = function (event, listener) {
		if (runtime_shouldWrapListener(listener)) {
			const wrapped = runtime_wrapEventListener(listener);
			runtime_trackListener(this, event, listener, wrapped);
			return original.call(this, event, wrapped);
		}
		return original.call(this, event, listener);
	};
}

/**
 * Patch EventEmitter.prototype.prependOnceListener
 * @private
 */
function runtime_patchPrependOnceListener() {
	const original = EventEmitter.prototype.prependOnceListener;
	originalMethods.set("prependOnceListener", original);

	EventEmitter.prototype.prependOnceListener = function (event, listener) {
		if (runtime_shouldWrapListener(listener)) {
			const wrapped = runtime_wrapEventListener(listener);

			// Wrap again to add auto-cleanup after first execution
			const runtime_onceWrapper = function (...args) {
				const result = wrapped.apply(this, args);
				// Auto-cleanup after execution
				runtime_untrackListener(this, event, listener);
				return result;
			};

			// Copy metadata
			runtime_onceWrapper._slothletOriginal = listener;
			runtime_onceWrapper._slothletResource = wrapped._slothletResource;

			runtime_trackListener(this, event, listener, runtime_onceWrapper);
			return original.call(this, event, runtime_onceWrapper);
		}
		return original.call(this, event, listener);
	};
}

/**
 * Patch EventEmitter.prototype.removeListener and off
 * @private
 */
function runtime_patchRemoveListener() {
	const original = EventEmitter.prototype.removeListener;
	originalMethods.set("removeListener", original);

	EventEmitter.prototype.removeListener = function (event, listener) {
		// Look up the wrapped listener
		const wrapped = runtime_getWrappedListener(this, event, listener);
		if (wrapped) {
			// Remove the wrapped version
			const result = original.call(this, event, wrapped);
			// Cleanup tracking
			runtime_untrackListener(this, event, listener);
			return result;
		}
		// Not wrapped, remove as-is
		return original.call(this, event, listener);
	};

	// off is an alias for removeListener
	EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
}

/**
 * Patch EventEmitter.prototype.removeAllListeners
 * @private
 */
function runtime_patchRemoveAllListeners() {
	const original = EventEmitter.prototype.removeAllListeners;
	originalMethods.set("removeAllListeners", original);

	EventEmitter.prototype.removeAllListeners = function (event) {
		// Cleanup tracking for removed listeners
		const emitterTracking = wrappedListeners.get(this);
		if (emitterTracking) {
			if (event === undefined) {
				// Remove all events
				for (const [evt, eventTracking] of emitterTracking.entries()) {
					for (const wrappedListener of eventTracking.values()) {
						if (wrappedListener._slothletResource) {
							wrappedListener._slothletResource = null;
						}
					}
				}
				wrappedListeners.delete(this);
			} else {
				// Remove specific event
				const eventTracking = emitterTracking.get(event);
				if (eventTracking) {
					for (const wrappedListener of eventTracking.values()) {
						if (wrappedListener._slothletResource) {
							wrappedListener._slothletResource = null;
						}
					}
					emitterTracking.delete(event);
					if (emitterTracking.size === 0) {
						wrappedListeners.delete(this);
					}
				}
			}
		}

		return original.call(this, event);
	};
}

/**
 * Enable EventEmitter context propagation by patching EventEmitter.prototype.
 * This should be called ONCE globally when the first slothlet instance is created.
 * Subsequent calls will be ignored (patching is global).
 *
 * @public
 */
export function enableEventEmitterPatching() {
	if (isPatchingEnabled) {
		// Already enabled - this is normal when multiple instances exist
		return;
	}

	// Patch all EventEmitter methods
	runtime_patchOn();
	runtime_patchOnce();
	runtime_patchPrependListener();
	runtime_patchPrependOnceListener();
	runtime_patchRemoveListener();
	runtime_patchRemoveAllListeners();

	isPatchingEnabled = true;
}

/**
 * Disable EventEmitter context propagation and restore original methods.
 * This should only be called when ALL slothlet instances have been shut down.
 *
 * @public
 */
export function disableEventEmitterPatching() {
	if (!isPatchingEnabled) {
		return;
	}

	// Restore original methods
	for (const [methodName, originalMethod] of originalMethods.entries()) {
		EventEmitter.prototype[methodName] = originalMethod;

		// Restore aliases
		if (methodName === "on") {
			EventEmitter.prototype.addListener = originalMethod;
		} else if (methodName === "removeListener") {
			EventEmitter.prototype.off = originalMethod;
		}
	}

	originalMethods.clear();
	isPatchingEnabled = false;
}

/**
 * Cleanup all AsyncResource references for EventEmitters.
 * This should be called during shutdown to prevent memory leaks.
 *
 * Note: WeakMaps don't have .values() or .entries() methods - they automatically
 * garbage collect when emitters are destroyed. We can't iterate over a WeakMap,
 * so this function is a no-op. AsyncResources will be cleaned up when emitters
 * are garbage collected.
 *
 * @public
 */
export function cleanupEventEmitterResources() {
	// WeakMap doesn't support iteration - it automatically GCs when emitters are destroyed
	// AsyncResource cleanup happens automatically via garbage collection
	// This function is kept for API compatibility but doesn't need to do anything
}
