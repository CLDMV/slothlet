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
// Node-only: this module patches EventEmitter.prototype to propagate ALS context to listeners —
// meaningless in a browser. Gated so node:events/node:async_hooks stay out of the browser static
// graph (#123); the exported patching entry points no-op when EventEmitter is null.
import { EventEmitter, AsyncResource } from "@cldmv/slothlet/helpers/platform";

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
	// `wrappers.length === 0` is unreachable: runtime_untrackListener (below)
	// deletes the originalListener key atomically when the list empties, so
	// a subsequent get() returns undefined and the `!wrappers` arm fires first.
	/* v8 ignore next */
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

	// Defensive: `eventTracking` and a non-empty `wrappers` list are guaranteed
	// by the runtime contract — the cleanup logic below atomically deletes
	// keys/maps when emptied, and untrack is only called paired with a
	// preceding track. The early-return arms are kept for safety but are
	// unreachable in normal flow.
	const eventTracking = emitterTracking.get(event);
	/* v8 ignore next */
	if (!eventTracking) return;

	const wrappers = eventTracking.get(originalListener);
	/* v8 ignore next */
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
	// Defensive: the once-wrapper that calls this always tracked its emitter first, so an
	// untracked emitter never reaches here — same unreachable-by-construction reasoning as the
	// two sibling guards below (272, 276), which are already ignored.
	/* v8 ignore next */
	if (!emitterTracking) return;

	// Defensive early-returns: cleanup downstream atomically deletes empty
	// entries, so by the time this function is called these maps either still
	// contain the wrapper or the entry has already been removed (returning
	// undefined from .get(), hitting the `!eventTracking` / `!wrappers` arms
	// of the OR). The `length === 0` arms are unreachable for the same reason.
	const eventTracking = emitterTracking.get(event);
	/* v8 ignore next */
	if (!eventTracking) return;

	const wrappers = eventTracking.get(originalListener);
	/* v8 ignore next */
	if (!wrappers || wrappers.length === 0) return;

	const idx = wrappers.indexOf(wrappedListener);
	// Unreachable: the once-wrapper holds a closure-captured reference to its
	// exact wrapped function — by the time it calls untrack, the wrapper is
	// guaranteed to be in the array (or the whole entry has been cleaned up
	// already, hitting the !wrappers arm above).
	/* v8 ignore next */
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
 *
 * We do NOT delegate to native `EventEmitter.prototype.once` here. Native
 * `once` internally calls `this.on(event, _onceWrap(...))`, and `this.on`
 * routes through the PATCHED prototype `on` — which sees the fresh
 * `_onceWrap_output` (no `_slothletOriginal` marker), wraps it AGAIN as a
 * second listener (call it `L2`), and attaches `L2` to the listener array.
 * The tracking map ends up with `userFn → runtime_onceWrapper` (from this
 * patch) but the listener array holds `L2`, so a subsequent
 * `removeListener(event, userFn)` resolves to `runtime_onceWrapper`, tells
 * native `removeListener` to remove THAT, and the ref-equality scan misses
 * `L2`. Removal silently no-ops; the wrapper stays attached.
 *
 * Field symptom: `@redis/client`'s socket layer does
 * `socket.once('timeout', fn) + socket.removeListener('timeout', fn)` to
 * install a transient connect-timeout listener. Under the buggy delegation
 * the remove no-ops, the lingering wrapper stays armed, and the TCP idle
 * timer fires ~5s after handshake → `socket.destroy` → reconnect loop
 * every 5–8s.
 *
 * Fix: implement once semantics directly — attach via the saved-original
 * `on` (skips the patched-on double-wrap), auto-cleanup via the saved-
 * original `removeListener` (skips the patched-removeListener re-entry),
 * and set `.listener = userFn` on the wrapper to mirror Node's contract
 * for libraries that introspect `rawListeners()[i].listener`.
 *
 * @private
 */
