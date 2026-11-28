/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/intrinsics.mjs
 *	@Date: 2026-11-11T10:41:20-08:00 (1794422480)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T21:05:03-08:00 (1794978303)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The language's own functions slothlet's handlers call, taken when slothlet loads.
 *
 * @description
 * Module code runs in the same realm as slothlet and can replace a built-in after slothlet has loaded
 * (`Object.create = …`, `Reflect.get = …`, `globalThis.Proxy = …`). The handlers decide who may read and write what,
 * so a built-in they look up when a check runs is one a module could have replaced to steer the check. Everything here
 * is read once, when this file is first evaluated — before any module's code can run — and the handlers call these
 * references instead of the globals:
 *
 * - `Reflect`, `Objects` and `Arrays` hold the static functions of `Reflect`, `Object` and `Array` on frozen objects
 *   with no prototype. `Reflect` shadows the global of the same name in a file that imports it, so `Reflect.get(…)`
 *   there is the captured function.
 * - `NativeProxy` is the `Proxy` constructor itself: a later `globalThis.Proxy = …` is not what the handlers make their
 *   views with.
 * - `JSON` and `Math` are frozen copies of those namespaces, shadowing the globals like `Reflect`.
 * - `functionSource` is `Function.prototype.toString` applied to a function.
 * - `Map`, `Set`, `WeakMap`, `WeakSet`, `WeakRef`, `Promise` and `Symbol` are those constructors themselves, shadowing
 *   the globals in a file that imports them: `new Map()`, `value instanceof Promise` and `Symbol.iterator` there use
 *   the constructor slothlet loaded with, whatever `globalThis.Map` holds by then.
 * - `Promises` and `Symbols` hold the static functions of `Promise` (bound to it) and `Symbol` on frozen objects with
 *   no prototype, like `Objects` and `Arrays`.
 * - `NativeObject` is the `Object` function itself, for `NativeObject(value)`; its static functions are on `Objects`.
 *   `NativeArray` is the `Array` function itself; its static functions are on `Arrays`.
 * - `Functions` holds the data members of `Function` (`Functions.prototype`) like `Objects` and `Arrays`.
 * - `URL` and `URLSearchParams` are those constructors themselves, shadowing the globals like `Map`.
 * - The other built-ins slothlet uses, under their own names, shadowing the globals like `Map`: `String`, `Boolean`,
 *   `Number`, `BigInt`, `Date`, `RegExp`, `Error` and the other error constructors, `ArrayBuffer`,
 *   `SharedArrayBuffer`, `DataView`, the typed arrays, `FinalizationRegistry`, `Iterator`, `Intl` (a frozen copy, like
 *   `JSON`), `TextDecoder`, `TextEncoder`, `Blob`, `EventTarget`, `MessageChannel`, `CryptoKey`,
 *   `queueMicrotask`, `structuredClone`, `setTimeout`, `clearTimeout`, `setImmediate`, `decodeURIComponent`, `encodeURIComponent`, `parseInt`, `isNaN`,
 *   `Buffer` and `navigator`. Their static functions are on `Strings`, `Numbers`, `Dates`, `Errors`, `ArrayBuffers`,
 *   `Iterators` and `Buffers`.
 * - `NativeProcess` is the host's `process` object, and `Processes` the functions of it slothlet calls, bound to it.
 *
 * This is the one file of slothlet that reads the globals, each as `globalThis.X` when it is evaluated; the lint rule
 * `slothlet/captured-intrinsics` (tools/ci) reports any other read of a built-in in `src/`. Code elsewhere that has to
 * reach the current global on purpose (to patch it, or to write where the host points `console`) writes
 * `globalThis.X`.
 *
 * Methods a value inherits (`array.map`, `map.get`, `promise.then`, the iterator a `for…of` asks an array for) are looked
 * up on the value's prototype when called, and a module can replace them there too. They are taken here as well, each
 * one called with the value first, on frozen objects with no prototype: `ArrayMethods.push(list, value)`,
 * `StringMethods.startsWith(text, prefix)`, `MapMethods.get(map, key)`, and the same for the other built-in
 * prototypes (an accessor such as `Map.prototype.size` is there under its name: `MapMethods.size(map)`). Walking a
 * `Map` or a `Set` goes through `mapEntries`, `mapKeys`, `mapValues` and `setValues`, whose iterators read nothing a
 * module can reach; arrays are walked by index. `copyList`, `concatLists`, `mapList` and `filterList` make arrays
 * without reading `constructor` or `Symbol.species` off the array they start from.
 * The functions themselves, for code that compares a value against one or hands one to `Reflect.apply`, are on
 * `PrototypeFunctions`, by built-in (`PrototypeFunctions.Promise.then`, `PrototypeFunctions.Object.valueOf`). The lint
 * rule reports a member read off a built-in's `prototype` anywhere else in `src/`.
 *
 * @module @cldmv/slothlet/helpers/intrinsics
 * @internal
 */

/**
 * The `Object` function, as it was when slothlet loaded, for `NativeObject(value)`. Its static functions are on
 * `Objects`: the function's own members are the ones a module can replace.
 * @type {ObjectConstructor}
 * @internal
 * @example
 * import { NativeObject } from "#helpers/intrinsics";
 * NativeObject(value) === value; // whether value is an object
 */
export const NativeObject = globalThis.Object;

const NativeReflect = globalThis.Reflect;
const NativePromise = globalThis.Promise;
const NativeSymbol = globalThis.Symbol;
const { getOwnPropertyNames, getOwnPropertyDescriptor, freeze, create } = NativeObject;
const hasOwnAtLoad = NativeObject.hasOwn;
const { apply } = NativeReflect;
const getPrototypeOfNative = NativeReflect.getPrototypeOf;
const ownKeysNative = NativeReflect.ownKeys;
const defineOwnAtLoad = NativeReflect.defineProperty;
const globalThisMap = globalThis.Map;
const globalThisSet = globalThis.Set;
const ArrayFrom = globalThis.Array.from;
const globalThisRegExp = globalThis.RegExp;
const NativeString = globalThis.String;
const NativeNumber = globalThis.Number;
const globalThisTypeError = globalThis.TypeError;
const AsyncGeneratorPrototype = getPrototypeOfNative(getPrototypeOfNative((async function* () {})()));
const GeneratorPrototype = getPrototypeOfNative(getPrototypeOfNative((function* () {})()));

/**
 * A frozen object with no prototype holding what a built-in holds as its own data members under string keys: its
 * functions, and a namespace's constants (`Math.PI`).
 * @param {object|Function} source - The built-in.
 * @returns {object} Its members, by name.
 * @private
 */
function staticsOf(source) {
	const copy = create(null);
	for (const name of getOwnPropertyNames(source)) {
		const descriptor = getOwnPropertyDescriptor(source, name);
		if (descriptor && "value" in descriptor) copy[name] = descriptor.value;
	}
	return freeze(copy);
}

/**
 * A data descriptor with no members beyond its own four. Its prototype is an empty object with no prototype, so a
 * member it lacks (`get`, `set`) reads as absent whatever module code put on `Object.prototype`. Every instance gets
 * the same four members in the same order, so the engine keeps one shape for all of them.
 * @param {*} value - The property's value.
 * @param {boolean} writable - Whether the property is writable.
 * @param {boolean} enumerable - Whether the property is enumerable.
 * @param {boolean} configurable - Whether the property is configurable.
 * @private
 */
function DataDescriptor(value, writable, enumerable, configurable) {
	this.value = value;
	this.writable = writable;
	this.enumerable = enumerable;
	this.configurable = configurable;
}
DataDescriptor.prototype = freeze(create(null));

/**
 * An accessor descriptor with no members beyond its own four; see {@link DataDescriptor}.
 * @param {Function|undefined} get - The getter.
 * @param {Function|undefined} set - The setter.
 * @param {boolean} enumerable - Whether the property is enumerable.
 * @param {boolean} configurable - Whether the property is configurable.
 * @private
 */
function AccessorDescriptor(get, set, enumerable, configurable) {
	this.get = get;
	this.set = set;
	this.enumerable = enumerable;
	this.configurable = configurable;
}
AccessorDescriptor.prototype = freeze(create(null));

/**
 * Copy a descriptor the engine made into a {@link DataDescriptor} or an {@link AccessorDescriptor}. The engine's
 * descriptor always holds all four of its members as its own, so each read below finds an own member and nothing on
 * `Object.prototype` is consulted. Copying is several times cheaper than giving the engine's object a new prototype.
 * @param {PropertyDescriptor} descriptor - A complete descriptor from `getOwnPropertyDescriptor`.
 * @returns {PropertyDescriptor} The copy.
 * @private
 */
function plainDescriptor(descriptor) {
	return hasOwnAtLoad(descriptor, "value")
		? new DataDescriptor(descriptor.value, descriptor.writable, descriptor.enumerable, descriptor.configurable)
		: new AccessorDescriptor(descriptor.get, descriptor.set, descriptor.enumerable, descriptor.configurable);
}

/**
 * {@link staticsOf} for `Reflect` or `Object`, with `getOwnPropertyDescriptor` (and `Object.getOwnPropertyDescriptors`)
 * answering descriptors that inherit nothing: a member a descriptor lacks (`get` on a data descriptor, `value` on an
 * accessor) reads as absent, whatever module code put on `Object.prototype`, and a descriptor handed back to
 * `defineProperty` or a proxy trap is read for its own members only.
 * @param {object|Function} source - `Reflect` or `Object`.
 * @returns {object} Its members, by name.
 * @private
 */
function withPlainDescriptors(source) {
	const copy = create(null);
	const names = getOwnPropertyNames(source);
	for (let i = 0; i < names.length; i++) {
		const descriptor = getOwnPropertyDescriptor(source, names[i]);
		if (descriptor && "value" in descriptor) copy[names[i]] = descriptor.value;
	}
	const describe = copy.getOwnPropertyDescriptor;
	copy.getOwnPropertyDescriptor = (target, key) => {
		const descriptor = describe(target, key);
		return descriptor === undefined ? undefined : plainDescriptor(descriptor);
	};
	if (typeof copy.getOwnPropertyDescriptors === "function") {
		const describeAll = copy.getOwnPropertyDescriptors;
		copy.getOwnPropertyDescriptors = (target) => {
			const all = describeAll(target);
			const keys = ownKeysNative(all);
			const plain = create(null);
			for (let i = 0; i < keys.length; i++) plain[keys[i]] = plainDescriptor(all[keys[i]]);
			return plain;
		};
	}
	return freeze(copy);
}

/**
 * The functions of `Reflect`, as they were when slothlet loaded.
 * @type {typeof globalThis.Reflect}
 * @internal
 * @example
 * import { Reflect } from "#helpers/intrinsics";
 * Reflect.getOwnPropertyDescriptor(value, "constructor");
 */
export const Reflect = withPlainDescriptors(NativeReflect);

/**
 * The static functions of `Object`, as they were when slothlet loaded.
 * @type {ObjectConstructor}
 * @internal
 * @example
 * import { Objects } from "#helpers/intrinsics";
 * Objects.keys(value);
 */
export const Objects = withPlainDescriptors(NativeObject);

/**
 * The static functions of `Array`, as they were when slothlet loaded. `Arrays.from` and `Arrays.of` make plain arrays.
 * @type {ArrayConstructor}
 * @internal
 * @example
 * import { Arrays } from "#helpers/intrinsics";
 * Arrays.isArray(value);
 */
export const Arrays = staticsOf(globalThis.Array);

/**
 * The data members of `Function` (its `prototype`), as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { Functions } from "#helpers/intrinsics";
 * Reflect.getPrototypeOf(value) === Functions.prototype;
 */
export const Functions = staticsOf(globalThis.Function);

