/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/clone-context.mjs
 *	@Date: 2026-11-11T10:54:24-08:00 (1794423264)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:14:05-08:00 (1794431645)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Lets the platform's cloning functions take the views slothlet hands a module of another module's data.
 * @module @cldmv/slothlet/helpers/clone-context
 * @internal
 *
 * @description
 * While the permission system is on, what one module hands another reaches it as a view: a Proxy. The structured clone
 * algorithm refuses a Proxy, so `structuredClone(data)`, `v8.serialize(data)` and every `postMessage(data)` threw a
 * `DataCloneError` on data another module handed over, where plain JavaScript copies it.
 *
 * This patch wraps those functions the way the other boundary patches wrap theirs (see
 * {@link module:@cldmv/slothlet/helpers/boundary-patch-layers}). A wrapper calls the function it wraps first, with
 * exactly what it was given, so nothing changes for a value that clones. Only when that call refuses the value does the
 * wrapper look for slothlet's views in it: it builds a copy of the plain objects, arrays, `Map`s and `Set`s on the way
 * to each view, with the value behind the view in the view's place, and hands that to the platform's own function as it
 * was when slothlet loaded. What comes back is the platform's clone (or nothing, for a message posted), so the caller
 * ends up with a copy of the data and never with the object behind a view. A value holding no view of slothlet's is
 * refused with the platform's own error, as before.
 *
 * Wrapped where they exist: `structuredClone`, `v8.serialize` (Node), and `postMessage` of `MessagePort`,
 * `BroadcastChannel`, `Worker` (the browser's and `node:worker_threads`'), and the browser's `window`.
 *
 * Each wrapper carries the function it wraps under a `Symbol.for` key, so a patch is recognisable from any copy of
 * slothlet in the realm, and this copy installs its wrappers once however many instances ask.
 */
import { isNode } from "@cldmv/slothlet/helpers/platform";
import { openLayer, markLayer, closeLayer, holdsValue } from "@cldmv/slothlet/helpers/boundary-patch-layers";

/**
 * The key a clone wrapper holds the function it wraps under: the watermark of this patch.
 * @type {symbol}
 * @private
 */
const ORIGINAL_CLONE = Symbol.for("slothlet.clone.original");

const { apply, getOwnPropertyDescriptor, defineProperty, getPrototypeOf, ownKeys } = Reflect;
const isArray = Array.isArray;
const ObjectPrototype = Object.prototype;
const NativeMap = Map;
const NativeSet = Set;
const mapForEach = Map.prototype.forEach;
const setForEach = Set.prototype.forEach;
const mapSet = Map.prototype.set;
const setAdd = Set.prototype.add;
const mapGet = Map.prototype.get;
const mapHas = Map.prototype.has;
const mapSize = getOwnPropertyDescriptor(Map.prototype, "size").get;
const setSize = getOwnPropertyDescriptor(Set.prototype, "size").get;

/**
 * Whether a value is a `Map` or a `Set` of the engine's own, told by the engine's brand check.
 * @param {object} value - An object.
 * @param {Function} sizeGetter - The `size` getter of `Map.prototype` or `Set.prototype`.
 * @returns {boolean} True when it is one.
 * @private
 */
function runtime_hasBrand(value, sizeGetter) {
	try {
		apply(sizeGetter, value, []);
		return true;
	} catch {
		return false;
	}
}

/**
 * Look through a function to the one under every clone wrapper on it, any copy of slothlet's included.
 * @param {*} fn - A function that may be a clone wrapper.
 * @returns {*} The function under the wrappers.
 * @private
 */
function runtime_unwrapClone(fn) {
	let current = fn;
	while (typeof current === "function" && typeof current[ORIGINAL_CLONE] === "function") current = current[ORIGINAL_CLONE];
	return current;
}

