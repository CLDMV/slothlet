/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/eventtarget-context.mjs
 *	@Date: 2026-07-30T12:00:00-07:00 (1785438000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:52-07:00 (1791090892)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Carries the registering module's context across `EventTarget` listeners.
 * @module @cldmv/slothlet/helpers/eventtarget-context
 * @internal
 *
 * @description
 * `EventTarget` is the event boundary a browser actually uses, and the `EventEmitter` patch says
 * nothing about it. A listener runs after the call that registered it has returned, which costs both
 * runtimes something different:
 *
 * - **async** — the AsyncLocalStorage store is gone, so `self` inside a listener throws
 *   `RUNTIME_NO_ACTIVE_CONTEXT_SELF`. Capturing an `AsyncResource` at registration restores it, the
 *   same fix `EventEmitter` already gets.
 * - **live** — the caller field has unwound, and enforcement reads an absent caller as host-initiated
 *   and exempt. So a module reached denied targets from inside a listener the host dispatched.
 *
 * Both come from the same root cause and both are fixed by capturing at registration, which is the
 * only point where the information exists.
 *
 * Wrapping a listener has a cost the patch has to pay back: the DOM identifies a listener by its
 * callback reference, so `removeEventListener(type, original)` has to keep working, and a repeated
 * `addEventListener` with the same `(type, callback, capture)` triple has to stay the no-op the spec
 * promises. Both are handled by tracking the wrapper per triple and reusing it.
 *
 * This closes the boundary for cooperative code. It is not a sandbox — a module can reach an
 * unpatched `addEventListener` through another realm (an iframe's `contentWindow`). See
 * `docs/PERMISSIONS.md` on what the live runtime does and does not bound.
 */

import { AsyncResource } from "@cldmv/slothlet/helpers/platform";
import { pinToCurrentCaller } from "@cldmv/slothlet/helpers/caller-pinning";
import { openLayer, markLayer, closeLayer, holdsValue } from "@cldmv/slothlet/helpers/boundary-patch-layers";

/**
 * Wrappers in use, per target.
 *
 * Shape: `WeakMap<target, Map<"type capture", Map<listener, wrapper>>>`. One wrapper per
 * `(type, callback, capture)` triple, which is exactly how the DOM identifies a listener — so a
 * repeated `addEventListener` finds the existing wrapper and the DOM discards the duplicate, and
 * `removeEventListener` can resolve the original back to what was actually attached. Weak on the
 * target so tracking never keeps a detached node alive.
 *
 * @type {WeakMap<object, Map<string, Map<object, Function>>>}
 * @private
 */
const wrappers = new WeakMap();

/**
 * The original methods and the patches installed over them, so {@link disableEventTargetPatching}
 * can put back only what it actually replaced.
 * @type {Map<string, {layer: {active: boolean, below: Function}, patch: Function}>}
 * @private
 */
const originalMethods = new Map();

/**
 * Whether `EventTarget.prototype` is currently patched.
 * @type {boolean}
 * @private
 */
let isPatchingEnabled = false;

/**
 * Build the tracking key for a listener triple.
 *
 * The third `addEventListener` argument is either a boolean capture flag or an options object, and
 * the capture flag is part of a listener's identity — the same callback registered with and without
 * capture is two listeners.
 *
 * @param {string} type - Event type.
 * @param {boolean|object} [options] - Capture flag or listener options.
 * @returns {string} Key combining type and capture.
 * @private
 */
function runtime_trackingKey(type, options) {
	const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
	return `${String(type)}\u0000${capture ? "1" : "0"}`;
}

/**
 * Wrap a listener so it runs in the context that registered it.
 *
 * Handles both listener forms the DOM accepts. The object form's `handleEvent` is looked up at
 * dispatch time rather than captured, matching the spec — consumers do swap it between events.
 *
 * @param {Function|object} listener - Listener being registered.
 * @returns {Function} Wrapper to attach in its place.
 * @private
 */
function runtime_wrapListener(listener) {
	// Restores the AsyncLocalStorage store active right now when the listener later runs. Null in a
	// browser, where `async_hooks` does not exist — there the pinning below is the whole mechanism.
	// Browser arm: without `async_hooks` there is nothing to capture, and the pinning below is the whole
	// mechanism. Not takeable from a Node run for the same reason as the EventEmitter helper.
	/* v8 ignore next */
	const resource = AsyncResource ? new AsyncResource("slothlet-event-target-listener") : null;

	// Bind to whoever is registering, for the runtime the AsyncResource capture does not serve. Done
	// here because this is when the registering module is the executing one.
	const invoke =
		typeof listener === "function"
			? pinToCurrentCaller(listener)
			: pinToCurrentCaller(function (event) {
					return listener.handleEvent(event);
				});

	const runtime_wrappedListener = function (event) {
		/* v8 ignore next — the no-AsyncResource (browser) path; see the capture above. */
		if (!resource) return invoke.call(this, event);
		return resource.runInAsyncScope(() => invoke.call(this, event), this);
	};

	runtime_wrappedListener._slothletOriginal = listener;
	return runtime_wrappedListener;
}

/**
 * Whether this listener needs wrapping at all.
 *
 * @param {*} listener - Value passed as the listener.
 * @returns {boolean} True when it is a listener worth wrapping.
 * @private
 */
function runtime_shouldWrap(listener) {
	// `null` is legal and ignored by the DOM; anything else non-listener-shaped is the host's problem
	// to reject, and passing it through unchanged keeps that error identical to the unpatched one.
	if (typeof listener === "function") return !listener._slothletOriginal;
	if (listener && typeof listener.handleEvent === "function") return true;
	return false;
}

/**
 * Patch `addEventListener` to attach a context-restoring wrapper.
 * @returns {void}
 * @private
 */
function runtime_patchAdd() {
	// Shared with any other copy of slothlet in the realm (see boundary-patch-layers).
	const layer = openLayer(EventTarget.prototype.addEventListener);
	const original = layer.below;

	const patch = function (type, listener, options) {
		// Disabled under another copy's patch: register as given.
		if (!layer.active || !runtime_shouldWrap(listener)) return original.call(this, type, listener, options);

		const key = runtime_trackingKey(type, options);
		let byKey = wrappers.get(this);
		if (!byKey) {
			byKey = new Map();
			wrappers.set(this, byKey);
		}
		let byListener = byKey.get(key);
		if (!byListener) {
			byListener = new Map();
			byKey.set(key, byListener);
		}

		// Reuse the existing wrapper for a repeated registration. A fresh one would be a different
		// reference, so the DOM would treat it as a second listener and the callback would run twice
		// where the spec says the duplicate is ignored.
		let wrapper = byListener.get(listener);
		if (!wrapper) {
			wrapper = runtime_wrapListener(listener);
			byListener.set(listener, wrapper);
		}

		return original.call(this, type, wrapper, options);
	};

	markLayer(patch, layer);
	EventTarget.prototype.addEventListener = patch;
	originalMethods.set("addEventListener", { layer, patch });
}

/**
 * Patch `removeEventListener` to resolve the original listener back to its wrapper.
 * @returns {void}
 * @private
 */
function runtime_patchRemove() {
	const layer = openLayer(EventTarget.prototype.removeEventListener);
	const original = layer.below;

	// Not gated on the layer: a listener this copy wrapped while active must still resolve back to its
	// wrapper after the copy disabled, or it could never be removed.
	const patch = function (type, listener, options) {
		const byKey = wrappers.get(this);
		const byListener = byKey?.get(runtime_trackingKey(type, options));
		const wrapper = byListener?.get(listener);
		if (!wrapper) return original.call(this, type, listener, options);

		byListener.delete(listener);
		return original.call(this, type, wrapper, options);
	};

	markLayer(patch, layer);
	EventTarget.prototype.removeEventListener = patch;
	originalMethods.set("removeEventListener", { layer, patch });
}

/**
 * Enable context propagation through `EventTarget` listeners.
 *
 * Called once globally when the first instance is created; later calls are ignored, matching how
 * EventEmitter patching behaves.
 *
 * @returns {void}
 * @public
 */
export function enableEventTargetPatching() {
	// A host without a global `EventTarget` has no boundary to patch. Both Node and every browser
	// provide one, so this is purely a guard against an exotic embedder.
	/* v8 ignore next */
	if (typeof EventTarget !== "function") return;
	if (isPatchingEnabled) return;

	runtime_patchAdd();
	runtime_patchRemove();

	isPatchingEnabled = true;
}

/**
 * Restore the original `EventTarget` methods.
 *
 * Restores a method only when the patch installed here is still in place, so anything that replaced
 * it afterwards keeps ownership of its own restore. A patch left in place passes through from then
 * on, and a restore puts back what is under every such patch (see boundary-patch-layers).
 *
 * @returns {void}
 * @public
 */
export function disableEventTargetPatching() {
	if (!isPatchingEnabled) return;

	for (const [name, { layer, patch }] of originalMethods.entries()) {
		const restore = closeLayer(layer);
		if (holdsValue(EventTarget.prototype, name, patch)) EventTarget.prototype[name] = restore;
	}

	originalMethods.clear();
	isPatchingEnabled = false;
}