/**
 * The `Function` constructor, as it was when slothlet loaded: for checking whether the host lets code be made from a
 * string (the permission baseline), whatever `globalThis.Function` holds afterwards.
 * @type {FunctionConstructor}
 * @internal
 * @example
 * import { NativeFunction } from "#helpers/intrinsics";
 * new NativeFunction("return 1"); // throws EvalError where code from strings is refused
 */
export const NativeFunction = globalThis.Function;

/** @type {JSON} */
const NativeJSON = staticsOf(globalThis.JSON);
/** @type {Math} */
const NativeMath = staticsOf(globalThis.Math);

/**
 * The function under every `toString` wrapper a copy of slothlet installed (see helpers/function-source-context): each
 * holds what it wraps under a registered symbol, so a copy loaded while another's instance is up still takes the
 * language's own function.
 * @param {Function} fn - `Function.prototype.toString` as found.
 * @returns {Function} The function under the wrappers.
 * @private
 */
function unwrapToString(fn) {
	const marker = NativeSymbol.for("slothlet.functionSource.original");
	let current = fn;
	for (let depth = 0; depth < 16; depth++) {
		const below = getOwnPropertyDescriptor(current, marker)?.value;
		if (typeof below !== "function") break;
		current = below;
	}
	return current;
}

/**
 * `Function.prototype.toString` itself, as it was when slothlet loaded (the language's own, under any wrapper another
 * copy of slothlet had installed then).
 * @type {Function}
 * @internal
 * @example
 * value === functionToString; // whether a member read is the language's own `toString`
 */
export const functionToString = unwrapToString(globalThis.Function.prototype.toString);

/**
 * The source text of a function, by the language's own `Function.prototype.toString` as it was when slothlet loaded.
 * @param {Function} fn - The function.
 * @returns {string} Its source text.
 * @internal
 * @example
 * functionSource(Math.max); // "function max() { [native code] }"
 */
export function functionSource(fn) {
	return apply(functionToString, fn, []);
}

/**
 * The `Proxy` constructor, as it was when slothlet loaded.
 * @type {Function}
 * @internal
 * @example
 * import { NativeProxy } from "#helpers/intrinsics";
 * const view = new NativeProxy(shadow, handler);
 */
export const NativeProxy = globalThis.Proxy;

/**
 * The `Map` constructor, as it was when slothlet loaded.
 * @type {MapConstructor}
 * @internal
 * @example
 * import { Map } from "#helpers/intrinsics";
 * const seen = new Map();
 */
export const Map = globalThis.Map;

/**
 * The `Set` constructor, as it was when slothlet loaded.
 * @type {SetConstructor}
 * @internal
 * @example
 * import { Set } from "#helpers/intrinsics";
 * const seen = new Set();
 */
export const Set = globalThis.Set;

/**
 * The `WeakMap` constructor, as it was when slothlet loaded.
 * @type {WeakMapConstructor}
 * @internal
 * @example
 * import { WeakMap } from "#helpers/intrinsics";
 * const views = new WeakMap();
 */
export const WeakMap = globalThis.WeakMap;

/**
 * The `WeakSet` constructor, as it was when slothlet loaded.
 * @type {WeakSetConstructor}
 * @internal
 * @example
 * import { WeakSet } from "#helpers/intrinsics";
 * const marked = new WeakSet();
 */
export const WeakSet = globalThis.WeakSet;

/**
 * The `WeakRef` constructor, as it was when slothlet loaded.
 * @type {WeakRefConstructor}
 * @internal
 * @example
 * import { WeakRef } from "#helpers/intrinsics";
 * const ref = new WeakRef(target);
 */
export const WeakRef = globalThis.WeakRef;

/**
 * The `Promise` constructor, as it was when slothlet loaded. Its static functions are on `Promises`.
 * @type {PromiseConstructor}
 * @internal
 * @example
 * import { Promise } from "#helpers/intrinsics";
 * const done = new Promise((resolve) => setImmediate(resolve));
 */
export const Promise = NativePromise;

/**
 * The `Symbol` function, as it was when slothlet loaded. The well-known symbols (`Symbol.iterator`, …) are read from
 * it; `Symbol.for` and `Symbol.keyFor` are on `Symbols`.
 * @type {SymbolConstructor}
 * @internal
 * @example
 * import { Symbol } from "#helpers/intrinsics";
 * const marker = Symbol("marker");
 */
export const Symbol = NativeSymbol;

/**
 * Bind the named functions of a built-in to it, on a frozen object with no prototype. A name the built-in does not hold
 * as a function (a host without it) is left out.
 * @param {Function|object|undefined} holder - The built-in, or undefined where the host has none.
 * @param {string[]} names - The functions to take.
 * @returns {object} The bound functions, by name.
 * @private
 */
function boundStaticsOf(holder, names) {
	const copy = create(null);
	for (const name of names) {
		const fn = holder?.[name];
		if (typeof fn === "function") copy[name] = (...args) => apply(fn, holder, args);
	}
	return freeze(copy);
}

/**
 * The named data members of a built-in, on a frozen object with no prototype, as {@link staticsOf} takes all of them.
 * @param {Function|object} source - The built-in.
 * @param {string[]} names - The members to take.
 * @returns {object} Its members, by name.
 * @private
 */
function pickedStaticsOf(source, names) {
	const copy = create(null);
	for (const name of names) {
		const descriptor = getOwnPropertyDescriptor(source, name);
		if (descriptor && "value" in descriptor) copy[name] = descriptor.value;
	}
	return freeze(copy);
}

/**
 * `Promise.resolve`, `reject`, `all`, `allSettled`, `race` and `any`, as they were when slothlet loaded, each called
 * on the `Promise` constructor slothlet loaded with.
 * @type {PromiseConstructor}
 * @internal
 * @example
 * import { Promises } from "#helpers/intrinsics";
 * await Promises.all(pending);
 */
export const Promises = boundStaticsOf(NativePromise, ["resolve", "reject", "all", "allSettled", "race", "any"]);

/**
 * `Symbol.for` and `Symbol.keyFor`, as they were when slothlet loaded.
 * @type {SymbolConstructor}
 * @internal
 * @example
 * import { Symbols } from "#helpers/intrinsics";
 * Symbols.for("nodejs.util.inspect.custom");
 */
export const Symbols = boundStaticsOf(NativeSymbol, ["for", "keyFor"]);

/**
 * The `URL` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * import { URL } from "#helpers/intrinsics";
 * const href = new URL("./a.mjs", import.meta.url).href;
 */
export const URL = globalThis.URL;

/**
 * `URL.createObjectURL` and `URL.revokeObjectURL`, as they were when slothlet loaded (absent where the host has none).
 * Unbound: call them with `URL` as `this`.
 * @type {{createObjectURL?: function(Blob): string, revokeObjectURL?: function(string): void}}
 * @internal
 * @example
 * import { URL, URLs } from "#helpers/intrinsics";
 * const href = Reflect.apply(URLs.createObjectURL, URL, [blob]);
 */
export const URLs = pickedStaticsOf(globalThis.URL, ["createObjectURL", "revokeObjectURL"]);

/**
 * The `URLSearchParams` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * import { URLSearchParams } from "#helpers/intrinsics";
 * new URLSearchParams(query).get("slothlet_instance");
 */
export const URLSearchParams = globalThis.URLSearchParams;

/**
 * The `String` function, as it was when slothlet loaded. Its static functions are on `Strings`.
 * @internal
 * @example
 * String(value); // the language's own conversion
 */
export const String = globalThis.String;

/**
 * The static functions of `String` (`fromCharCode`, `fromCodePoint`, `raw`), as they were when slothlet loaded.
 * @type {StringConstructor}
 * @internal
 * @example
 * import { Strings } from "#helpers/intrinsics";
 * Strings.fromCharCode(0x41); // "A"
 */
export const Strings = staticsOf(globalThis.String);

/**
 * The `Boolean` function, as it was when slothlet loaded.
 * @internal
 * @example
 * Boolean(value);
 */
export const Boolean = globalThis.Boolean;

/**
 * The `Number` function, as it was when slothlet loaded. Its static functions and constants are on `Numbers`.
 * @internal
 * @example
 * Number(value);
 */
export const Number = globalThis.Number;

/**
 * The static functions and constants of `Number`, as they were when slothlet loaded.
 * @type {NumberConstructor}
 * @internal
 * @example
 * import { Numbers } from "#helpers/intrinsics";
 * Numbers.isFinite(value);
 */
export const Numbers = staticsOf(globalThis.Number);

/**
 * The `BigInt` function, as it was when slothlet loaded.
 * @internal
 * @example
 * BigInt(1);
 */
export const BigInt = globalThis.BigInt;

/**
 * The `Date` constructor, as it was when slothlet loaded. `Date.now` and the other static functions are on `Dates`.
 * @internal
 * @example
 * new Date(time);
 */
export const Date = globalThis.Date;

/**
 * The static functions of `Date` (`now`, `parse`, `UTC`), as they were when slothlet loaded.
 * @type {DateConstructor}
 * @internal
 * @example
 * import { Dates } from "#helpers/intrinsics";
 * const started = Dates.now();
 */
export const Dates = staticsOf(globalThis.Date);

/**
 * The `RegExp` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new RegExp(pattern, "u");
 */
export const RegExp = globalThis.RegExp;

/**
 * The `Error` constructor, as it was when slothlet loaded: the realm's own, which the engine reads `stackTraceLimit` and
 * `prepareStackTrace` from. `class SlothletError extends Error` extends this one. `Error.captureStackTrace` and
 * `Error.isError` are on `Errors`.
 * @internal
 * @example
 * import { Error } from "#helpers/intrinsics";
 * throw new Error("message");
 */
export const Error = globalThis.Error;

/**
 * `Error.captureStackTrace` and `Error.isError` (where the engine has them), as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { Errors } from "#helpers/intrinsics";
 * Errors.captureStackTrace(error, constructorOpt);
 */
export const Errors = pickedStaticsOf(globalThis.Error, ["captureStackTrace", "isError"]);

/**
 * The `EvalError` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new EvalError("message");
 */
export const EvalError = globalThis.EvalError;

/**
 * The `RangeError` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new RangeError("message");
 */
export const RangeError = globalThis.RangeError;

/**
 * The `ReferenceError` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new ReferenceError("message");
 */
export const ReferenceError = globalThis.ReferenceError;

/**
 * The `SyntaxError` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new SyntaxError("message");
 */
export const SyntaxError = globalThis.SyntaxError;

/**
 * The `TypeError` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new TypeError("message");
 */
export const TypeError = globalThis.TypeError;

/**
 * The `URIError` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new URIError("message");
 */
export const URIError = globalThis.URIError;

/**
 * The `AggregateError` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new AggregateError("message");
 */
export const AggregateError = globalThis.AggregateError;

/**
 * The `ArrayBuffer` constructor, as it was when slothlet loaded. `ArrayBuffer.isView` is on `ArrayBuffers`.
 * @internal
 * @example
 * new ArrayBuffer(8);
 */
export const ArrayBuffer = globalThis.ArrayBuffer;

/**
 * The static functions of `ArrayBuffer` (`isView`), as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { ArrayBuffers } from "#helpers/intrinsics";
 * ArrayBuffers.isView(value);
 */
export const ArrayBuffers = staticsOf(globalThis.ArrayBuffer);

/**
 * The `SharedArrayBuffer` constructor, or undefined where the host has none (a browser page that is not cross-origin isolated), as it was when slothlet loaded.
 * @internal
 * @example
 * typeof SharedArrayBuffer === "function";
 */
export const SharedArrayBuffer = globalThis.SharedArrayBuffer;

/**
 * The `DataView` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new DataView(buffer);
 */
export const DataView = globalThis.DataView;

/**
 * The `Int8Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Int8Array(8);
 */
export const Int8Array = globalThis.Int8Array;

/**
 * The `Uint8Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Uint8Array(8);
 */
export const Uint8Array = globalThis.Uint8Array;

/**
 * The `Uint8ClampedArray` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Uint8ClampedArray(8);
 */
