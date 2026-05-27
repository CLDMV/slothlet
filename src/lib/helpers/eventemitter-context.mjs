/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/eventemitter-context.mjs
 *	@Date: 2026-01-29 11:42:31 -08:00 (1738180951)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:38 -08:00 (1772425298)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview EventEmitter context propagation via AsyncResource wrapping
 *
 * @description
 * Node.js EventEmitter does NOT automatically propagate AsyncLocalStorage context
 * to event listeners. This module patches EventEmitter.prototype methods to wrap
 * all listeners with AsyncResource, preserving the context where they were registered.
 *
 * Additionally tracks EventEmitters created within slothlet API context so they can
 * be cleaned up on shutdown.
 *
 * @module @cldmv/slothlet/helpers/eventemitter-context
 * @internal
 */
import { EventEmitter } from "node:events";
import { AsyncResource } from "node:async_hooks";

/**
 * Callback to check if we're currently in a slothlet API context
 * Set by the runtime (async or live) during initialization
 * @type {Function|null}
 * @private
 */
let isInApiContext = null;

/**
 * Set the context checker callback
 * Called by the runtime to register a way to detect API context
 * @param {Function} checker - Function that returns true if in API context
 * @public
 */
export function setApiContextChecker(checker) {
	isInApiContext = checker;
}

/**
 * Storage for original EventEmitter methods
 * @type {Map<string, Function>}
 * @private
 */
const originalMethods = new Map();

/**
 * Storage for wrapped listeners per emitter.
 *
 * Shape: `Map<emitter, Map<event, Map<originalListener, wrappedListener[]>>>`
 *
 * The innermost value is an ARRAY of wrappers per (emitter, event, originalListener)
 * triple — not a single wrapper. Node's `EventEmitter` allows the same listener
 * reference to be added multiple times to the same event via repeated `on()` calls;
 * each registration must be removed by a corresponding `removeListener()` call.
 *
 * Pre-fix this map stored a single wrapper per triple, so a second `on(event, fn)`
 * call would overwrite the tracking entry for the first one — leaking the first
 * wrapper onto the emitter (un-removable through the patched `removeListener` since
 * tracking no longer knew about it). That was the source of the
 * `MaxListenersExceededWarning` symptom in long-lived connection-pool clients
 * (node-redis, smithy HTTP handler) that re-register error handlers across
 * connection-recovery cycles.
 *
 * @type {Map<EventEmitter, Map<string, Map<Function, Function[]>>>}
 * @private
 */
const wrappedListeners = new Map();

/**
 * Set of EventEmitters created within slothlet API context
 * These will be cleaned up on shutdown
 * @type {Set<EventEmitter>}
 * @private
 */
const trackedEmitters = new Set();

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
 * Get or create listener tracking structure for an emitter.
 *
 * The innermost map value is an ARRAY of wrappers per (event, originalListener),
 * not a single wrapper. Node's `EventEmitter` allows the same listener to be
 * registered multiple times via repeated `on()`; each registration gets its
 * own wrapper entry. See the `wrappedListeners` JSDoc for the rationale.
 *
 * @param {EventEmitter} emitter - EventEmitter instance
 * @returns {Map<string, Map<Function, Function[]>>} Tracking structure
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
 * Track a wrapped listener for cleanup. Appends to the per-(emitter, event, original)
 * wrapper array — preserves Node's "same listener registered N times → N entries"
 * semantic so that N `removeListener` calls can each remove one wrapper.
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

	let wrappers = eventTracking.get(originalListener);
	if (!wrappers) {
		wrappers = [];
		eventTracking.set(originalListener, wrappers);
	}
	wrappers.push(wrappedListener);
}

/**
 * Get the most-recently-tracked wrapped listener for an original. Returns the
 * LAST entry in the wrappers array so removal matches Node's `removeListener`
 * behavior (which iterates backwards from the end of the listener list).
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

	const wrappers = eventTracking.get(originalListener);
	if (!wrappers || wrappers.length === 0) return undefined;
	return wrappers[wrappers.length - 1];
}

/**
 * Untrack and cleanup ONE wrapped listener for an original (LIFO — matches
 * `runtime_getWrappedListener`'s pick). Used by `removeListener` after the
 * underlying `original.removeListener(event, wrapped)` succeeded.
 *
 * @param {EventEmitter} emitter - EventEmitter instance
 * @param {string} event - Event name
 * @param {Function} originalListener - Original listener function
 * @private
 */