function runtime_patchOnce() {
	const original = EventEmitter.prototype.once;
	originalMethods.set("once", original);

	// Capture the saved-original `on` and `removeListener` at patch time.
	// `on` is patched before `once` (see enableEventEmitterPatching ordering)
	// so originalMethods.get("on") is always populated; the ?? fallback only
	// fires if the patch order changes in the future. `removeListener` is
	// patched AFTER `once`, so the fallback to the current prototype value
	// (still the unpatched native at this point) is the normal path there.
	/* v8 ignore next */
	const originalOn = originalMethods.get("on") ?? EventEmitter.prototype.on;
	const originalRemove = originalMethods.get("removeListener") ?? EventEmitter.prototype.removeListener;

	EventEmitter.prototype.once = function (event, listener) {
		// Track this emitter if created in slothlet context
		runtime_maybeTrackEmitter(this);

		if (!runtime_shouldWrapListener(listener)) {
			return original.call(this, event, listener);
		}

		const wrapped = runtime_wrapEventListener(listener);
		const self = this;

		// Once-wrapper: detach via saved-original removeListener (no re-entry
		// into the patched path), then drop our tracking entry, then call the
		// user's wrapped fn. Identity-based untrack matches mixed on+once.
		const runtime_onceWrapper = function (...args) {
			originalRemove.call(self, event, runtime_onceWrapper);
			runtime_untrackSpecificWrapper(self, event, listener, runtime_onceWrapper);
			return wrapped.apply(this, args);
		};

		// Metadata for slothlet tracking + Node's introspection contract.
		runtime_onceWrapper._slothletOriginal = listener;
		runtime_onceWrapper._slothletResource = wrapped._slothletResource;
		runtime_onceWrapper.listener = listener;

		runtime_trackListener(this, event, listener, runtime_onceWrapper);
		// Attach via saved-original `on` to avoid the patched-on double-wrap.
		return originalOn.call(this, event, runtime_onceWrapper);
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
 *
 * Same delegation pitfall as `runtime_patchOnce` — native
 * `prependOnceListener` internally calls `this.prependListener(...)` which
 * routes through the patched prototype and double-wraps. Same fix shape:
 * attach via saved-original `prependListener`, auto-cleanup via saved-
 * original `removeListener`, set `.listener = userFn`.
 *
 * @private
 */
function runtime_patchPrependOnceListener() {
	const original = EventEmitter.prototype.prependOnceListener;
	originalMethods.set("prependOnceListener", original);

	// `prependListener` is patched before `prependOnceListener` in
	// enableEventEmitterPatching, so the ?? fallback is unreachable in the
	// normal patch order; it only fires if the patch order changes.
	/* v8 ignore next */
	const originalPrepend = originalMethods.get("prependListener") ?? EventEmitter.prototype.prependListener;
	const originalRemove = originalMethods.get("removeListener") ?? EventEmitter.prototype.removeListener;

	EventEmitter.prototype.prependOnceListener = function (event, listener) {
		// Track this emitter if created in slothlet context
		runtime_maybeTrackEmitter(this);

		if (!runtime_shouldWrapListener(listener)) {
			return original.call(this, event, listener);
		}

		const wrapped = runtime_wrapEventListener(listener);
		const self = this;

		const runtime_onceWrapper = function (...args) {
			originalRemove.call(self, event, runtime_onceWrapper);
			runtime_untrackSpecificWrapper(self, event, listener, runtime_onceWrapper);
			return wrapped.apply(this, args);
		};

		runtime_onceWrapper._slothletOriginal = listener;
		runtime_onceWrapper._slothletResource = wrapped._slothletResource;
		runtime_onceWrapper.listener = listener;

		runtime_trackListener(this, event, listener, runtime_onceWrapper);
		// Attach via saved-original `prependListener` to avoid double-wrap.
		return originalPrepend.call(this, event, runtime_onceWrapper);
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
	// Browser host: no node:events EventEmitter to patch — exercised by the vitest browser compose.
	if (!EventEmitter) return;
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
	/* v8 ignore start - browser-only: nothing patched without node:events */
	if (!EventEmitter) return;
	/* v8 ignore stop */
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
	/* v8 ignore start - browser-only: nothing tracked without node:events */
	if (!EventEmitter) return;
	/* v8 ignore stop */
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