/**
 * The places a cloning function lives, read when slothlet loads: each with the object that holds it, its key, and the
 * platform's own function there.
 * @returns {Array<{host: object, key: string, native: Function}>} The places found in this environment.
 * @private
 */
function runtime_cloneSites() {
	const sites = [];
	const add = (host, key) => {
		if (host === null || host === undefined) return;
		let descriptor;
		try {
			descriptor = getOwnPropertyDescriptor(host, key);
		} catch {
			return;
		}
		if (!descriptor || typeof descriptor.value !== "function") return;
		sites.push({ host, key, native: runtime_unwrapClone(descriptor.value) });
	};
	add(globalThis, "structuredClone");
	add(globalThis.MessagePort?.prototype, "postMessage");
	add(globalThis.BroadcastChannel?.prototype, "postMessage");
	add(globalThis.Worker?.prototype, "postMessage");
	if (isNode) {
		const builtin = globalThis.process?.getBuiltinModule;
		if (typeof builtin === "function") {
			add(builtin("node:v8"), "serialize");
			add(builtin("node:worker_threads")?.Worker?.prototype, "postMessage");
		}
	} else if (typeof globalThis.postMessage === "function") {
		// The browser's `window.postMessage`, and a worker's own `postMessage` to its parent.
		add(globalThis, "postMessage");
	}
	return sites;
}

/**
 * The cloning functions of this environment, as they were when slothlet loaded.
 * @type {Array<{host: object, key: string, native: Function}>}
 * @private
 */
const CLONE_SITES = runtime_cloneSites();

/**
 * Tells the value behind one of slothlet's views, set by the handlers that make them.
 * @type {function(*): *}
 * @private
 */
let viewed = () => undefined;

/**
 * Set how the value behind one of slothlet's views is told.
 * @param {function(*): *} behind - Answers the value a view stands over, or
 *   `undefined` for a value that is no view of slothlet's.
 * @returns {void}
 * @internal
 * @example
 * setCloneViewReader((value) => (isView(value) ? valueBehind(value) : undefined));
 */
export function setCloneViewReader(behind) {
	viewed = behind;
}

/**
 * A copy of a value for the platform to clone, with the value behind each of slothlet's views in the view's place. Plain
 * objects, arrays, `Map`s and `Set`s are copied member by member, read as the clone algorithm reads them; every other
 * object is left as it is for the platform to clone or refuse.
 * @param {*} root - The value.
 * @returns {{found: boolean, value: *}} The copy, and whether any view was found.
 * @private
 */
function runtime_reveal(root) {
	const copies = new NativeMap();
	let found = false;
	const walk = (value) => {
		if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
		if (apply(mapHas, copies, [value])) return apply(mapGet, copies, [value]);
		let subject = value;
		const behind = viewed(value);
		if (behind !== undefined) {
			found = true;
			subject = behind;
			if (apply(mapHas, copies, [subject])) {
				const known = apply(mapGet, copies, [subject]);
				apply(mapSet, copies, [value, known]);
				return known;
			}
		}
		if (typeof subject !== "object") return subject;
		let copy;
		let kind = "object";
		if (isArray(subject)) copy = [];
		else if (runtime_hasBrand(subject, mapSize)) {
			copy = new NativeMap();
			kind = "map";
		} else if (runtime_hasBrand(subject, setSize)) {
			copy = new NativeSet();
			kind = "set";
		} else {
			const prototype = getPrototypeOf(subject);
			// Only a plain object is copied: anything else is the platform's to clone as it is.
			if (prototype !== ObjectPrototype && prototype !== null) {
				apply(mapSet, copies, [value, subject]);
				return subject;
			}
			copy = {};
		}
		apply(mapSet, copies, [value, copy]);
		if (subject !== value) apply(mapSet, copies, [subject, copy]);
		if (kind === "map") {
			apply(mapForEach, subject, [(member, key) => apply(mapSet, copy, [walk(key), walk(member)])]);
			return copy;
		}
		if (kind === "set") {
			apply(setForEach, subject, [(member) => apply(setAdd, copy, [walk(member)])]);
			return copy;
		}
		for (const key of ownKeys(subject)) {
			if (typeof key !== "string") continue;
			const descriptor = getOwnPropertyDescriptor(subject, key);
			if (!descriptor || !descriptor.enumerable) continue;
			// Read as the clone algorithm reads a member, an accessor included.
			copy[key] = walk(subject[key]);
		}
		return copy;
	};
	const value = walk(root);
	return { found, value };
}