export const Uint8ClampedArray = globalThis.Uint8ClampedArray;

/**
 * The `Int16Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Int16Array(8);
 */
export const Int16Array = globalThis.Int16Array;

/**
 * The `Uint16Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Uint16Array(8);
 */
export const Uint16Array = globalThis.Uint16Array;

/**
 * The `Int32Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Int32Array(8);
 */
export const Int32Array = globalThis.Int32Array;

/**
 * The `Uint32Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Uint32Array(8);
 */
export const Uint32Array = globalThis.Uint32Array;

/**
 * The `Float32Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Float32Array(8);
 */
export const Float32Array = globalThis.Float32Array;

/**
 * The `Float64Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Float64Array(8);
 */
export const Float64Array = globalThis.Float64Array;

/**
 * The `BigInt64Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new BigInt64Array(8);
 */
export const BigInt64Array = globalThis.BigInt64Array;

/**
 * The `BigUint64Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new BigUint64Array(8);
 */
export const BigUint64Array = globalThis.BigUint64Array;

/**
 * The shape of the `Float16Array` constructor, which the declaration build's library does not know: the same members
 * as `Float32ArrayConstructor` (its instances are typed arrays over numbers).
 * @typedef {Float32ArrayConstructor} Float16ArrayConstructor
 * @internal
 */

/**
 * The `Float16Array` constructor, or undefined where the engine has none, as it was when slothlet loaded.
 * @internal
 * @example
 * typeof Float16Array === "function";
 * @type {Float16ArrayConstructor|undefined}
 */
export const Float16Array = globalThis.Float16Array;

/**
 * The `FinalizationRegistry` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new FinalizationRegistry(cleanup);
 */
export const FinalizationRegistry = globalThis.FinalizationRegistry;

/**
 * The shape of the `Iterator` constructor, which the declaration build's library does not know: the members slothlet
 * reads (`Iterator.prototype`, `Iterator.from`).
 * @typedef {object} IteratorConstructor
 * @property {object} prototype - `Iterator.prototype`.
 * @property {function(object): object} from - `Iterator.from`.
 * @internal
 */

/**
 * The `Iterator` constructor, or undefined where the engine has none, as it was when slothlet loaded. `Iterator.from` is on `Iterators`.
 * @internal
 * @example
 * Iterator.prototype;
 * @type {IteratorConstructor|undefined}
 */
export const Iterator = globalThis.Iterator;

/**
 * The static functions of `Iterator` (`from`), as they were when slothlet loaded; empty where the engine has no
 * `Iterator`.
 * @type {object}
 * @internal
 * @example
 * import { Iterators } from "#helpers/intrinsics";
 * Iterators.from(iterable);
 */
export const Iterators = globalThis.Iterator ? staticsOf(globalThis.Iterator) : freeze(create(null));

/**
 * The members of `Intl` (its constructors, `Intl.Segmenter` among them), as they were when slothlet loaded, shadowing
 * the global like `JSON`.
 * @type {typeof globalThis.Intl}
 * @internal
 * @example
 * import { Intl } from "#helpers/intrinsics";
 * new Intl.Segmenter();
 */
export const Intl = staticsOf(globalThis.Intl);

/**
 * The `TextDecoder` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new TextDecoder().decode(bytes);
 */
export const TextDecoder = globalThis.TextDecoder;

/**
 * The `TextEncoder` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new TextEncoder().encode(text);
 */
export const TextEncoder = globalThis.TextEncoder;

/**
 * The `Blob` constructor, or undefined where the host has none, as it was when slothlet loaded.
 * @internal
 * @example
 * new Blob([text]);
 */
export const Blob = globalThis.Blob;

/**
 * The `EventTarget` constructor, or undefined where the host has none, as it was when slothlet loaded.
 * @internal
 * @example
 * EventTarget.prototype.addEventListener;
 */
export const EventTarget = globalThis.EventTarget;

/**
 * The `MessageChannel` constructor, or undefined where the host has none, as it was when slothlet loaded.
 * @internal
 * @example
 * new MessageChannel();
 */
export const MessageChannel = globalThis.MessageChannel;

/**
 * The Web Crypto `CryptoKey` constructor, as it was when slothlet loaded, or undefined where the host has none.
 * @internal
 * @example
 * import { CryptoKey } from "#helpers/intrinsics";
 * typeof CryptoKey === "function";
 */
export const CryptoKey = globalThis.CryptoKey;

/**
 * `queueMicrotask`, as it was when slothlet loaded: the host's own, under none of the boundary patches.
 * @internal
 * @example
 * import { queueMicrotask } from "#helpers/intrinsics";
 * queueMicrotask(() => settle());
 */
export const queueMicrotask = globalThis.queueMicrotask;

/**
 * `structuredClone`, as it was when slothlet loaded: the host's own, under none of the boundary patches.
 * @internal
 * @example
 * import { structuredClone } from "#helpers/intrinsics";
 * structuredClone({ a: 1 });
 */
export const structuredClone = globalThis.structuredClone;

/**
 * `setTimeout`, as it was when slothlet loaded: the host's own, under none of the boundary patches.
 * @internal
 * @example
 * import { setTimeout } from "#helpers/intrinsics";
 * setTimeout(run, 0);
 */
export const setTimeout = globalThis.setTimeout;

/**
 * `clearTimeout`, as it was when slothlet loaded: the host's own, under none of the boundary patches.
 * @internal
 * @example
 * import { setTimeout, clearTimeout } from "#helpers/intrinsics";
 * clearTimeout(setTimeout(run, 1000));
 */
export const clearTimeout = globalThis.clearTimeout;

/**
 * The shape of `setImmediate`, which the declaration build's library does not know: it takes a callback and the
 * arguments to hand it, and answers the handle.
 * @typedef {function(function(...unknown): void, ...unknown): unknown} ImmediateScheduler
 * @internal
 */

/**
 * `setImmediate`, as it was when slothlet loaded, or undefined where the host has none (a browser).
 * @internal
 * @example
 * import { setImmediate } from "#helpers/intrinsics";
 * setImmediate?.(run);
 * @type {ImmediateScheduler|undefined}
 */
export const setImmediate = globalThis.setImmediate;

/**
 * `decodeURIComponent`, as it was when slothlet loaded.
 * @internal
 * @example
 * decodeURIComponent("%20"); // " "
 */
export const decodeURIComponent = globalThis.decodeURIComponent;

/**
 * `encodeURIComponent`, as it was when slothlet loaded.
 * @internal
 * @example
 * encodeURIComponent(" "); // "%20"
 */
export const encodeURIComponent = globalThis.encodeURIComponent;

/**
 * `parseInt`, as it was when slothlet loaded.
 * @internal
 * @example
 * parseInt("ff", 16); // 255
 */
export const parseInt = globalThis.parseInt;

/**
 * `isNaN`, as it was when slothlet loaded.
 * @internal
 * @example
 * isNaN(value);
 */
export const isNaN = globalThis.isNaN;

/**
 * The members of the host's `process` object that slothlet reads where they are used.
 * @typedef {object} HostProcess
 * @property {Object<string, string|undefined>} env - The environment.
 * @property {string[]} argv - The command line.
 * @property {Object<string, string|undefined>} versions - The versions of the runtime and its parts.
 * @property {string} platform - The platform.
 * @property {number} pid - The process ID.
 * @internal
 */

/**
 * The host's `process` object, as it was when slothlet loaded, or undefined where there is none (a browser). Its data
 * members (`env`, `pid`, `argv`, `versions`, `platform`) are read off it where they are used; the functions slothlet
 * calls are on `Processes`.
 * @internal
 * @example
 * import { NativeProcess } from "#helpers/intrinsics";
 * NativeProcess?.env.SLOTHLET_DEBUG;
 * @type {HostProcess|undefined}
 */
export const NativeProcess = globalThis.process;

/**
 * vitest's worker global, as it was when slothlet loaded, or undefined outside vitest: what the permission baseline
 * reads to tell whether it runs under vitest.
 * @internal
 * @example
 * import { VitestWorker } from "#helpers/intrinsics";
 * const underVitest = (VitestWorker ?? null) !== null;
 * @type {object|undefined}
 */
export const VitestWorker = globalThis.__vitest_worker__;

/**
 * The functions of `process` slothlet calls (`cwd`, `getBuiltinModule`, `nextTick`, `binding`, `kill`, `getuid`,
 * `exit`, `send`), as they were when slothlet loaded, each called on that `process`. A function the host lacks is
 * absent: in a browser the object is empty.
 * @type {object}
 * @internal
 * @example
 * import { Processes } from "#helpers/intrinsics";
 * const fs = Processes.getBuiltinModule?.("node:fs");
 */
export const Processes = boundStaticsOf(globalThis.process, [
	"cwd",
	"getBuiltinModule",
	"nextTick",
	"binding",
	"kill",
	"getuid",
	"exit",
	"send"
]);

/**
 * The members of Node's `Buffer` constructor that slothlet reads (`instanceof Buffer`, `Buffer.from`).
 * @typedef {object} HostBufferConstructor
 * @property {Uint8Array} prototype - `Buffer.prototype`.
 * @property {function((string|ArrayBuffer|ArrayLike<number>), string=): Uint8Array} from - `Buffer.from`.
 * @property {function(unknown): boolean} isBuffer - `Buffer.isBuffer`.
 * @internal
 */

/**
 * Node's `Buffer` constructor, as it was when slothlet loaded, or undefined where there is none (a browser).
 * `Buffer.from` is on `Buffers`.
 * @internal
 * @example
 * import { Buffer } from "#helpers/intrinsics";
 * value instanceof Buffer;
 * @type {HostBufferConstructor|undefined}
 */
export const Buffer = globalThis.Buffer;

/**
 * `Buffer.from`, as it was when slothlet loaded, called on that `Buffer`; empty where there is none.
 * @type {object}
 * @internal
 * @example
 * import { Buffers } from "#helpers/intrinsics";
 * Buffers.from(text, "utf8");
 */
export const Buffers = boundStaticsOf(globalThis.Buffer, ["from"]);

/**
 * The host's `navigator` object, as it was when slothlet loaded, or undefined where there is none. Its `language` and
 * `languages` are read off it where they are used.
 * @internal
 * @example
 * import { navigator } from "#helpers/intrinsics";
 * navigator?.languages;
 */
export const navigator = globalThis.navigator;

/**
 * `Function.prototype.call` bound to a function: called with the receiver first, then the arguments, it runs the
 * function as the language's own `call` would, with no member read when it is called (Node's `uncurryThis`).
 * @type {function(Function): Function}
 * @private
 */
const uncurryThis = apply(globalThis.Function.prototype.bind, globalThis.Function.prototype.bind, [globalThis.Function.prototype.call]);

/**
 * The functions and accessors a built-in prototype holds under string keys, each taking its receiver first, on a frozen
 * object with no prototype. An accessor is there under its name and returns what its getter returns
 * (`MapMethods.size(map)`). `constructor` is left out.
 * @param {object|undefined} proto - The prototype, or undefined where the host has none.
 * @param {Object<string, symbol>} [symbols] - Symbol-keyed functions to take too, by the name to take them under.
 * @returns {object} The functions, by name.
 * @private
 */
function methodsOf(proto, symbols) {
	const copy = create(null);
	if (!proto) return freeze(copy);
	const names = getOwnPropertyNames(proto);
	for (let i = 0; i < names.length; i++) {
		const name = names[i];
		if (name === "constructor") continue;
		const descriptor = getOwnPropertyDescriptor(proto, name);
		if (typeof descriptor.value === "function") copy[name] = uncurryThis(descriptor.value);
		else if (typeof descriptor.get === "function") copy[name] = uncurryThis(descriptor.get);
	}
	if (symbols) {
		const keys = getOwnPropertyNames(symbols);
		for (let i = 0; i < keys.length; i++) {
			const descriptor = getOwnPropertyDescriptor(proto, symbols[keys[i]]);
			if (descriptor && typeof descriptor.value === "function") copy[keys[i]] = uncurryThis(descriptor.value);
		}
	}
	return freeze(copy);
}

