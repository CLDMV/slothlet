/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/clone-context.mjs
 *	@Date: 2026-11-11T10:54:24-08:00 (1794423264)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T21:48:02-08:00 (1794635282)
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
 * `DataCloneError` on data another module handed over, where plain JavaScript copies it. An api node is a Proxy as
 * well, with the permission system on or off, so data read straight off the api (`structuredClone(api.m.config)`) was
 * refused the same way (#751).
 *
 * This patch wraps those functions the way the other boundary patches wrap theirs (see
 * {@link module:@cldmv/slothlet/helpers/boundary-patch-layers}). A wrapper calls the function it wraps first, with
 * exactly what it was given, so nothing changes for a value that clones. Only when that call refuses the value does the
 * wrapper look for slothlet's views and api nodes in it: it builds a copy of the plain objects, arrays, `Map`s and
 * `Set`s on the way to each, with the value behind a view in the view's place and a node's data read member by member
 * through the node, and hands that to the platform's own function as it was when slothlet loaded. What comes back is the platform's clone (or nothing, for a message posted), so the caller
 * ends up with a copy of the data and never with the object behind a view or a node. A value holding no view or node of
 * slothlet's is refused with the platform's own error, as before. A built-in data object behind a view or a node (a
 * date, map, set, error, pattern, buffer, typed array, boxed primitive) is copied from reads of it, the language's own
 * methods reading its internal slots, never handed to the platform as it is.
 *
 * Wrapped where they exist: `structuredClone`, `v8.serialize` (Node), and `postMessage` of `MessagePort`,
 * `BroadcastChannel`, `Worker` (the browser's and `node:worker_threads`'), and the browser's `window`.
 *
 * Each wrapper carries the function it wraps under a `Symbol.for` key, so a patch is recognisable from any copy of
 * slothlet in the realm, and this copy installs its wrappers once however many instances ask.
 */
import { isNode } from "@cldmv/slothlet/helpers/platform";
import { openLayer, closeLayer, holdsValue, markLayer } from "@cldmv/slothlet/helpers/boundary-patch-layers";
import {
	ArrayBuffer,
	ArrayMethods,
	Arrays,
	BigInt,
	BigInt64Array,
	BigUint64Array,
	Boolean,
	DataView,
	Date,
	Error,
	EvalError,
	filterList,
	Float16Array,
	Float32Array,
	Float64Array,
	Int16Array,
	Int32Array,
	Int8Array,
	Map,
	mapList,
	NativeObject,
	Number,
	Objects,
	Processes,
	RangeError,
	ReferenceError,
	Reflect,
	RegExp,
	Set,
	SharedArrayBuffer,
	String,
	structuredClone,
	Symbol,
	Symbols,
	SyntaxError,
	TypeError,
	Uint16Array,
	Uint32Array,
	Uint8Array,
	Uint8ClampedArray,
	URIError
} from "@cldmv/slothlet/helpers/intrinsics";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "@cldmv/slothlet/helpers/instance-imports";

/**
 * The key a clone wrapper holds the function it wraps under: the watermark of this patch.
 * @type {symbol}
 * @private
 */
const ORIGINAL_CLONE = Symbols.for("slothlet.clone.original");

const { apply, getOwnPropertyDescriptor, defineProperty, getPrototypeOf, ownKeys } = Reflect;
const isArray = Arrays.isArray;
const ObjectPrototype = Objects.prototype;
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
 * A getter of a built-in prototype, as it was when slothlet loaded, or null where the platform has none.
 * @param {object|undefined} prototype - The prototype.
 * @param {string|symbol} key - The getter's key.
 * @returns {Function|null} The getter.
 * @private
 */
const getterOf = (prototype, key) => (prototype ? (getOwnPropertyDescriptor(prototype, key)?.get ?? null) : null);

const NativeDate = Date;
const NativeRegExp = RegExp;
const NativeError = Error;
const ErrorPrototype = NativeError.prototype;
const errorBrand = typeof NativeError.isError === "function" ? NativeError.isError : null;
const NativeArrayBuffer = ArrayBuffer;
const NativeUint8Array = Uint8Array;
const NativeDataView = DataView;
const dateGetTime = Date.prototype.getTime;
const regExpSource = getterOf(RegExp.prototype, "source");
/** The flag getters of `RegExp.prototype`, each with the letter it stands for, in the order `flags` lists them. */
const REGEXP_FLAGS = filterList(
	mapList(
		[
			["d", "hasIndices"],
			["g", "global"],
			["i", "ignoreCase"],
			["m", "multiline"],
			["s", "dotAll"],
			["u", "unicode"],
			["v", "unicodeSets"],
			["y", "sticky"]
		],
		(entry1) => {
			const letter = entry1[0],
				key = entry1[1];
			return [letter, getterOf(RegExp.prototype, key)];
		}
	),
	(entry2) => {
		const getter = entry2[1];
		return getter !== null;
	}
);
const bufferByteLength = getterOf(ArrayBuffer.prototype, "byteLength");
const bufferResizable = getterOf(ArrayBuffer.prototype, "resizable");
const bufferMaxByteLength = getterOf(ArrayBuffer.prototype, "maxByteLength");
const bufferDetached = getterOf(ArrayBuffer.prototype, "detached");
const sharedByteLength = typeof SharedArrayBuffer === "function" ? getterOf(SharedArrayBuffer.prototype, "byteLength") : null;
const TypedArrayPrototype = getPrototypeOf(Uint8Array.prototype);
const typedBuffer = getterOf(TypedArrayPrototype, "buffer");
const typedByteOffset = getterOf(TypedArrayPrototype, "byteOffset");
const typedLength = getterOf(TypedArrayPrototype, "length");
const typedTag = getterOf(TypedArrayPrototype, Symbol.toStringTag);
const typedSet = TypedArrayPrototype.set;
const viewBuffer = getterOf(DataView.prototype, "buffer");
const viewByteOffset = getterOf(DataView.prototype, "byteOffset");
const viewByteLength = getterOf(DataView.prototype, "byteLength");
/** The typed array classes, by the name each instance's tag gives. */
const TYPED_ARRAYS = new NativeMap(
	filterList(
		[
			["Int8Array", Int8Array],
			["Uint8Array", Uint8Array],
			["Uint8ClampedArray", Uint8ClampedArray],
			["Int16Array", Int16Array],
			["Uint16Array", Uint16Array],
			["Int32Array", Int32Array],
			["Uint32Array", Uint32Array],
			["Float16Array", Float16Array],
			["Float32Array", Float32Array],
			["Float64Array", Float64Array],
			["BigInt64Array", BigInt64Array],
			["BigUint64Array", BigUint64Array]
		],
		(entry3) => {
			const kind = entry3[1];
			return typeof kind === "function";
		}
	)
);
/** The error classes the structured clone algorithm keeps, by name; any other error is copied as an `Error`. */
const ERROR_CLASSES = new NativeMap([
	["Error", Error],
	["EvalError", EvalError],
	["RangeError", RangeError],
	["ReferenceError", ReferenceError],
	["SyntaxError", SyntaxError],
	["TypeError", TypeError],
	["URIError", URIError]
]);
/** The `valueOf` of each boxed primitive's prototype: the engine's brand check for that box. */
const BOXED_VALUE_OF = mapList(
	filterList([Number, String, Boolean, typeof BigInt === "function" ? BigInt : null, Symbol], (kind) => kind !== null),
	(kind) => kind.prototype.valueOf
);

/**
 * Run a built-in method on a value, answering `undefined` where the value is not of the method's kind.
 * @param {Function|null} method - The method (a getter included).
 * @param {*} value - The value.
 * @returns {*} What the method answered.
 * @private
 */
function runtime_tryBrand(method, value) {
	if (method === null) return undefined;
	try {
		return apply(method, value, []);
	} catch {
		return undefined;
	}
}

/**
 * Whether a value is a primitive boxed in an object (`new String("x")`, `new Number(1)`, …).
 * @param {object} value - An object.
 * @returns {boolean} True for one.
 * @internal
 * @example
 * isBoxedPrimitive(new Number(4)); // true
 */
export function isBoxedPrimitive(value) {
	for (let ofIndex = 0, ofList = BOXED_VALUE_OF; ofIndex < ofList.length; ofIndex++) {
		const valueOf = ofList[ofIndex];
		try {
			apply(valueOf, value, []);
			return true;
		} catch {
			// Not this kind of box.
		}
	}
	return false;
}

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
		ArrayMethods.push(sites, { host, key, native: runtime_unwrapClone(descriptor.value) });
	};
	add(globalThis, "structuredClone");
	add(globalThis.MessagePort?.prototype, "postMessage");
	add(globalThis.BroadcastChannel?.prototype, "postMessage");
	add(globalThis.Worker?.prototype, "postMessage");
	if (isNode) {
		const builtin = Processes.getBuiltinModule;
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
function setCloneViewReader(behind) {
	viewed = behind;
}

/**
 * Tells how an api node's data is copied, set by the handlers that make the nodes.
 * @type {function(*): ({value: *}|{list: boolean}|{slots: object, members: object}|undefined)}
 * @private
 */
let nodeData = () => undefined;

/**
 * Set how the data of one of slothlet's api nodes is told.
 * @param {function(*): ({value: *}|{list: boolean}|{slots: object, members: object}|undefined)} shape - Answers
 *   `undefined` for a value that is no loaded api node (or a view of one); `{ list }` for a node whose data is read
 *   member by member through the node itself, as an array (`list: true`) or an object; `{ slots, members }` for a node
 *   or view standing over a built-in data object or an error (`slots`), copied from what it holds and from reads of its
 *   members through `members`, the node or view the caller holds; `{ value }` for a node standing for a value the
 *   platform clones or refuses as it is (a function, a primitive, a `Date` while the permission system is off).
 * @returns {void}
 * @internal
 * @example
 * setCloneNodeReader((value) => (isLoadedNode(value) ? { list: Array.isArray(valueOf(value)) } : undefined));
 */
function setCloneNodeReader(shape) {
	nodeData = shape;
}

/**
 * A refusal, thrown where a value's data cannot be copied for the caller: the platform's own refusal then stands.
 * @private
 */
class NotCopied extends Error {}

/**
 * A copy of a built-in data object (a date, map, set, error, pattern, buffer, typed array, `DataView`, boxed
 * primitive) one of slothlet's views or api nodes stands over, made from reads of it the caller may make (#751): what
 * the object holds in its internal slots, read with the language's own methods as they were when slothlet loaded (so
 * none of a module's code runs, as none runs when the platform clones the object), and every value it holds read
 * through `members` (the view or node the caller holds) or walked as the clone algorithm walks it. The copy is a new
 * object of the caller's; the object behind the view is never part of it.
 *
 * Refused (the platform's own error then stands): a `WeakMap`, `WeakSet`, `WeakRef` or promise, as the platform refuses
 * them; a detached buffer; and memory shared with the object (a `SharedArrayBuffer`, or an array over one), which a
 * clone would hand over to be written as well as read.
 * @param {object} data - The built-in object.
 * @param {object} members - What the caller holds of it: reads of its members go through this.
 * @param {function(*): *} walk - Copies a value the object holds, as the clone algorithm would.
 * @param {function(object): void} remember - Records the copy before what it holds is walked, so a cycle finds it.
 * @param {function(object): (object|undefined)} known - A copy already made of a buffer, by the buffer.
 * @param {function(object, object): void} keep - Records a buffer's copy, so arrays over one buffer still share one.
 * @returns {object} The copy.
 * @private
 */
function runtime_slotCopy(data, members, walk, remember, known, keep) {
	if (runtime_hasBrand(data, mapSize)) {
		const copy = new NativeMap();
		remember(copy);
		const entries = [];
		apply(mapForEach, data, [(member, key) => ArrayMethods.push(entries, [key, member])]);
		for (let i = 0; i < entries.length; i++) apply(mapSet, copy, [walk(entries[i][0]), walk(entries[i][1])]);
		return copy;
	}
	if (runtime_hasBrand(data, setSize)) {
		const copy = new NativeSet();
		remember(copy);
		const entries = [];
		apply(setForEach, data, [(member) => ArrayMethods.push(entries, member)]);
		for (let ofIndex = 0, ofList = entries; ofIndex < ofList.length; ofIndex++) {
			const member = ofList[ofIndex];
			apply(setAdd, copy, [walk(member)]);
		}
		return copy;
	}
	const time = runtime_tryBrand(dateGetTime, data);
	if (time !== undefined) return new NativeDate(time);
	const source = runtime_tryBrand(regExpSource, data);
	if (source !== undefined) {
		let flags = "";
		for (let ofIndex = 0, ofList = REGEXP_FLAGS; ofIndex < ofList.length; ofIndex++) {
			const ofEntry = ofList[ofIndex],
				letter = ofEntry[0],
				getter = ofEntry[1];
			if (apply(getter, data, [])) flags += letter;
		}
		// A copy starts at `lastIndex` 0, as the platform's does.
		return new NativeRegExp(source, flags);
	}
	const bufferCopy = (buffer) => {
		const kept = known(buffer);
		if (kept !== undefined) return kept;
		if (runtime_tryBrand(bufferByteLength, buffer) === undefined || runtime_tryBrand(bufferDetached, buffer) === true)
			throw new NotCopied();
		const length = apply(bufferByteLength, buffer, []);
		// A resizable buffer's copy is made resizable to the same limit (the constructor's second argument).
		const copy = runtime_tryBrand(bufferResizable, buffer)
			? Reflect.construct(NativeArrayBuffer, [length, { maxByteLength: apply(bufferMaxByteLength, buffer, []) }])
			: new NativeArrayBuffer(length);
		apply(typedSet, new NativeUint8Array(copy), [new NativeUint8Array(buffer)]);
		keep(buffer, copy);
		return copy;
	};
	const tag = runtime_tryBrand(typedTag, data);
	if (tag !== undefined) {
		const Kind = apply(mapGet, TYPED_ARRAYS, [tag]);
		if (Kind === undefined) throw new NotCopied();
		const buffer = bufferCopy(apply(typedBuffer, data, []));
		const copy = new Kind(buffer, apply(typedByteOffset, data, []), apply(typedLength, data, []));
		remember(copy);
		return copy;
	}
	if (runtime_tryBrand(viewByteLength, data) !== undefined) {
		const buffer = bufferCopy(apply(viewBuffer, data, []));
		const copy = new NativeDataView(buffer, apply(viewByteOffset, data, []), apply(viewByteLength, data, []));
		remember(copy);
		return copy;
	}
	if (runtime_tryBrand(bufferByteLength, data) !== undefined) {
		const copy = bufferCopy(data);
		remember(copy);
		return copy;
	}
	// Memory shared with the object: a clone would let the caller write it.
	if (runtime_tryBrand(sharedByteLength, data) !== undefined) throw new NotCopied();
	for (let ofIndex = 0, ofList = BOXED_VALUE_OF; ofIndex < ofList.length; ofIndex++) {
		const valueOf = ofList[ofIndex];
		let primitive;
		try {
			primitive = apply(valueOf, data, []);
		} catch {
			continue;
		}
		// A boxed symbol is refused by the platform, as the object is.
		return NativeObject(primitive);
	}
	if (runtime_isError(data)) return runtime_errorCopy(data, members, walk, remember);
	throw new NotCopied();
}

/**
 * Whether a value is an error: by the engine's brand check where it has one, by its prototype chain otherwise (read
 * with the language's own `getPrototypeOf`, so no `Symbol.hasInstance` a module gave a class runs).
 * @param {object} value - An object.
 * @returns {boolean} True for an error.
 * @private
 */
function runtime_isError(value) {
	if (errorBrand !== null) return errorBrand(value);
	for (let current = getPrototypeOf(value); current !== null; current = getPrototypeOf(current)) {
		if (current === ErrorPrototype) return true;
	}
	return false;
}

/**
 * A copy of an error, made as the structured clone algorithm copies one: of the class its `name` names (one of the
 * language's own, `Error` for any other), with its own `message`, its `stack`, and its own `cause`, walked. The kind is
 * read from the error itself; the members through `members`, so a member the caller may not read is left out.
 * @param {object} data - The error.
 * @param {object} members - What the caller holds of it.
 * @param {function(*): *} walk - Copies a value the error holds.
 * @param {function(object): void} remember - Records the copy before its cause is walked.
 * @returns {Error} The copy.
 * @private
 */
function runtime_errorCopy(data, members, walk, remember) {
	const read = (key) => {
		try {
			return { value: members[key] };
		} catch {
			return null;
		}
	};
	const own = (key) => getOwnPropertyDescriptor(data, key);
	let name;
	try {
		name = data.name;
	} catch {
		name = undefined;
	}
	const Kind = (typeof name === "string" ? apply(mapGet, ERROR_CLASSES, [name]) : undefined) ?? NativeError;
	const copy = new Kind();
	remember(copy);
	const define = (key, value) => defineProperty(copy, key, { value, writable: true, enumerable: false, configurable: true });
	// The platform reads a data `message` of the error's own, and the `stack` as any read of it gives it.
	const message = own("message");
	if (message && "value" in message) {
		const value = read("message");
		if (value !== null) define("message", value.value);
	}
	const stack = read("stack");
	define("stack", stack === null ? undefined : stack.value);
	if (own("cause")) {
		const cause = read("cause");
		if (cause !== null) define("cause", walk(cause.value));
	}
	return copy;
}

/**
 * A copy of a value for the platform to clone, with the value behind each of slothlet's views in the view's place. Plain
 * objects, arrays, `Map`s and `Set`s are copied member by member, read as the clone algorithm reads them; every other
 * object is left as it is for the platform to clone or refuse. An api node's data is copied member by member too, each
 * member read through the node, so every read is one the node checks and the object behind the node is never taken.
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
		if (subject !== null && (typeof subject === "object" || typeof subject === "function")) {
			const node = nodeData(subject);
			if (node !== undefined) {
				found = true;
				if ("slots" in node) {
					const copy = runtime_slotCopy(
						node.slots,
						node.members,
						walk,
						(made) => {
							apply(mapSet, copies, [value, made]);
							if (subject !== value) apply(mapSet, copies, [subject, made]);
						},
						(buffer) => (apply(mapHas, copies, [buffer]) ? apply(mapGet, copies, [buffer]) : undefined),
						(buffer, made) => apply(mapSet, copies, [buffer, made])
					);
					apply(mapSet, copies, [value, copy]);
					return copy;
				}
				if ("value" in node) {
					subject = node.value;
				} else {
					// Read as the clone algorithm reads an object: its own enumerable string keys, each through the node.
					const members = node.list ? [] : {};
					apply(mapSet, copies, [value, members]);
					if (subject !== value) apply(mapSet, copies, [subject, members]);
					for (let ofIndex = 0, ofList = ownKeys(subject); ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						if (typeof key !== "string") continue;
						const descriptor = getOwnPropertyDescriptor(subject, key);
						if (!descriptor || !descriptor.enumerable) continue;
						members[key] = walk(subject[key]);
					}
					if (node.list) members.length = subject.length;
					return members;
				}
			}
		}
		if (subject === null || typeof subject !== "object") return subject;
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
		for (let ofIndex = 0, ofList = ownKeys(subject); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
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
function enableClonePatching() {
	if (installed) return;
	installed = [];
	for (let ofIndex = 0, ofList = CLONE_SITES; ofIndex < ofList.length; ofIndex++) {
		const { host, key, native } = ofList[ofIndex];
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
						for (let index = 1; index < args.length; index++) ArrayMethods.push(handed, runtime_reveal(args[index]).value);
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
		ArrayMethods.push(installed, { host, key, layer, wrapper, descriptor });
	}
}

/**
 * `structuredClone` as the platform had it when slothlet loaded, taking slothlet's views of another module's data as
 * the installed wrapper does: slothlet's own copies of data go through this, whatever `globalThis.structuredClone`
 * holds by then.
 * @param {*} value - The value to copy.
 * @returns {*} The copy.
 * @throws {Error} The platform's refusal, where the value holds something it cannot copy and no view of slothlet's.
 * @internal
 * @example
 * const copy = cloneTakingViews({ table: self.vault.table });
 */
export function cloneTakingViews(value) {
	try {
		return structuredClone(value);
	} catch (error) {
		let revealed;
		try {
			revealed = runtime_reveal(value);
		} catch {
			// Whatever reading the value threw is not the caller's to see: the platform's refusal stands.
			throw error;
		}
		if (!revealed.found) throw error;
		return structuredClone(revealed.value);
	}
}

/**
 * Remove this copy's wrappers, putting back what each wrapped where it is still the one installed. Idempotent.
 * @returns {void}
 * @internal
 * @example
 * disableClonePatching();
 */
function disableClonePatching() {
	if (!installed) return;
	for (let ofIndex = 0, ofList = installed; ofIndex < ofList.length; ofIndex++) {
		const { host, key, layer, wrapper } = ofList[ofIndex];
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

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (!mayTakeInternals(consumer, ["lib/handlers/unified-wrapper", "slothlet"]))
		throw ownBindingsRefusal("lib/helpers/clone-context", import.meta.url);
	return { disableClonePatching, enableClonePatching, setCloneNodeReader, setCloneViewReader };
}

/**
 * The files of slothlet's own that took this file's bindings (see {@link internals}). A `var` with no initializer, so a
 * file can take them before this file's top level has run (a cycle of slothlet's own files), and that run does not reset
 * what was taken.
 * @type {object|undefined}
 * @private
 */
var internalsTaken;

/**
 * Whether a file may take this file's bindings: it is one of those listed, and has not taken them yet. Reads no import
 * and no built-in a module can replace, so it answers the same before this file's imports are ready and after.
 * @param {string} consumer - The file asking.
 * @param {string[]} consumers - The files that take them.
 * @returns {boolean} True, once, for each file listed.
 * @private
 */
function mayTakeInternals(consumer, consumers) {
	if (internalsTaken === undefined) internalsTaken = { __proto__: null };
	let listed = false;
	for (let i = 0; i < consumers.length; i++) if (consumers[i] === consumer) listed = true;
	if (!listed || typeof consumer !== "string") return false;
	// Taken already: only a second evaluation of that very file, at its own top level, takes them again.
	if (internalsTaken[consumer] === true) return isOwnTopLevelOf(consumer);
	internalsTaken[consumer] = true;
	return true;
}

// The exports below answer slothlet's own files and the host only (see `guardInternal` in `helpers/instance-imports`).
/** @type {typeof setCloneViewReader} */
const guarded_setCloneViewReader = guardInternal(setCloneViewReader, "setCloneViewReader", import.meta.url);
/** @type {typeof setCloneNodeReader} */
const guarded_setCloneNodeReader = guardInternal(setCloneNodeReader, "setCloneNodeReader", import.meta.url);
/** @type {typeof enableClonePatching} */
const guarded_enableClonePatching = guardInternal(enableClonePatching, "enableClonePatching", import.meta.url);
/** @type {typeof disableClonePatching} */
const guarded_disableClonePatching = guardInternal(disableClonePatching, "disableClonePatching", import.meta.url);
export {
	guarded_setCloneViewReader as setCloneViewReader,
	guarded_setCloneNodeReader as setCloneNodeReader,
	guarded_enableClonePatching as enableClonePatching,
	guarded_disableClonePatching as disableClonePatching
};