/**
 * This copy's installed wrappers, or null while the patch is off.
 * @type {Array<{host: object, key: string, layer: object, wrapper: Function, descriptor: PropertyDescriptor}>|null}
 * @private
 */
let installed = null;

const runtime_descriptorValue = (descriptor) => descriptor?.value;

/**
 * Wrap the platform's cloning functions so they take slothlet's views of another module's data. Idempotent.
 * @returns {void}
 * @internal
 * @example
 * enableClonePatching();
 */
export function enableClonePatching() {
	if (installed) return;
	installed = [];
	for (const { host, key, native } of CLONE_SITES) {
		let descriptor;
		try {
			descriptor = getOwnPropertyDescriptor(host, key);
		} catch {
			continue;
		}
		// A host that froze or replaced the function with something exotic keeps it as it is.
		if (!descriptor || typeof descriptor.value !== "function" || (!descriptor.configurable && !descriptor.writable)) continue;
		const layer = openLayer(descriptor, runtime_descriptorValue);
		const below = layer.below.value;
		const wrapper = {
			[key](...args) {
				if (!layer.active) return apply(below, this, args);
				try {
					return apply(below, this, args);
				} catch (error) {
					// Whatever the refusal is called (`DataCloneError` from the platform, a plain `Error` from
					// `v8.serialize`), it stands unless the value holds one of slothlet's views.
					if (args.length === 0) throw error;
					let handed;
					try {
						const revealed = runtime_reveal(args[0]);
						if (!revealed.found) throw error;
						handed = [revealed.value];
						for (let index = 1; index < args.length; index++) handed.push(runtime_reveal(args[index]).value);
					} catch {
						// Whatever reading the value threw is not the caller's to see: the platform's refusal stands.
						throw error;
					}
					// The platform's own function, as it was when slothlet loaded: what is behind a view is handed to
					// nothing else, and only its clone comes back.
					return apply(native, this, handed);
				}
			}
		}[key];
		try {
			defineProperty(wrapper, ORIGINAL_CLONE, { value: below });
			defineProperty(wrapper, "length", { value: below.length, configurable: true });
			if (!defineProperty(host, key, { ...descriptor, value: wrapper })) continue;
		} catch {
			continue;
		}
		markLayer(wrapper, layer);
		installed.push({ host, key, layer, wrapper, descriptor });
	}
}

/**
 * Remove this copy's wrappers, putting back what each wrapped where it is still the one installed. Idempotent.
 * @returns {void}
 * @internal
 * @example
 * disableClonePatching();
 */
export function disableClonePatching() {
	if (!installed) return;
	for (const { host, key, layer, wrapper } of installed) {
		const restore = closeLayer(layer, runtime_descriptorValue);
		try {
			if (holdsValue(host, key, wrapper)) defineProperty(host, key, restore);
		} catch {
			// A host that no longer lets the member be defined keeps the wrapper, which now passes straight through.
		}
	}
	installed = null;
}

/**
 * Whether a function is a clone wrapper of any copy of slothlet's.
 * @param {*} fn - A function.
 * @returns {boolean} True for one.
 * @internal
 * @example
 * isClonePatched(globalThis.structuredClone); // true while an instance with the patch is up
 */
export function isClonePatched(fn) {
	return typeof fn === "function" && typeof fn[ORIGINAL_CLONE] === "function";
}