/**
 * The methods of `Array.prototype`, as they were when slothlet loaded, each taking the array first.
 * `map`, `filter`, `slice`, `splice`, `concat`, `flat` and `flatMap` read the array's `constructor` to make their
 * result; `mapList`, `filterList`, `copyList` and `concatLists` do not.
 * @type {object}
 * @internal
 * @example
 * import { ArrayMethods } from "#helpers/intrinsics";
 * ArrayMethods.push(list, value);
 */
export const ArrayMethods = methodsOf(globalThis.Array.prototype);

/**
 * The methods of `String.prototype`, as they were when slothlet loaded, each taking the string first.
 * @type {object}
 * @internal
 * @example
 * import { StringMethods } from "#helpers/intrinsics";
 * StringMethods.startsWith(text, "node:");
 */
export const StringMethods = methodsOf(globalThis.String.prototype);

/**
 * The methods of `Map.prototype` (and its `size`), as they were when slothlet loaded, each taking the map first.
 * @type {object}
 * @internal
 * @example
 * import { MapMethods } from "#helpers/intrinsics";
 * MapMethods.get(map, key);
 */
export const MapMethods = methodsOf(globalThis.Map.prototype);

/**
 * The methods of `Set.prototype` (and its `size`), as they were when slothlet loaded, each taking the set first.
 * @type {object}
 * @internal
 * @example
 * import { SetMethods } from "#helpers/intrinsics";
 * SetMethods.has(set, value);
 */
export const SetMethods = methodsOf(globalThis.Set.prototype);

/**
 * The methods of `WeakMap.prototype`, as they were when slothlet loaded, each taking the map first.
 * @type {object}
 * @internal
 * @example
 * import { WeakMapMethods } from "#helpers/intrinsics";
 * WeakMapMethods.get(views, target);
 */
export const WeakMapMethods = methodsOf(globalThis.WeakMap.prototype);

/**
 * The methods of `WeakSet.prototype`, as they were when slothlet loaded, each taking the set first.
 * @type {object}
 * @internal
 * @example
 * import { WeakSetMethods } from "#helpers/intrinsics";
 * WeakSetMethods.has(seen, value);
 */
export const WeakSetMethods = methodsOf(globalThis.WeakSet.prototype);

/**
 * The methods of `EventTarget.prototype`, as they were when slothlet loaded, each taking the target first: below
 * slothlet's own listener patch. Empty where the host has no `EventTarget`.
 * @type {object}
 * @internal
 * @example
 * import { EventTargetMethods } from "#helpers/intrinsics";
 * EventTargetMethods.addEventListener(signal, "abort", onAbort, { once: true });
 */
export const EventTargetMethods = methodsOf(globalThis.EventTarget?.prototype);

/**
 * The methods of `WeakRef.prototype` (`deref`), as they were when slothlet loaded, each taking the reference first.
 * @type {object}
 * @internal
 * @example
 * import { WeakRefMethods } from "#helpers/intrinsics";
 * WeakRefMethods.deref(ref);
 */
export const WeakRefMethods = methodsOf(globalThis.WeakRef.prototype);

/**
 * The methods and flag accessors of `RegExp.prototype`, as they were when slothlet loaded, each taking the expression
 * first; its symbol-keyed methods are under `symbolReplace`, `symbolSplit`, `symbolMatch`, `symbolMatchAll` and
 * `symbolSearch`. `exec` is the one that reads nothing else off the expression; `test` reads `exec` off it.
 * @type {object}
 * @internal
 * @example
 * import { RegExpMethods } from "#helpers/intrinsics";
 * RegExpMethods.exec(pattern, text) !== null;
 */
export const RegExpMethods = methodsOf(globalThis.RegExp.prototype, {
	symbolReplace: NativeSymbol.replace,
	symbolSplit: NativeSymbol.split,
	symbolMatch: NativeSymbol.match,
	symbolMatchAll: NativeSymbol.matchAll,
	symbolSearch: NativeSymbol.search
});

/**
 * The methods of `Promise.prototype` (`then`, `catch`, `finally`), as they were when slothlet loaded, each taking the
 * promise first.
 * @type {object}
 * @internal
 * @example
 * import { PromiseMethods } from "#helpers/intrinsics";
 * PromiseMethods.then(promise, onFulfilled, onRejected);
 */
export const PromiseMethods = methodsOf(NativePromise.prototype);

/**
 * The methods of `Function.prototype` (`call`, `apply`, `bind`, `toString`), as they were when slothlet loaded, each
 * taking the function first: `FunctionMethods.call(fn, thisArg, a, b)` runs `fn` as `fn.call(thisArg, a, b)` would.
 * @type {object}
 * @internal
 * @example
 * import { FunctionMethods } from "#helpers/intrinsics";
 * FunctionMethods.bind(fn, receiver);
 */
export const FunctionMethods = methodsOf(globalThis.Function.prototype);

/**
 * The methods of `Object.prototype` (`hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `toString`, …), as
 * they were when slothlet loaded, each taking the value first.
 * @type {object}
 * @internal
 * @example
 * import { ObjectMethods } from "#helpers/intrinsics";
 * ObjectMethods.hasOwnProperty(value, "key");
 */
export const ObjectMethods = methodsOf(NativeObject.prototype);

/**
 * The methods of `Number.prototype`, as they were when slothlet loaded, each taking the number first.
 * @type {object}
 * @internal
 * @example
 * import { NumberMethods } from "#helpers/intrinsics";
 * NumberMethods.toString(255, 16); // "ff"
 */
export const NumberMethods = methodsOf(globalThis.Number.prototype);

/**
 * The methods of `Date.prototype`, as they were when slothlet loaded, each taking the date first.
 * @type {object}
 * @internal
 * @example
 * import { DateMethods } from "#helpers/intrinsics";
 * DateMethods.toISOString(date);
 */
export const DateMethods = methodsOf(globalThis.Date.prototype);

/**
 * The methods and accessors of `Symbol.prototype` (`description`, `toString`), as they were when slothlet loaded,
 * each taking the symbol first.
 * @type {object}
 * @internal
 * @example
 * import { SymbolMethods } from "#helpers/intrinsics";
 * SymbolMethods.description(marker);
 */
export const SymbolMethods = methodsOf(NativeSymbol.prototype);

/**
 * The methods of `Error.prototype` (`toString`), as they were when slothlet loaded, each taking the error first.
 * @type {object}
 * @internal
 * @example
 * import { ErrorMethods } from "#helpers/intrinsics";
 * ErrorMethods.toString(error);
 */
export const ErrorMethods = methodsOf(globalThis.Error.prototype);

/**
 * The methods and accessors the typed arrays share (`length`, `byteLength`, `buffer`, `subarray`, `set`, …), as they
 * were when slothlet loaded, each taking the typed array first.
 * @type {object}
 * @internal
 * @example
 * import { TypedArrayMethods } from "#helpers/intrinsics";
 * TypedArrayMethods.length(bytes);
 */
export const TypedArrayMethods = methodsOf(getPrototypeOfNative(globalThis.Uint8Array.prototype));

/**
 * The methods and accessors of `ArrayBuffer.prototype` (`byteLength`, `slice`, …), as they were when slothlet loaded,
 * each taking the buffer first.
 * @type {object}
 * @internal
 * @example
 * import { ArrayBufferMethods } from "#helpers/intrinsics";
 * ArrayBufferMethods.byteLength(buffer);
 */
export const ArrayBufferMethods = methodsOf(globalThis.ArrayBuffer.prototype);

/**
 * The methods and accessors of `URL.prototype` (`href`, `pathname`, `searchParams`, `toString`, …), as they were when
 * slothlet loaded, each taking the URL first.
 * @type {object}
 * @internal
 * @example
 * import { URLMethods } from "#helpers/intrinsics";
 * URLMethods.href(new URL("./a.mjs", base));
 */
export const URLMethods = methodsOf(globalThis.URL?.prototype);

/**
 * The methods of `URLSearchParams.prototype`, as they were when slothlet loaded, each taking the parameters first.
 * @type {object}
 * @internal
 * @example
 * import { URLSearchParamsMethods } from "#helpers/intrinsics";
 * URLSearchParamsMethods.get(params, "slothlet_instance");
 */
export const URLSearchParamsMethods = methodsOf(globalThis.URLSearchParams?.prototype);

/**
 * The methods and accessors of `TextDecoder.prototype` (`decode`, `encoding`, …), as they were when slothlet loaded,
 * each taking the decoder first; empty where the host has none.
 * @type {object}
 * @internal
 * @example
 * import { TextDecoderMethods } from "#helpers/intrinsics";
 * TextDecoderMethods.decode(new TextDecoder(), bytes);
 */
export const TextDecoderMethods = methodsOf(globalThis.TextDecoder?.prototype);

/**
 * The methods and accessors of `TextEncoder.prototype` (`encode`, …), as they were when slothlet loaded, each taking
 * the encoder first; empty where the host has none.
 * @type {object}
 * @internal
 * @example
 * import { TextEncoderMethods } from "#helpers/intrinsics";
 * TextEncoderMethods.encode(new TextEncoder(), text);
 */
export const TextEncoderMethods = methodsOf(globalThis.TextEncoder?.prototype);

/**
 * The methods of Node's `Buffer.prototype` (`toString`, …), as they were when slothlet loaded, each taking the buffer
 * first; empty where the host has none (a browser).
 * @type {object}
 * @internal
 * @example
 * import { BufferMethods } from "#helpers/intrinsics";
 * BufferMethods.toString(chunk, "utf8");
 */
export const BufferMethods = methodsOf(globalThis.Buffer?.prototype);

/**
 * The methods of `FinalizationRegistry.prototype` (`register`, `unregister`), as they were when slothlet loaded, each
 * taking the registry first.
 * @type {object}
 * @internal
 * @example
 * import { FinalizationRegistryMethods } from "#helpers/intrinsics";
 * FinalizationRegistryMethods.register(registry, target, held);
 */
export const FinalizationRegistryMethods = methodsOf(globalThis.FinalizationRegistry.prototype);

/**
 * The `next` (and a generator's `return`) of the iterators the language makes, as they were when slothlet loaded,
 * each taking the iterator first: `arrayNext`, `mapNext`, `setNext`, `stringNext`, `regExpStringNext`,
 * `generatorNext`, `generatorReturn`, `generatorThrow`.
 * @type {object}
 * @internal
 * @example
 * import { IteratorMethods } from "#helpers/intrinsics";
 * IteratorMethods.mapNext(iterator);
 */
export const IteratorMethods = freeze({
	__proto__: null,
	arrayNext: uncurryThis(getPrototypeOfNative([][NativeSymbol.iterator]()).next),
	mapNext: uncurryThis(getPrototypeOfNative(new globalThis.Map()[NativeSymbol.iterator]()).next),
	setNext: uncurryThis(getPrototypeOfNative(new globalThis.Set()[NativeSymbol.iterator]()).next),
	stringNext: uncurryThis(getPrototypeOfNative(""[NativeSymbol.iterator]()).next),
	regExpStringNext: uncurryThis(getPrototypeOfNative(apply(globalThis.String.prototype.matchAll, "", [/(?:)/g])).next),
	generatorNext: uncurryThis(GeneratorPrototype.next),
	generatorReturn: uncurryThis(GeneratorPrototype.return),
	generatorThrow: uncurryThis(GeneratorPrototype.throw)
});

/**
 * The functions and accessor getters a built-in prototype holds under string keys (and the symbol-keyed ones named),
 * as they are, on a frozen object with no prototype. `constructor` is left out.
 * @param {object|undefined} proto - The prototype, or undefined where the host has none.
 * @param {Object<string, symbol>} [symbols] - Symbol-keyed functions to take too, by the name to take them under.
 * @returns {object} The functions, by name.
 * @private
 */
