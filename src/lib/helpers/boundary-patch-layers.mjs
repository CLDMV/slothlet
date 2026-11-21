/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/boundary-patch-layers.mjs
 *	@Date: 2026-10-09T21:00:00-07:00 (1791604800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T11:23:41-08:00 (1794943421)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Realm-wide bookkeeping for the boundary patches, so several copies of slothlet can patch and unpatch in any order.
 * @module @cldmv/slothlet/helpers/boundary-patch-layers
 * @internal
 *
 * @description
 * Every boundary patch replaces a shared global — `Promise.prototype.then`, `setTimeout`, an observer
 * constructor, an `EventTarget` or `EventEmitter` method, an `on*` accessor — with a wrapper over
 * whatever was installed. Two copies of the package in one realm each keep their own patch state, so
 * their wrappers stack: copy B's wraps copy A's. Restoring only what a copy found when it patched
 * breaks once they unpatch out of order. A could not remove its wrapper from under B's; B then put A's
 * wrapper back as "the original" after A had forgotten it, leaving a wrapper nothing could remove,
 * still pinning for a copy that had disabled, under every wrapper a later enable added.
 *
 * Each wrapper is therefore registered here as a layer, keyed by the function that identifies it once
 * installed (the wrapper itself, or an accessor's getter). Disabling marks a copy's layer inactive — a
 * wrapper that is still installed under someone else's then passes straight through to what it
 * wrapped — and restores only when the layer is still on top. Both a restore and a new layer look
 * through inactive layers to whatever is under them, so an out-of-order teardown still ends with the
 * original installed and a later enable never builds on a dead wrapper.
 *
 * The registry lives on the global object under a `Symbol.for` key, so every copy shares it. The property cannot be
 * replaced, and what a copy puts in it is a frozen view of its layer: code that reaches the registry cannot switch a
 * layer off, and each copy reads its own layers from its own records, never from the registry.
 */

import { Objects, Reflect, Symbols, WeakMap, WeakMapMethods } from "#helpers/intrinsics";

/**
 * Where the registry lives on the global object.
 * @type {symbol}
 * @private
 */
const LAYERS = Symbols.for("slothlet.boundaryPatch.layers");

/**
 * This copy's own layers, by the function that identifies each: read from here, never from the shared registry, so
 * nothing written to the registry changes how this copy sees its own wrappers.
 * @type {WeakMap<Function, {active: boolean, below: *}>}
 * @private
 */
const OWN_LAYERS = new WeakMap();

/**
 * The entry another copy's layer had in the registry when this copy first read it: an entry put in its place later is
 * not taken for it.
 * @type {WeakMap<Function, object>}
 * @private
 */
const SEEN_LAYERS = new WeakMap();

/**
 * The shared registry: identifying function → layer. Kept on the global object as a property that cannot be written,
 * deleted or redefined, so no one can swap the registry itself; each copy of slothlet keeps sharing the one map.
 * @returns {WeakMap<Function, {active: boolean, below: *}>} The registry, created on first use.
 * @private
 */
function runtime_layers() {
	const descriptor = Reflect.getOwnPropertyDescriptor(globalThis, LAYERS);
	let registry = descriptor && "value" in descriptor ? descriptor.value : undefined;
	if (!(registry instanceof WeakMap)) {
		registry = new WeakMap();
		// Non-enumerable, so the global object's own keys look the same as before.
		Objects.defineProperty(globalThis, LAYERS, { __proto__: null, value: registry, writable: false, configurable: false });
	} else if (descriptor.configurable || descriptor.writable) {
		// Made by an earlier copy that left it replaceable: the same map, fixed in place.
		Objects.defineProperty(globalThis, LAYERS, { __proto__: null, value: registry, writable: false, configurable: false });
	}
	return registry;
}

/**
 * The layer a function identifies: this copy's own, or another copy's entry as this copy first read it.
 * @param {*} marker - A function that may identify a layer.
 * @returns {{active: boolean, below: *}|undefined} The layer.
 * @private
 */
function runtime_layerOf(marker) {
	if (marker === null || (typeof marker !== "function" && typeof marker !== "object")) return undefined;
	const own = WeakMapMethods.get(OWN_LAYERS, marker);
	if (own !== undefined) return own;
	const seen = WeakMapMethods.get(SEEN_LAYERS, marker);
	if (seen !== undefined) return seen;
	const entry = WeakMapMethods.get(runtime_layers(), marker);
	if (entry !== null && typeof entry === "object") WeakMapMethods.set(SEEN_LAYERS, marker, entry);
	return entry;
}

/**
 * What the registry holds for one of this copy's layers: a frozen view that reads the layer, so code outside slothlet
 * that reaches the registry cannot switch the layer off or point it elsewhere.
 * @param {{active: boolean, below: *}} layer - The layer.
 * @returns {{active: boolean, below: *}} The view (both members read-only).
 * @private
 */
function runtime_layerView(layer) {
	return Objects.freeze({
		__proto__: null,
		get active() {
			return layer.active;
		},
		get below() {
			return layer.below;
		}
	});
}

/**
 * Identify a layer by the installed value itself — the case for a patched method or constructor.
 * @param {*} value - An installed value.
 * @returns {*} The same value.
 * @private
 */
const runtime_byValue = (value) => value;

/**
 * Look through inactive layers to whatever is installed underneath them.
 * @param {*} installed - An installed value or descriptor.
 * @param {function(*): *} identify - Maps it to the function a layer is registered under.
 * @returns {*} The first value that is not an inactive layer.
 * @private
 */
function runtime_collapse(installed, identify) {
	let current = installed;
	for (;;) {
		const layer = runtime_layerOf(identify(current));
		if (!layer || layer.active) return current;
		current = layer.below;
	}
}

/**
 * Start a layer over what is installed now.
 *
 * @param {*} installed - The value or descriptor installed now, which the new wrapper will wrap.
 * @param {function(*): *} [identify] - Maps an installed value or descriptor to the function a layer
 *   is registered under; the value itself by default (a patched method or constructor). For an
 *   accessor descriptor, its getter.
 * @returns {{active: boolean, below: *}} The layer. `below` is what the wrapper should delegate to —
 *   `installed` with any inactive layers looked through.
 * @internal
 */
export function openLayer(installed, identify = runtime_byValue) {
	return { active: true, below: runtime_collapse(installed, identify) };
}

/**
 * Register a layer under the function that identifies it once installed.
 * @param {Function} marker - The wrapper, or the getter of a wrapping accessor.
 * @param {{active: boolean, below: *}} layer - From {@link openLayer}.
 * @returns {void}
 * @internal
 */
export function markLayer(marker, layer) {
	WeakMapMethods.set(OWN_LAYERS, marker, layer);
	WeakMapMethods.set(runtime_layers(), marker, runtime_layerView(layer));
}

/**
 * Whether a function is a layer that is still active.
 * @param {*} marker - A function that may identify a layer.
 * @returns {boolean} True for an active layer.
 * @internal
 */
export function isActiveLayer(marker) {
	return runtime_layerOf(marker)?.active === true;
}

/**
 * Retire a layer: from now on its wrapper passes through. Returns what to put back if the caller's
 * wrapper is still the one installed.
 *
 * @param {{active: boolean, below: *}} layer - From {@link openLayer}.
 * @param {function(*): *} [identify] - As for {@link openLayer}.
 * @returns {*} What the layer wrapped, with any inactive layers under it looked through.
 * @internal
 */
export function closeLayer(layer, identify = runtime_byValue) {
	layer.active = false;
	return runtime_collapse(layer.below, identify);
}

/**
 * Whether `host[key]` is still `value`, read from its own descriptor: a getter another library
 * installed over the patch since is never run, so a teardown cannot be made to throw by it, and a
 * replacement it does not recognise keeps its place.
 * @param {object} host - Object the patch was installed on.
 * @param {PropertyKey} key - The patched key.
 * @param {*} value - The wrapper this copy installed.
 * @returns {boolean} True when `key` is an own data property holding `value`.
 * @internal
 */
export function holdsValue(host, key, value) {
	const descriptor = Reflect.getOwnPropertyDescriptor(host, key);
	return descriptor !== undefined && "value" in descriptor && descriptor.value === value;
}