function runtime_untrackListener(emitter, event, originalListener) {
	const emitterTracking = wrappedListeners.get(emitter);
	// Defensive: emitter is always registered before untrack is called.
	// A missing emitter entry would require untracking a listener that was never tracked.
	/* v8 ignore next */
	if (!emitterTracking) return;

	const eventTracking = emitterTracking.get(event);
	if (!eventTracking) return;

	const wrappers = eventTracking.get(originalListener);
	if (!wrappers || wrappers.length === 0) return;

	const wrappedListener = wrappers.pop();
	// Cleanup AsyncResource reference (_slothletResource is always set by runtime_wrapEventListener)
	wrappedListener._slothletResource = null;

	if (wrappers.length === 0) {
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
 * Untrack a SPECIFIC wrapper by identity (not by original-listener LIFO). Used
 * by the auto-cleanup inside `runtime_onceWrapper` — the once-wrapper has a
 * closure-captured reference to itself and must remove exactly that wrapper
 * from tracking, not just any wrapper for the same original (which would be
 * wrong when both `on(event, fn)` and `once(event, fn)` share an original
 * listener).
 *
 * @param {EventEmitter} emitter - EventEmitter instance
 * @param {string} event - Event name
 * @param {Function} originalListener - Original listener function (key into the wrappers array)
 * @param {Function} wrappedListener - The exact wrapper reference to remove
 * @private
 */
function runtime_untrackSpecificWrapper(emitter, event, originalListener, wrappedListener) {
	const emitterTracking = wrappedListeners.get(emitter);
	if (!emitterTracking) return;

	const eventTracking = emitterTracking.get(event);
	if (!eventTracking) return;

	const wrappers = eventTracking.get(originalListener);
	if (!wrappers || wrappers.length === 0) return;

	const idx = wrappers.indexOf(wrappedListener);
	if (idx === -1) return;

	wrappers.splice(idx, 1);
	wrappedListener._slothletResource = null;

	if (wrappers.length === 0) {
		eventTracking.delete(originalListener);
	}
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
 * Track an EventEmitter if it was created within slothlet API context
 * @param {EventEmitter} emitter - EventEmitter instance to potentially track
 * @private
 */
function runtime_maybeTrackEmitter(emitter) {
	// Only track if context checker is registered and returns true
	if (isInApiContext && isInApiContext()) {
		trackedEmitters.add(emitter);
	}
}

/**
 * Patch EventEmitter.prototype.on and addListener
 * @private
 */
function runtime_patchOn() {
	const original = EventEmitter.prototype.on;
	originalMethods.set("on", original);

	EventEmitter.prototype.on = function (event, listener) {
		// Track this emitter if created in slothlet context
		runtime_maybeTrackEmitter(this);

		if (!runtime_shouldWrapListener(listener)) {
			return original.call(this, event, listener);
		}

		const wrapped = runtime_wrapEventListener(listener);
		runtime_trackListener(this, event, listener, wrapped);
		return original.call(this, event, wrapped);
	};

	// Alias: addListener = on
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
		// Track this emitter if created in slothlet context
		runtime_maybeTrackEmitter(this);

		if (!runtime_shouldWrapListener(listener)) {
			return original.call(this, event, listener);
		}

		const wrapped = runtime_wrapEventListener(listener);

		// Wrap again to add auto-cleanup after first execution. The wrapper
		// removes ITSELF from tracking by identity — NOT by original-listener
		// LIFO — so that mixing `on(event, fn)` + `once(event, fn)` cleans up
		// the once-wrapper specifically rather than popping whichever wrapper
		// happened to be most recently added for `fn`.
		const runtime_onceWrapper = function (...args) {
			const result = wrapped.apply(this, args);
			runtime_untrackSpecificWrapper(this, event, listener, runtime_onceWrapper);
			return result;
		};

		// Copy metadata
		runtime_onceWrapper._slothletOriginal = listener;
		runtime_onceWrapper._slothletResource = wrapped._slothletResource;

		runtime_trackListener(this, event, listener, runtime_onceWrapper);
		return original.call(this, event, runtime_onceWrapper);
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
		// Track this emitter if created in slothlet context
		runtime_maybeTrackEmitter(this);

		if (!runtime_shouldWrapListener(listener)) {
			return original.call(this, event, listener);
		}

		const wrapped = runtime_wrapEventListener(listener);
		runtime_trackListener(this, event, listener, wrapped);
		return original.call(this, event, wrapped);
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
		// Track this emitter if created in slothlet context
		runtime_maybeTrackEmitter(this);

		if (!runtime_shouldWrapListener(listener)) {
			return original.call(this, event, listener);
		}

		const wrapped = runtime_wrapEventListener(listener);

		// Wrap again to add auto-cleanup after first execution. Identity-based
		// cleanup (see `runtime_patchOnce` for the rationale).
		const runtime_onceWrapper = function (...args) {
			const result = wrapped.apply(this, args);
			runtime_untrackSpecificWrapper(this, event, listener, runtime_onceWrapper);
			return result;
		};

		// Copy metadata
		runtime_onceWrapper._slothletOriginal = listener;
		runtime_onceWrapper._slothletResource = wrapped._slothletResource;

		runtime_trackListener(this, event, listener, runtime_onceWrapper);
		return original.call(this, event, runtime_onceWrapper);
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
		// Cleanup tracking for removed listeners. The innermost map value is
		// now an ARRAY of wrappers per original-listener (see `wrappedListeners`
		// doc above) — iterate each array and null out every entry's AsyncResource.
		const emitterTracking = wrappedListeners.get(this);
		if (emitterTracking) {
			if (event === undefined) {
				// Remove all events
				for (const [____evt, eventTracking] of emitterTracking.entries()) {
					for (const wrappers of eventTracking.values()) {
						for (const wrappedListener of wrappers) {
							// _slothletResource is always set by runtime_wrapEventListener
							wrappedListener._slothletResource = null;
						}
					}
				}
				wrappedListeners.delete(this);
			} else {
				// Remove specific event
				const eventTracking = emitterTracking.get(event);
				if (eventTracking) {
					for (const wrappers of eventTracking.values()) {
						for (const wrappedListener of wrappers) {
							// _slothletResource is always set by runtime_wrapEventListener
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
 * Cleanup all tracked EventEmitters created within slothlet API context.
 * This removes all listeners from tracked emitters and clears tracking structures.
 * Should be called during shutdown to prevent memory leaks and hanging processes.
 *
 * @public
 */
export function cleanupEventEmitterResources() {
	// Clean up all listeners on tracked emitters
	for (const emitter of trackedEmitters) {
		try {
			// Remove all listeners from this emitter
			emitter.removeAllListeners();
		} catch (____error) {
			// Silently ignore errors (emitter may already be destroyed)
		}
	}

	// Clear tracking structures
	trackedEmitters.clear();
	wrappedListeners.clear();
}