function functionsOf(proto, symbols) {
	const copy = create(null);
	if (!proto) return freeze(copy);
	const names = getOwnPropertyNames(proto);
	for (let i = 0; i < names.length; i++) {
		const name = names[i];
		if (name === "constructor") continue;
		const descriptor = getOwnPropertyDescriptor(proto, name);
		if (typeof descriptor.value === "function") copy[name] = descriptor.value;
		else if (typeof descriptor.get === "function") copy[name] = descriptor.get;
	}
	if (symbols) {
		const keys = getOwnPropertyNames(symbols);
		for (let i = 0; i < keys.length; i++) {
			const descriptor = getOwnPropertyDescriptor(proto, symbols[keys[i]]);
			if (descriptor && typeof descriptor.value === "function") copy[keys[i]] = descriptor.value;
			else if (descriptor && typeof descriptor.get === "function") copy[keys[i]] = descriptor.get;
		}
	}
	return freeze(copy);
}

/**
 * The functions of the built-in prototypes themselves, as they were when slothlet loaded, by prototype and name, for
 * the code that needs the function rather than a call of it: to compare a value against it, hand it to
 * `Reflect.apply`, or call it on a value whose kind it checks (`PrototypeFunctions.Map.has`). Under `Function` the
 * language's `Symbol.hasInstance` is `hasInstance`; under `TypedArray` (the prototype every typed array class inherits
 * from) the `Symbol.toStringTag` getter is `toStringTag`. An accessor is taken as its getter (`PrototypeFunctions.RegExp.source`,
 * `PrototypeFunctions.ArrayBuffer.byteLength`). To call one on a value, `ObjectMethods.hasOwnProperty(value, key)`
 * and the other `…Methods` read the same.
 * @type {Readonly<Record<string, Readonly<Record<string, Function>>>>}
 * @internal
 * @example
 * import { PrototypeFunctions } from "#helpers/intrinsics";
 * Reflect.apply(PrototypeFunctions.Promise.then, promise, [onFulfilled, onRejected]);
 */
export const PrototypeFunctions = freeze({
	__proto__: null,
	Object: functionsOf(NativeObject.prototype),
	Function: functionsOf(globalThis.Function.prototype, { hasInstance: NativeSymbol.hasInstance }),
	Promise: functionsOf(NativePromise.prototype),
	Map: functionsOf(globalThis.Map.prototype),
	Set: functionsOf(globalThis.Set.prototype),
	WeakMap: functionsOf(globalThis.WeakMap.prototype),
	WeakSet: functionsOf(globalThis.WeakSet.prototype),
	WeakRef: functionsOf(globalThis.WeakRef?.prototype),
	Date: functionsOf(globalThis.Date.prototype),
	Symbol: functionsOf(NativeSymbol.prototype),
	TextDecoder: functionsOf(globalThis.TextDecoder?.prototype),
	URLSearchParams: functionsOf(globalThis.URLSearchParams?.prototype),
	Iterator: functionsOf(globalThis.Iterator?.prototype),
	Error: functionsOf(globalThis.Error.prototype),
	RegExp: functionsOf(globalThis.RegExp.prototype),
	ArrayBuffer: functionsOf(globalThis.ArrayBuffer.prototype),
	SharedArrayBuffer: functionsOf(globalThis.SharedArrayBuffer?.prototype),
	DataView: functionsOf(globalThis.DataView.prototype),
	TypedArray: functionsOf(getPrototypeOfNative(globalThis.Uint8Array.prototype), { toStringTag: NativeSymbol.toStringTag }),
	Number: functionsOf(NativeNumber.prototype),
	String: functionsOf(NativeString.prototype),
	Boolean: functionsOf(globalThis.Boolean.prototype),
	BigInt: functionsOf(globalThis.BigInt?.prototype)
});

/**
 * `%TypedArray%.prototype`, the prototype every typed array class's `prototype` inherits from, as it was when slothlet
 * loaded (its functions and getters are `PrototypeFunctions.TypedArray`).
 * @type {object}
 * @internal
 * @example
 * import { TypedArrayPrototype } from "#helpers/intrinsics";
 * Reflect.getPrototypeOf(Uint8Array.prototype) === TypedArrayPrototype;
 */
export const TypedArrayPrototype = getPrototypeOfNative(globalThis.Uint8Array.prototype);

/**
 * The language's own setter of `Object.prototype.__proto__`, as it was when slothlet loaded (its getter is
 * `PrototypeFunctions.Object.__proto__`).
 * @type {function(this: object, (object|null)): void}
 * @internal
 * @example
 * import { ObjectProtoSetter, Reflect } from "#helpers/intrinsics";
 * Reflect.apply(ObjectProtoSetter, value, [null]);
 */
export const ObjectProtoSetter = getOwnPropertyDescriptor(NativeObject.prototype, "__proto__").set;

/**
 * The `Array` function, as it was when slothlet loaded, for comparing a value's `constructor` against. Its static
 * functions are on `Arrays`.
 * @type {ArrayConstructor}
 * @internal
 * @example
 * import { NativeArray } from "#helpers/intrinsics";
 * value.constructor === NativeArray;
 */
export const NativeArray = globalThis.Array;

/**
 * An iterator over one the language made, stepping it with the `next` taken at load. Its prototype is frozen and has
 * no prototype of its own, so `for…of` over it reads `Symbol.iterator`, `next` and `return` off this class only.
 * @private
 */
class SafeIterator {
	/** @type {object} */
	#iterator;
	/** @type {Function} */
	#next;
	/** @type {Function|null} */
	#return;
	/** @type {Function|null} */
	#throw;

	/**
	 * @param {object} iterator - The iterator the language made.
	 * @param {Function} next - Its `next`, taking the iterator first.
	 * @param {Function|null} [stop] - Its `return`, taking the iterator first, where stopping early must close it.
	 * @param {Function|null} [raise] - Its `throw`, taking the iterator first, for a generator `yield*` hands a throw to.
	 */
	constructor(iterator, next, stop = null, raise = null) {
		this.#iterator = iterator;
		this.#next = next;
		this.#return = stop;
		this.#throw = raise;
	}

