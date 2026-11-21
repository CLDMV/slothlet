/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/async-store-slot.mjs
 *	@Date: 2026-11-18T00:00:00-08:00 (1794988800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T00:00:00-08:00 (1794988800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Where Node keeps what an `AsyncLocalStorage` holds for an async resource, found by looking.
 *
 * @description
 * While `AsyncContextFrame` is off (Node 22's default, or a later Node run with `--no-async-context-frame`), Node keeps
 * each storage's value for an async resource on the resource itself. Where depends on the Node:
 *
 * - directly under the storage's own `kResourceStore` symbol (`resource[storage.kResourceStore]`);
 * - in an object under `Symbol(kAsyncLocalStorageContext)`, keyed by that symbol
 *   (`resource[kAsyncLocalStorageContext][storage.kResourceStore]`; Node 24.20 and 26.6 onward).
 *
 * With frames on, Node keeps it in the frame instead, and nothing of it is on the resource.
 *
 * One probe answers both questions slothlet asks, once per process: whether a storage's value can be reached from the
 * running async resource or a fresh promise (the permission baseline's `async-context-frame` check), and, where it sits
 * on the resource in one of the places above, which one. It runs a storage of its own with a fresh marker and looks
 * where the marker landed; Node's version is never read, since a version's default and flags passed through
 * `NODE_OPTIONS` decide it as well.
 *
 * @module @cldmv/slothlet/helpers/async-store-slot
 * @internal
 */

import { mapEntriesToArray, Objects, Processes, Promises, Reflect, Set, SetMethods, Symbol } from "#helpers/intrinsics";

/**
 * `node:async_hooks`, as slothlet loaded, or null where the platform has none (a browser).
 * @type {object|null}
 * @private
 */
const ASYNC_HOOKS = (() => {
	try {
		return Processes.getBuiltinModule?.("node:async_hooks") ?? null;
	} catch {
		// A platform that refuses the lookup has no async hooks to check.
		/* v8 ignore next */
		return null;
	}
})();

/**
 * What the probe uses, taken as slothlet loads: `AsyncLocalStorage` with its `run` and `disable`, and
 * `executionAsyncResource`. Null where any is missing.
 * @type {{Storage: Function, run: Function, disable: Function, executionAsyncResource: Function}|null}
 * @private
 */
const PROBE_BUILTINS = (() => {
	const Storage = ASYNC_HOOKS?.AsyncLocalStorage;
	const run = Storage?.prototype?.run;
	const disable = Storage?.prototype?.disable;
	const executionAsyncResource = ASYNC_HOOKS?.executionAsyncResource;
	if (
		typeof Storage !== "function" ||
		typeof run !== "function" ||
		typeof disable !== "function" ||
		typeof executionAsyncResource !== "function"
	) {
		return null;
	}
	return Objects.freeze({ Storage, run, disable, executionAsyncResource });
})();

/**
 * How many steps from an async resource the probe looks for its marker. Node keeps the value at one step
 * (`Symbol(kResourceStore)`) or two (an object under `Symbol(kAsyncLocalStorageContext)`); the rest is margin.
 * @type {number}
 * @private
 */
const PROBE_DEPTH = 4;

/**
 * Whether `marker` is found within a few steps of `value`, through own keys (symbols too, data properties only, so no
 * getter runs) and map entries.
 * @param {*} value - Where to look.
 * @param {object} marker - What to look for.
 * @param {number} depth - Steps taken so far.
 * @param {Set<object>} seen - What has been looked at.
 * @returns {boolean} True when the marker is there.
 * @private
 */
function holdsMarker(value, marker, depth, seen) {
	if (value === marker) return true;
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
	if (depth > PROBE_DEPTH || SetMethods.has(seen, value)) return false;
	SetMethods.add(seen, value);
	let entries;
	try {
		// Throws for anything that is not a map.
		entries = mapEntriesToArray(value);
	} catch {
		entries = null;
	}
	if (entries) {
		for (let index = 0; index < entries.length; index++) {
			const entry = entries[index];
			if (holdsMarker(entry[0], marker, depth + 1, seen) || holdsMarker(entry[1], marker, depth + 1, seen)) return true;
		}
	}
	let keys;
	try {
		keys = Reflect.ownKeys(value);
	} catch {
		return false;
	}
	for (let index = 0; index < keys.length; index++) {
		let descriptor;
		try {
			descriptor = Reflect.getOwnPropertyDescriptor(value, keys[index]);
		} catch {
			continue;
		}
		if (descriptor && "value" in descriptor && holdsMarker(descriptor.value, marker, depth + 1, seen)) return true;
	}
	return false;
}

/**
 * The own data property `key` of `value`, or undefined where it has none or is no object.
 * @param {*} value - The object.
 * @param {PropertyKey} key - The key.
 * @returns {{value: *}|undefined} The property's value, boxed.
 * @private
 */
function ownData(value, key) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return undefined;
	let descriptor;
	try {
		descriptor = Reflect.getOwnPropertyDescriptor(value, key);
	} catch {
		return undefined;
	}
	return descriptor !== undefined && "value" in descriptor ? { value: descriptor.value } : undefined;
}

/**
 * Marks the layout where a storage's value sits on the resource itself, under the storage's `kResourceStore`.
 * @type {symbol}
 * @private
 */
const ON_RESOURCE = Symbol("slothlet.storeOnResource");

/**
 * Where on `resource` the value `marker` a storage keyed `key` holds sits: {@link ON_RESOURCE} when directly under
 * `key`, the symbol of the object it sits in under `key` otherwise, or null where it is in neither place.
 * @param {object} resource - The running async resource.
 * @param {symbol} key - The storage's `kResourceStore`.
 * @param {object} marker - What the storage holds.
 * @returns {symbol|null} The layout.
 * @private
 */
function slotOf(resource, key, marker) {
	if (ownData(resource, key)?.value === marker) return ON_RESOURCE;
	let symbols;
	try {
		symbols = Objects.getOwnPropertySymbols(resource);
	} catch {
		return null;
	}
	for (let index = 0; index < symbols.length; index++) {
		const holder = ownData(resource, symbols[index])?.value;
		if (ownData(holder, key)?.value === marker) return symbols[index];
	}
	return null;
}

/**
 * The probe's answer, once it has run in this process; undefined before.
 * @type {{exposed: boolean, slot: symbol|null}|undefined}
 * @private
 */
let probed;

/**
 * Run the probe once: a storage of its own, run with a fresh marker, looked for on the running async resource and a
 * fresh promise.
 * @returns {{exposed: boolean, slot: symbol|null}} Whether the marker was in reach, and where on the resource it sat
 *   (see {@link slotOf}); `{exposed: false, slot: null}` where there are no async hooks to probe.
 * @private
 */
function probe() {
	if (probed !== undefined) return probed;
	if (PROBE_BUILTINS === null) {
		probed = Objects.freeze({ exposed: false, slot: null });
		return probed;
	}
	const { Storage, run, disable, executionAsyncResource } = PROBE_BUILTINS;
	const marker = Objects.freeze(Objects.create(null));
	const storage = new Storage();
	const key = storage.kResourceStore;
	let exposed = false;
	let slot = null;
	try {
		Reflect.apply(run, storage, [
			marker,
			() => {
				const resource = executionAsyncResource();
				exposed = holdsMarker(resource, marker, 0, new Set()) || holdsMarker(Promises.resolve(), marker, 0, new Set());
				if (exposed && typeof key === "symbol") slot = slotOf(resource, key, marker);
			}
		]);
	} finally {
		Reflect.apply(disable, storage, []);
	}
	probed = Objects.freeze({ exposed, slot });
	return probed;
}

/**
 * Whether what an `AsyncLocalStorage` holds can be reached from the running async resource or a fresh promise: true
 * while `AsyncContextFrame` is off.
 * @returns {boolean} True when it can.
 */
export function asyncStoreExposed() {
	return probe().exposed;
}

/**
 * Whether there are async hooks to probe here.
 * @returns {boolean} True on Node.
 */
export function asyncStoreProbeAvailable() {
	return PROBE_BUILTINS !== null;
}

/**
 * The object Node keeps every storage's value for `resource` on, keyed by each storage's `kResourceStore`: the
 * resource itself, or the object under `Symbol(kAsyncLocalStorageContext)` on it. Null where Node keeps nothing on
 * the resource (`AsyncContextFrame` on), where it has nothing there yet, or where the value sits somewhere the probe
 * did not recognise.
 * @param {*} resource - An async resource.
 * @returns {object|null} The object.
 */
export function resourceStoreHolder(resource) {
	if (resource === null || (typeof resource !== "object" && typeof resource !== "function")) return null;
	const slot = probe().slot;
	if (slot === null) return null;
	if (slot === ON_RESOURCE) return resource;
	const holder = ownData(resource, slot)?.value;
	return holder !== null && typeof holder === "object" ? holder : null;
}

/**
 * Whether Node keeps a storage's value on the async resource itself, in a place {@link resourceStoreHolder} reads.
 * @returns {boolean} True while `AsyncContextFrame` is off, on a layout the probe recognised.
 */
export function resourceStoreKnown() {
	return probe().slot !== null;
}