	/**
	 * Throw into the generator, as `yield*` does when the generator delegating to it is thrown into. An iterator with no
	 * `throw` of its own is closed and the error is a `TypeError`, as the language does for one.
	 * @param {unknown} error - What is thrown.
	 * @returns {{value: unknown, done: boolean}} The step the generator takes.
	 */
	throw(error) {
		if (this.#throw) return this.#throw(this.#iterator, error);
		this.return();
		throw new globalThisTypeError("The iterator does not provide a 'throw' method");
	}

	/**
	 * The next step.
	 * @returns {{value: unknown, done: boolean}} The step.
	 */
	next() {
		return this.#next(this.#iterator);
	}

	/**
	 * Stop early, closing a generator.
	 * @param {unknown} [value] - The value to finish with.
	 * @returns {{value: unknown, done: boolean}} The last step.
	 */
	return(value) {
		if (this.#return) return this.#return(this.#iterator, value);
		return { value, done: true };
	}

	/**
	 * Itself, so `for…of` can walk it.
	 * @returns {SafeIterator} This iterator.
	 */
	[NativeSymbol.iterator]() {
		return this;
	}
}
NativeReflect.setPrototypeOf(SafeIterator.prototype, null);

/** An empty set's values, stepped where a walk is handed nothing. */
const EMPTY_SET = new globalThisSet();
const EMPTY_SET_ITERATOR_SOURCE = () => SetMethods.values(EMPTY_SET);
freeze(SafeIterator.prototype);
freeze(SafeIterator);

/**
 * The entries of a `Map`, for `for…of`, stepped with the iterator `next` taken at load.
 * @param {Map<unknown, unknown>|null|undefined} map - The map; none walks nothing.
 * @returns {Iterable<Array<unknown>>} Its `[key, value]` entries.
 * @internal
 * @example
 * for (const entry of mapEntries(map)) use(entry[0], entry[1]);
 */
export function mapEntries(map) {
	if (map === undefined || map === null) return new SafeIterator(EMPTY_SET_ITERATOR_SOURCE(), IteratorMethods.setNext);
	return new SafeIterator(MapMethods.entries(map), IteratorMethods.mapNext);
}

/**
 * The keys of a `Map`, for `for…of`, stepped with the iterator `next` taken at load.
 * @param {Map<unknown, unknown>|null|undefined} map - The map; none walks nothing.
 * @returns {Iterable<unknown>} Its keys.
 * @internal
 * @example
 * for (const key of mapKeys(map)) use(key);
 */
export function mapKeys(map) {
	if (map === undefined || map === null) return new SafeIterator(EMPTY_SET_ITERATOR_SOURCE(), IteratorMethods.setNext);
	return new SafeIterator(MapMethods.keys(map), IteratorMethods.mapNext);
}

/**
 * The values of a `Map`, for `for…of`, stepped with the iterator `next` taken at load.
 * @param {Map<unknown, unknown>|null|undefined} map - The map; none walks nothing.
 * @returns {Iterable<unknown>} Its values.
 * @internal
 * @example
 * for (const value of mapValues(map)) use(value);
 */
export function mapValues(map) {
	if (map === undefined || map === null) return new SafeIterator(EMPTY_SET_ITERATOR_SOURCE(), IteratorMethods.setNext);
	return new SafeIterator(MapMethods.values(map), IteratorMethods.mapNext);
}

/**
 * The values of a `Set`, for `for…of`, stepped with the iterator `next` taken at load.
 * @param {Set<unknown>|null|undefined} set - The set; none walks nothing.
 * @returns {Iterable<unknown>} Its values.
 * @internal
 * @example
 * for (const value of setValues(set)) use(value);
 */
export function setValues(set) {
	if (set === undefined || set === null) return new SafeIterator(EMPTY_SET_ITERATOR_SOURCE(), IteratorMethods.setNext);
	return new SafeIterator(SetMethods.values(set), IteratorMethods.setNext);
}

/**
 * The steps of a generator slothlet made, for `for…of`, stepped (and closed when the loop stops early) with the
 * generator functions taken at load.
 * @param {Generator<unknown>} generator - The generator.
 * @returns {Iterable<unknown>} Its values.
 * @internal
 * @example
 * for (const frame of generatorSteps(frames())) use(frame);
 */
export function generatorSteps(generator) {
	return new SafeIterator(generator, IteratorMethods.generatorNext, IteratorMethods.generatorReturn, IteratorMethods.generatorThrow);
}

/**
 * An async iterator over an async generator, stepped with the async generator functions taken at load, for
 * `for await…of` and `yield*` in an async generator.
 * @private
 */
class SafeAsyncIterator {
	/** @type {object} */
	#generator;

	/**
	 * @param {object} generator - The async generator.
	 */
	constructor(generator) {
		this.#generator = generator;
	}

	/**
	 * The next step.
	 * @param {unknown} [value] - What the step is sent.
	 * @returns {Promise<{value: unknown, done: boolean}>} The step.
	 */
	next(value) {
		return ASYNC_GENERATOR_NEXT(this.#generator, value);
	}

	/**
	 * Stop early, closing the generator.
	 * @param {unknown} [value] - The value to finish with.
	 * @returns {Promise<{value: unknown, done: boolean}>} The last step.
	 */
	return(value) {
		return ASYNC_GENERATOR_RETURN(this.#generator, value);
	}

	/**
	 * Throw into the generator.
	 * @param {unknown} error - What is thrown.
	 * @returns {Promise<{value: unknown, done: boolean}>} The step it takes.
	 */
	throw(error) {
		return ASYNC_GENERATOR_THROW(this.#generator, error);
	}

	/**
	 * Itself, so `for await…of` and `yield*` can walk it.
	 * @returns {SafeAsyncIterator} This iterator.
	 */
	[NativeSymbol.asyncIterator]() {
		return this;
	}
}
const ASYNC_GENERATOR_NEXT = uncurryThis(AsyncGeneratorPrototype.next);
const ASYNC_GENERATOR_RETURN = uncurryThis(AsyncGeneratorPrototype.return);
const ASYNC_GENERATOR_THROW = uncurryThis(AsyncGeneratorPrototype.throw);
NativeReflect.setPrototypeOf(SafeAsyncIterator.prototype, null);
freeze(SafeAsyncIterator.prototype);
freeze(SafeAsyncIterator);

/**
 * The steps of an async generator, for `for await…of` or `yield*` in an async generator, stepped (and closed or thrown
 * into) with the async generator functions taken at load.
 * @param {AsyncGenerator<unknown>} generator - The async generator.
 * @returns {AsyncIterable<unknown>} Its values.
 * @internal
 * @example
 * for await (const chunk of asyncGeneratorSteps(read())) use(chunk);
 */
export function asyncGeneratorSteps(generator) {
	return new SafeAsyncIterator(generator);
}

/**
 * The elements of an array, for `for…of`, stepped with the array iterator's `next` taken at load.
 * @param {ArrayLike<unknown>} list - The array.
 * @returns {Iterable<unknown>} Its elements.
 * @internal
 * @example
 * for (const frame of listSteps(frames)) use(frame);
 */
export function listSteps(list) {
	return new SafeIterator(ArrayMethods.values(list), IteratorMethods.arrayNext);
}

/**
 * The values of something module code supplied, walked with its own iterator as plain JavaScript would (a set-like a
 * caller hands a `Set` method), optionally mapped. Only for values whose own iteration is the behaviour asked for;
 * slothlet's own collections are walked with the helpers above.
 * @param {Iterable<unknown>} iterable - The value.
 * @param {function(unknown, number): unknown} [map] - Called with each value and its index.
 * @returns {Array<unknown>} The values.
 * @internal
 * @example
 * listFromIterable(setLike, (entry) => held(entry));
 */
export function listFromIterable(iterable, map) {
	return map === undefined ? ArrayFrom(iterable) : ArrayFrom(iterable, map);
}

/**
 * A new array holding the elements of `list` from `start` up to (not including) `end`, read by index.
 * @param {ArrayLike<unknown>} list - The array.
 * @param {number} [start] - The first index (negative counts from the end).
 * @param {number} [end] - The index to stop before (negative counts from the end).
 * @returns {Array<unknown>} The copy.
 * @internal
 * @example
 * copyList([1, 2, 3], 1); // [2, 3]
 */
export function copyList(list, start = 0, end = list.length) {
	const length = list.length;
	let from = start < 0 ? NativeMath.max(length + start, 0) : NativeMath.min(start, length);
	const to = end < 0 ? NativeMath.max(length + end, 0) : NativeMath.min(end, length);
	const out = [];
	for (let i = 0; from < to; from++, i++) put(out, i, list[from]);
	return out;
}

/**
 * A new array holding the elements of each list in turn, read by index.
 * @param {...ArrayLike<unknown>} lists - The arrays.
 * @returns {Array<unknown>} Their elements, in order.
 * @internal
 * @example
 * concatLists([1], [2, 3]); // [1, 2, 3]
 */
export function concatLists(...lists) {
	const out = [];
	let n = 0;
	for (let i = 0; i < lists.length; i++) {
		const list = lists[i];
		for (let j = 0; j < list.length; j++) put(out, n++, list[j]);
	}
	return out;
}

/** `Array.prototype` and `Object.prototype` as slothlet loaded with them. */
const ArrayPrototype = globalThis.Array.prototype;
const ObjectPrototype = NativeObject.prototype;
const defineOwn = NativeReflect.defineProperty;
const hasOwnNative = uncurryThis(ObjectPrototype.hasOwnProperty);

/**
 * Set element `index` of an array slothlet makes, as `list[index] = value` does, without running a setter module code
 * put at that index on `Array.prototype` or `Object.prototype` (or on a prototype put between them). When neither holds
 * the index the plain write is taken; otherwise the element is defined.
 * @param {Array<unknown>} list - The array.
 * @param {number} index - The index.
 * @param {unknown} value - The element.
 * @returns {void}
 * @private
 */
function put(list, index, value) {
	if (
		getPrototypeOfNative(list) === ArrayPrototype &&
		getPrototypeOfNative(ArrayPrototype) === ObjectPrototype &&
		!hasOwnNative(ArrayPrototype, index) &&
		!hasOwnNative(ObjectPrototype, index)
	) {
		list[index] = value;
		return;
	}
	defineOwn(list, index, { __proto__: null, value, writable: true, enumerable: true, configurable: true });
}

/**
 * Append values to an array, as `list.push(...values)` does, without running a setter module code put at an index of
 * the shared prototypes (see {@link put}).
 * @param {Array<unknown>} list - The array.
 * @param {...unknown} values - What to append.
 * @returns {number} The new length.
 * @internal
 * @example
 * listPush(names, "a");
 */
export function listPush(list, ...values) {
	for (let i = 0; i < values.length; i++) put(list, list.length, values[i]);
	return list.length;
}

/**
 * Insert values at the start of an array, as `list.unshift(...values)` does, without running a setter module code put
 * at an index of the shared prototypes.
 * @param {Array<unknown>} list - The array.
 * @param {...unknown} values - What to insert.
 * @returns {number} The new length.
 * @internal
 * @example
 * listUnshift(frames, first);
 */
export function listUnshift(list, ...values) {
	const count = values.length;
	for (let i = list.length - 1; i >= 0; i--) put(list, i + count, list[i]);
	for (let i = 0; i < count; i++) put(list, i, values[i]);
	return list.length;
}

/**
 * Remove and insert elements in place, as `list.splice(start, deleteCount, ...items)` does, without reading the array's
 * `constructor` or `Symbol.species` and without running a setter module code put at an index of the shared prototypes.
 * With only `start`, every element from there is removed.
 * @param {Array<unknown>} list - The array.
 * @param {number} start - Where to start (negative counts from the end).
 * @param {...unknown} rest - How many to remove, then the elements to insert.
 * @returns {Array<unknown>} The removed elements.
 * @internal
 * @example
 * listSplice(stack, index, 1); // [the element removed]
 */
export function listSplice(list, start, ...rest) {
	const length = list.length;
	const from = start < 0 ? NativeMath.max(length + start, 0) : NativeMath.min(NativeMath.trunc(start) || 0, length);
	const removeCount = rest.length === 0 ? length - from : NativeMath.min(NativeMath.max(NativeMath.trunc(rest[0]) || 0, 0), length - from);
	const removed = [];
	for (let i = 0; i < removeCount; i++) put(removed, i, list[from + i]);
	const insertCount = rest.length > 1 ? rest.length - 1 : 0;
	if (insertCount < removeCount) {
		for (let k = from; k < length - removeCount; k++) put(list, k + insertCount, list[k + removeCount]);
		list.length = length - removeCount + insertCount;
	} else if (insertCount > removeCount) {
		for (let k = length - removeCount; k > from; k--) put(list, k + insertCount - 1, list[k + removeCount - 1]);
	}
	for (let i = 0; i < insertCount; i++) put(list, from + i, rest[i + 1]);
	return removed;
}

/**
 * Append the elements of `list` to `target`, read by index, as `target.push(...list)` does, and answer the new length.
 * @param {Array<unknown>} target - The array to add to.
 * @param {ArrayLike<unknown>} list - The elements to add.
 * @returns {number} The new length of `target`.
 * @internal
 * @example
 * appendList(names, more);
 */
export function appendList(target, list) {
	const length = list.length;
	for (let i = 0; i < length; i++) put(target, target.length, list[i]);
	return target.length;
}

/**
 * A new array of what `fn` returns for each element of `list`, as `list.map(fn)` makes, without reading the array's
 * `constructor`.
 * @param {ArrayLike<unknown>} list - The array.
 * @param {function(unknown, number, ArrayLike<unknown>): unknown} fn - Called with each element, its index and the array.
 * @returns {Array<unknown>} The results.
 * @internal
 * @example
 * mapList([1, 2], (n) => n * 2); // [2, 4]
 */
export function mapList(list, fn) {
	const length = list.length;
	const out = [];
	for (let i = 0; i < length; i++) put(out, i, fn(list[i], i, list));
	return out;
}

/**
 * A new array of the elements of `list` for which `fn` returns a truthy value, as `list.filter(fn)` makes, without
 * reading the array's `constructor`.
 * @param {ArrayLike<unknown>} list - The array.
 * @param {function(unknown, number, ArrayLike<unknown>): unknown} fn - Called with each element, its index and the array.
 * @returns {Array<unknown>} The elements kept.
 * @internal
 * @example
 * filterList([1, 2, 3], (n) => n > 1); // [2, 3]
 */
export function filterList(list, fn) {
	const length = list.length;
	const out = [];
	for (let i = 0, n = 0; i < length; i++) {
		const value = list[i];
		if (fn(value, i, list)) put(out, n++, value);
	}
	return out;
}

/**
 * The values of a `Set` in a new array, read with the `forEach` taken at load.
 * @param {Set<unknown>|null|undefined} set - The set; none gives an empty array.
 * @returns {Array<unknown>} Its values, in order.
 * @internal
 * @example
 * setToArray(new Set([1, 2])); // [1, 2]
 */
export function setToArray(set) {
	const out = [];
	if (set === undefined || set === null) return out;
	SetMethods.forEach(set, (value) => {
		put(out, out.length, value);
	});
	return out;
}

/**
 * The keys of a `Map` in a new array, read with the `forEach` taken at load.
 * @param {Map<unknown, unknown>|null|undefined} map - The map; none gives an empty array.
 * @returns {Array<unknown>} Its keys, in order.
 * @internal
 * @example
 * mapKeysToArray(new Map([["a", 1]])); // ["a"]
 */
export function mapKeysToArray(map) {
	const out = [];
	if (map === undefined || map === null) return out;
	MapMethods.forEach(map, (value, key) => {
		put(out, out.length, key);
	});
	return out;
}

/**
 * The values of a `Map` in a new array, read with the `forEach` taken at load.
 * @param {Map<unknown, unknown>|null|undefined} map - The map; none gives an empty array.
 * @returns {Array<unknown>} Its values, in order.
 * @internal
 * @example
 * mapValuesToArray(new Map([["a", 1]])); // [1]
 */
export function mapValuesToArray(map) {
	const out = [];
	if (map === undefined || map === null) return out;
	MapMethods.forEach(map, (value) => {
		put(out, out.length, value);
	});
	return out;
}

/**
 * The `[key, value]` entries of a `Map` in a new array, read with the `forEach` taken at load.
 * @param {Map<unknown, unknown>|null|undefined} map - The map; none gives an empty array.
 * @returns {Array<Array<unknown>>} Its entries, in order.
 * @internal
 * @example
 * mapEntriesToArray(new Map([["a", 1]])); // [["a", 1]]
 */
export function mapEntriesToArray(map) {
	const out = [];
	if (map === undefined || map === null) return out;
	MapMethods.forEach(map, (value, key) => {
		put(out, out.length, [key, value]);
	});
	return out;
}

/**
 * `text` split at each occurrence of `separator`, as `text.split(separator)` gives for a string separator, found with
 * the `indexOf` taken at load. (`text.split(separator)` looks `Symbol.split` up on the separator, which for a string is
 * `String.prototype`, where a module can put one.) An empty separator splits into code units.
 * @param {string} text - The text.
 * @param {string} separator - What to split at.
 * @param {number} [limit] - The most pieces to give.
 * @returns {string[]} The pieces.
 * @internal
 * @example
 * splitText("a.b.c", "."); // ["a", "b", "c"]
 */
export function splitText(text, separator, limit = 4294967295) {
	const out = [];
	if (limit === 0) return out;
	if (separator === "") {
		for (let i = 0; i < text.length && out.length < limit; i++) put(out, i, text[i]);
		return out;
	}
	let from = 0;
	let at;
	while ((at = StringMethods.indexOf(text, separator, from)) !== -1) {
		put(out, out.length, StringMethods.slice(text, from, at));
		if (out.length >= limit) return out;
		from = at + separator.length;
	}
	put(out, out.length, StringMethods.slice(text, from));
	return out;
}

/**
 * What a replacement string stands for at one match, as `String.prototype.replace` reads it: `$$`, `$&`, `` $` ``,
 * `$'`, `$1`…`$99` and `$<name>`.
 * @param {string} replacement - The replacement string.
 * @param {Array<string|undefined>} match - The match and its captures.
 * @param {string} text - The text searched.
 * @param {number} position - Where the match starts.
 * @param {object|undefined} groups - The named captures.
 * @returns {string} The text to put in.
 * @private
 */
function substitution(replacement, match, text, position, groups) {
	let out = "";
	const captures = match.length - 1;
	for (let i = 0; i < replacement.length; i++) {
		const char = replacement[i];
		if (char !== "$" || i + 1 >= replacement.length) {
			out += char;
			continue;
		}
		const next = replacement[i + 1];
		if (next === "$") {
			out += "$";
			i++;
		} else if (next === "&") {
			out += match[0];
			i++;
		} else if (next === "`") {
			out += StringMethods.slice(text, 0, position);
			i++;
		} else if (next === "'") {
			out += StringMethods.slice(text, position + match[0].length);
			i++;
		} else if (next >= "0" && next <= "9") {
			const two =
				i + 2 < replacement.length && replacement[i + 2] >= "0" && replacement[i + 2] <= "9" ? NativeNumber(next + replacement[i + 2]) : -1;
			const one = NativeNumber(next);
			if (two >= 1 && two <= captures) {
				out += match[two] ?? "";
				i += 2;
			} else if (one >= 1 && one <= captures) {
				out += match[one] ?? "";
				i++;
			} else out += "$";
		} else if (next === "<" && groups !== undefined) {
			const close = StringMethods.indexOf(replacement, ">", i + 2);
			if (close === -1) out += "$";
			else {
				const value = groups[StringMethods.slice(replacement, i + 2, close)];
				out += value === undefined ? "" : NativeString(value);
				i = close;
			}
		} else out += "$";
	}
	return out;
}

/**
 * The matches a replace or a split walks: every match from the start for a global expression, otherwise the first from
 * `lastIndex` for a sticky one and from the start for any other, each found with the `exec` taken at load. A global or
 * sticky expression's `lastIndex` ends as `String.prototype.replace` leaves it.
 * @param {RegExp} regexp - The expression.
 * @param {string} text - The text.
 * @returns {Array<RegExpExecArray>} The matches.
 * @private
 */
function matchesOf(regexp, text) {
	const out = [];
	if (!RegExpMethods.global(regexp)) {
		if (!RegExpMethods.sticky(regexp)) regexp.lastIndex = 0;
		const match = RegExpMethods.exec(regexp, text);
		if (match !== null) put(out, 0, match);
		return out;
	}
	const unicode = RegExpMethods.unicode(regexp) || (RegExpMethods.unicodeSets ? RegExpMethods.unicodeSets(regexp) : false);
	regexp.lastIndex = 0;
	let match;
	while ((match = RegExpMethods.exec(regexp, text)) !== null) {
		put(out, out.length, match);
		if (match[0] === "") {
			const at = regexp.lastIndex;
			const code = unicode ? StringMethods.codePointAt(text, at) : undefined;
			regexp.lastIndex = at + (code !== undefined && code > 0xffff ? 2 : 1);
		}
	}
	return out;
}

/**
 * `text` with the matches of a regular expression replaced, as `text.replace(regexp, replacement)` (or `replaceAll`)
 * gives, found with the `exec` taken at load. (`text.replace(regexp, …)` reads `Symbol.replace`, `flags` and `exec` off
 * the expression's prototype, where module code can replace them.)
 * @param {RegExp} regexp - The expression; a global one replaces every match.
 * @param {string} text - The text.
 * @param {string|Function} replacement - The replacement string (with `$` patterns), or a function called as
 *   `String.prototype.replace` calls one.
 * @returns {string} The new text.
 * @internal
 * @example
 * regExpReplace(/\./g, "a.b", "/"); // "a/b"
 */
export function regExpReplace(regexp, text, replacement) {
	text = NativeString(text);
	const matches = matchesOf(regexp, text);
	if (matches.length === 0) return text;
	let out = "";
	let from = 0;
	for (let m = 0; m < matches.length; m++) {
		const match = matches[m];
		const position = match.index;
		let piece;
		if (typeof replacement === "function") {
			// Built through `put`, never `args[i] =`: a plain index write runs a setter module code put on the shared prototypes.
			const args = [];
			for (let i = 0; i < match.length; i++) put(args, i, match[i]);
			put(args, args.length, position);
			put(args, args.length, text);
			if (match.groups !== undefined) put(args, args.length, match.groups);
			piece = NativeString(apply(replacement, undefined, args));
		} else piece = substitution(NativeString(replacement), match, text, position, match.groups);
		out += StringMethods.slice(text, from, position) + piece;
		from = position + match[0].length;
	}
	return out + StringMethods.slice(text, from);
}

/**
 * `text` split at the matches of a regular expression, captures included, as `text.split(regexp, limit)` gives, found
 * with the `exec` taken at load on a sticky copy of the expression.
 * @param {RegExp} regexp - The expression.
 * @param {string} text - The text.
 * @param {number} [limit] - The most pieces to give.
 * @returns {string[]} The pieces.
 * @internal
 * @example
 * regExpSplit(/[,;]/, "a,b;c"); // ["a", "b", "c"]
 */
export function regExpSplit(regexp, text, limit = 4294967295) {
	text = NativeString(text);
	const out = [];
	if (limit === 0) return out;
	// The language's own algorithm: a sticky copy tried at each position in turn.
	const unicode = RegExpMethods.unicode(regexp) || (RegExpMethods.unicodeSets ? RegExpMethods.unicodeSets(regexp) : false);
	const splitter = new globalThisRegExp(RegExpMethods.source(regexp), flagsOf(regexp, "y", "g"));
	const size = text.length;
	if (size === 0) {
		splitter.lastIndex = 0;
		if (RegExpMethods.exec(splitter, text) === null) put(out, 0, text);
		return out;
	}
	const advance = (index) => {
		if (!unicode || index + 1 >= size) return index + 1;
		const code = StringMethods.codePointAt(text, index);
		return index + (code !== undefined && code > 0xffff ? 2 : 1);
	};
	let p = 0;
	let q = 0;
	while (q < size) {
		splitter.lastIndex = q;
		const match = RegExpMethods.exec(splitter, text);
		if (match === null) {
			q = advance(q);
			continue;
		}
		const e = NativeMath.min(splitter.lastIndex, size);
		if (e === p) {
			q = advance(q);
			continue;
		}
		put(out, out.length, StringMethods.slice(text, p, q));
		if (out.length >= limit) return out;
		p = e;
		for (let i = 1; i < match.length; i++) {
			put(out, out.length, match[i]);
			if (out.length >= limit) return out;
		}
		q = p;
	}
	put(out, out.length, StringMethods.slice(text, p, size));
	return out;
}

/**
 * What `text.match(regexp)` gives, found with the `exec` taken at load: the first match (with its captures) for an
 * expression that is not global, every matched text for a global one, or null for none.
 * @param {RegExp} regexp - The expression.
 * @param {string} text - The text.
 * @returns {RegExpExecArray|string[]|null} The match or matches.
 * @internal
 * @example
 * regExpMatch(/\d+/g, "a1b22"); // ["1", "22"]
 */
export function regExpMatch(regexp, text) {
	text = NativeString(text);
	if (!RegExpMethods.global(regexp)) {
		if (!RegExpMethods.sticky(regexp)) regexp.lastIndex = 0;
		return RegExpMethods.exec(regexp, text);
	}
	const matches = matchesOf(regexp, text);
	if (matches.length === 0) return null;
	return mapList(matches, (match) => match[0]);
}

/**
 * Where the first match of a regular expression in `text` starts, as `text.search(regexp)` gives (-1 for none), found
 * with the `exec` taken at load; the expression's `lastIndex` is left as it was.
 * @param {RegExp} regexp - The expression.
 * @param {string} text - The text.
 * @returns {number} The index.
 * @internal
 * @example
 * regExpSearch(/b/, "abc"); // 1
 */
export function regExpSearch(regexp, text) {
	const kept = regexp.lastIndex;
	regexp.lastIndex = 0;
	const match = RegExpMethods.exec(regexp, NativeString(text));
	regexp.lastIndex = kept;
	return match === null ? -1 : match.index;
}

/**
 * `text` with the first occurrence of `search` replaced, as `text.replace(search, replacement)` gives for a string
 * `search`, found with the `indexOf` taken at load. (`text.replace(search, …)` looks `Symbol.replace` up on `search`,
 * which for a string is `String.prototype`, where module code can put one.)
 * @param {string} text - The text.
 * @param {string} search - What to replace.
 * @param {string|Function} replacement - The replacement string (with `$` patterns), or a function.
 * @returns {string} The new text.
 * @internal
 * @example
 * textReplace("a.b.c", ".", "/"); // "a/b.c"
 */
export function textReplace(text, search, replacement) {
	text = NativeString(text);
	search = NativeString(search);
	const position = StringMethods.indexOf(text, search);
	if (position === -1) return text;
	const match = [search];
	const piece =
		typeof replacement === "function"
			? NativeString(replacement(search, position, text))
			: substitution(NativeString(replacement), match, text, position, undefined);
	return StringMethods.slice(text, 0, position) + piece + StringMethods.slice(text, position + search.length);
}

/**
 * The flags of a regular expression, read one by one with the accessors taken at load, with `add` added and `drop`
 * left out.
 * @param {RegExp} regexp - The expression.
 * @param {string} [add] - Flags to add.
 * @param {string} [drop] - Flags to leave out.
 * @returns {string} The flags.
 * @private
 */
function flagsOf(regexp, add = "", drop = "") {
	let flags = "";
	const take = (flag, on) => {
		if ((on || StringMethods.includes(add, flag)) && !StringMethods.includes(drop, flag)) flags += flag;
	};
	take("d", RegExpMethods.hasIndices(regexp));
	take("g", RegExpMethods.global(regexp));
	take("i", RegExpMethods.ignoreCase(regexp));
	take("m", RegExpMethods.multiline(regexp));
	take("s", RegExpMethods.dotAll(regexp));
	take("u", RegExpMethods.unicode(regexp));
	take("v", RegExpMethods.unicodeSets ? RegExpMethods.unicodeSets(regexp) : false);
	take("y", RegExpMethods.sticky(regexp));
	return flags;
}

/**
 * Every match of a global regular expression in `text`, as `text.matchAll(regexp)` yields them, found with the `exec`
 * taken at load on a copy of the expression (the expression's own `lastIndex` is left alone). The copy's flags are read
 * one by one with the accessors taken at load.
 * @param {string} text - The text to search.
 * @param {RegExp} regexp - The expression.
 * @returns {Array<RegExpExecArray>} The matches, in order.
 * @internal
 * @example
 * matchAllOf("a1b2", /\d/g).length; // 2
 */
export function matchAllOf(text, regexp) {
	const copy = new globalThisRegExp(RegExpMethods.source(regexp), flagsOf(regexp, "g"));
	const out = [];
	let match;
	while ((match = RegExpMethods.exec(copy, text)) !== null) {
		put(out, out.length, match);
		if (match[0] === "") copy.lastIndex++;
	}
	return out;
}

/**
 * The promise slothlet makes for its own waits: a `Promise` whose `constructor`, `then`, `catch` and `finally` are its
 * own frozen members (the language's own functions, taken at load) and whose `Symbol.species` is itself. Awaiting one, or
 * calling the captured `then` on one, reads only those, never a member module code can put on `Promise.prototype` or
 * `Promise`. It is still a `Promise` (`instanceof Promise`, `util.types.isPromise`).
 * @internal
 * @example
 * import { SafePromise } from "#helpers/intrinsics";
 * const settled = new SafePromise((resolve) => resolve());
 */
export class SafePromise extends NativePromise {}
{
	const proto = NativePromise.prototype;
	const own = (key) => ({
		__proto__: null,
		value: getOwnPropertyDescriptor(proto, key).value,
		writable: false,
		enumerable: false,
		configurable: false
	});
	defineOwnAtLoad(SafePromise.prototype, "then", own("then"));
	defineOwnAtLoad(SafePromise.prototype, "catch", own("catch"));
	defineOwnAtLoad(SafePromise.prototype, "finally", own("finally"));
	defineOwnAtLoad(SafePromise, NativeSymbol.species, {
		__proto__: null,
		value: SafePromise,
		writable: false,
		enumerable: false,
		configurable: false
	});
	freeze(SafePromise.prototype);
	freeze(SafePromise);
}

/**
 * Whether a value is a {@link SafePromise}, told by its prototype, read with the function taken at load.
 * @param {unknown} value - The value.
 * @returns {boolean} True for one.
 * @private
 */
function isSafePromise(value) {
	return value !== null && typeof value === "object" && getPrototypeOfNative(value) === SafePromise.prototype;
}

/**
 * A {@link SafePromise} settled with `value`: the value itself when it is one, otherwise fulfilled with it.
 * @param {unknown} value - The value.
 * @returns {SafePromise} The promise.
 * @internal
 * @example
 * await settledWith(undefined);
 */
export function settledWith(value) {
	if (isSafePromise(value)) return value;
	return new SafePromise((resolve) => resolve(value));
}

/**
 * React to one item of a {@link promiseAll} list on a later job: a {@link SafePromise} through its own `then`, any other
 * promise or thenable through the captured `then` on a {@link SafePromise} resolved with it (which reads what the item
 * itself offers, as `Promise.all` does), and a plain value as fulfilled.
 * @param {unknown} item - The item.
 * @param {function(unknown): void} onFulfilled - Called with its value.
 * @param {function(unknown): void} onRejected - Called with its reason.
 * @returns {void}
 * @private
 */
function settleItem(item, onFulfilled, onRejected) {
	PromiseMethods.then(settledWith(item), onFulfilled, onRejected);
}

/**
 * A promise for the values of the promises (or values) in `list`, as `Promise.all(list)` gives, without walking `list`
 * with its iterator or reading `then` off a promise: each is settled with the `then` taken at load.
 * @param {ArrayLike<unknown>} list - The promises or values.
 * @returns {Promise<Array<unknown>>} Their values, in order; rejected with the first rejection.
 * @internal
 * @example
 * await promiseAll([load(a), load(b)]);
 */
export function promiseAll(list) {
	const length = list.length;
	return new SafePromise((resolve, reject) => {
		const out = [];
		let left = length;
		if (left === 0) {
			resolve(out);
			return;
		}
		for (let i = 0; i < length; i++) {
			PromiseMethods.then(
				settledWith(list[i]),
				(value) => {
					put(out, i, value);
					if (--left === 0) resolve(out);
				},
				reject
			);
		}
	});
}

/**
 * A promise for how each of the promises (or values) in `list` settled, as `Promise.allSettled(list)` gives, without
 * walking `list` with its iterator or reading `then` off a promise.
 * @param {ArrayLike<unknown>} list - The promises or values.
 * @returns {Promise<Array<{status: string, value?: unknown, reason?: unknown}>>} How each settled, in order.
 * @internal
 * @example
 * await promiseAllSettled([load(a), load(b)]);
 */
export function promiseAllSettled(list) {
	const length = list.length;
	return new SafePromise((resolve) => {
		const out = [];
		let left = length;
		if (left === 0) {
			resolve(out);
			return;
		}
		for (let i = 0; i < length; i++) {
			const settle = (result) => {
				put(out, i, result);
				if (--left === 0) resolve(out);
			};
			settleItem(
				list[i],
				(value) => settle({ status: "fulfilled", value }),
				(reason) => settle({ status: "rejected", reason })
			);
		}
	});
}

/**
 * A new object with a data member for each `[key, value]` entry of `list`, as `Object.fromEntries(list)` makes,
 * without walking `list` with its iterator.
 * @param {ArrayLike<ArrayLike<unknown>>} list - The entries.
 * @returns {object} The object.
 * @internal
 * @example
 * objectFromEntries([["a", 1]]); // { a: 1 }
 */
export function objectFromEntries(list) {
	const out = {};
	for (let i = 0; i < list.length; i++) {
		const entry = list[i];
		defineOwn(out, entry[0], { __proto__: null, value: entry[1], writable: true, enumerable: true, configurable: true });
	}
	return out;
}

/**
 * The text `String(value)` gives for plain data, made without looking anything up on the value: strings, numbers,
 * booleans, bigints, symbols, `null` and `undefined` as `String()` gives them; an array as its elements joined with
 * `,` (`null` and `undefined` as empty); a function as its source text (by the `toString` taken at load); an error as
 * `name: message` from its own data members; a date by the date `toString` taken at load; any other object as
 * `[object Object]`. A `toString`, `valueOf`, `Symbol.toPrimitive` or `Symbol.toStringTag` an object carries, or one
 * module code put on a shared prototype, is not read.
 * @param {unknown} value - The value.
 * @param {number} [depth] - How many arrays deep to render (deeper ones render as empty).
 * @returns {string} The text.
 * @internal
 * @example
 * stringOf(["a", 1]); // "a,1"
 */
export function stringOf(value, depth = 4) {
	if (typeof value === "string") return value;
	if (typeof value === "symbol") return SymbolMethods.toString(value);
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return NativeString(value);
	if (typeof value === "function") {
		try {
			return functionSource(value);
		} catch {
			return "function () { [native code] }";
		}
	}
	if (Arrays.isArray(value)) {
		if (depth <= 0) return "";
		let out = "";
		for (let i = 0; i < value.length; i++) {
			if (i > 0) out += ",";
			const element = value[i];
			if (element !== null && element !== undefined) out += stringOf(element, depth - 1);
		}
		return out;
	}
	const error = errorParts(value);
	if (error !== null) return error.message ? `${error.name}: ${error.message}` : error.name;
	try {
		return DateMethods.toString(value);
	} catch {
		return "[object Object]";
	}
}

/**
 * The text `JSON.stringify(value)` gives for plain data, made without running code the value or module code carries: a
 * copy of the value's own enumerable data members (getters, `toJSON` and functions left out, as are members of a
 * prototype) is serialized with the `JSON.stringify` taken at load. A bigint renders as its digits; anything deeper than
 * `depth` as `null`.
 * @param {unknown} value - The value.
 * @param {number} [depth] - How many objects deep to copy.
 * @returns {string|undefined} The JSON text, or undefined where `JSON.stringify` gives none (a function, a symbol,
 *   `undefined`).
 * @internal
 * @example
 * jsonOf({ a: 1, get b() { return 2; } }); // '{"a":1}'
 */
export function jsonOf(value, depth = 8) {
	return NativeJSON.stringify(plainCopy(value, depth));
}

/**
 * A thrown value as text, made without running code it carries (a getter, a `toJSON`, a `toString`): an error's own
 * `message`, else the error as `name: message` from its own data ({@link stringOf}); a string as itself; any other
 * value's own data as JSON ({@link jsonOf}), falling back to its {@link stringOf} text. What a SlothletError puts in
 * its message for the value it replaced, and what the hint detector matches.
 * @param {unknown} thrown - Whatever was thrown.
 * @returns {string} The text.
 * @internal
 * @example
 * describeThrown(new TypeError("bad")); // "bad"
 * describeThrown({ code: 404 }); // '{"code":404}'
 */
export function describeThrown(thrown) {
	if (thrown instanceof Error) {
		const message = getOwnPropertyDescriptor(thrown, "message");
		return message && hasOwnNative(message, "value") && typeof message.value === "string" ? message.value : stringOf(thrown);
	}
	if (typeof thrown === "string") return thrown;
	return jsonOf(thrown) ?? stringOf(thrown);
}

/**
 * A copy of plain data for {@link jsonOf}: primitives as they are (a bigint as its digits), arrays and objects as fresh
 * arrays and prototype-less objects of their own enumerable data members, read with the functions taken at load.
 * @param {unknown} value - The value.
 * @param {number} depth - How many objects deep to copy.
 * @returns {unknown} The copy.
 * @private
 */
function plainCopy(value, depth) {
	if (typeof value === "bigint") return NativeString(value);
	if (value === null || typeof value !== "object") return value;
	if (depth <= 0) return null;
	if (Arrays.isArray(value)) {
		const out = [];
		for (let i = 0; i < value.length; i++) put(out, i, plainCopy(ownData(value, NativeString(i)), depth - 1));
		return out;
	}
	const out = create(null);
	const keys = ownKeysNative(value);
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];
		if (typeof key !== "string") continue;
		const descriptor = getOwnPropertyDescriptor(value, key);
		if (!descriptor || !descriptor.enumerable || !hasOwnNative(descriptor, "value")) continue;
		const member = descriptor.value;
		if (typeof member === "function" || typeof member === "symbol") continue;
		defineOwn(out, key, { __proto__: null, value: plainCopy(member, depth - 1), writable: true, enumerable: true, configurable: true });
	}
	return out;
}

/**
 * An own data member of an object, or undefined when it has none or holds a getter there.
 * @param {object} value - The object.
 * @param {string} key - The member.
 * @returns {unknown} Its value.
 * @private
 */
function ownData(value, key) {
	const descriptor = getOwnPropertyDescriptor(value, key);
	return descriptor && hasOwnNative(descriptor, "value") ? descriptor.value : undefined;
}

/**
 * The name and message of an error, from its own data members (and the realm's `Error` brand where the engine offers
 * `Error.isError`, else `instanceof` the `Error` taken at load), or null for a value that is not one.
 * @param {object} value - The value.
 * @returns {{name: string, message: string}|null} Its parts.
 * @private
 */
function errorParts(value) {
	const isError = typeof Errors.isError === "function" ? Errors.isError(value) : value instanceof Error;
	if (!isError) return null;
	const name = ownData(value, "name");
	const message = ownData(value, "message");
	let constructorName = "Error";
	for (let proto = getPrototypeOfNative(value); proto !== null; proto = getPrototypeOfNative(proto)) {
		const named = ownData(proto, "name");
		if (typeof named === "string") {
			constructorName = named;
			break;
		}
	}
	return { name: typeof name === "string" ? name : constructorName, message: typeof message === "string" ? message : "" };
}

/**
 * A new `Set` of the elements of `list`, added with the `add` taken at load.
 * @param {ArrayLike<unknown>} list - The elements.
 * @returns {Set<unknown>} The set.
 * @internal
 * @example
 * setFrom(["a", "b"]).size; // 2
 */
export function setFrom(list) {
	const set = new globalThisSet();
	for (let i = 0; i < list.length; i++) SetMethods.add(set, list[i]);
	return set;
}

/**
 * A new `Map` of the `[key, value]` entries in `entries`, set with the `set` taken at load.
 * @param {ArrayLike<ArrayLike<unknown>>} entries - The entries.
 * @returns {Map<unknown, unknown>} The map.
 * @internal
 * @example
 * mapFrom([["a", 1]]).get("a"); // 1
 */
export function mapFrom(entries) {
	const map = new globalThisMap();
	for (let i = 0; i < entries.length; i++) MapMethods.set(map, entries[i][0], entries[i][1]);
	return map;
}

export { NativeJSON as JSON, NativeMath as Math };
