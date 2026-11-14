/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/intrinsics.mjs
 *	@Date: 2026-11-11T10:41:20-08:00 (1794422480)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T21:48:06-08:00 (1794635286)
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
 * Methods a value inherits (`array.map`, `map.get`) are not covered here: they are looked up on the value when called.
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
 * import { NativeObject } from "@cldmv/slothlet/helpers/intrinsics";
 * NativeObject(value) === value; // whether value is an object
 */
export const NativeObject = globalThis.Object;

const NativeReflect = globalThis.Reflect;
const NativePromise = globalThis.Promise;
const NativeSymbol = globalThis.Symbol;
const { getOwnPropertyNames, getOwnPropertyDescriptor, freeze, create } = NativeObject;
const { apply } = NativeReflect;

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
 * The functions of `Reflect`, as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { Reflect } from "@cldmv/slothlet/helpers/intrinsics";
 * Reflect.getOwnPropertyDescriptor(value, "constructor");
 */
export const Reflect = staticsOf(NativeReflect);

/**
 * The static functions of `Object`, as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { Objects } from "@cldmv/slothlet/helpers/intrinsics";
 * Objects.keys(value);
 */
export const Objects = staticsOf(NativeObject);

/**
 * The static functions of `Array`, as they were when slothlet loaded. `Arrays.from` and `Arrays.of` make plain arrays.
 * @type {object}
 * @internal
 * @example
 * import { Arrays } from "@cldmv/slothlet/helpers/intrinsics";
 * Arrays.isArray(value);
 */
export const Arrays = staticsOf(globalThis.Array);

/**
 * The data members of `Function` (its `prototype`), as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { Functions } from "@cldmv/slothlet/helpers/intrinsics";
 * Reflect.getPrototypeOf(value) === Functions.prototype;
 */
export const Functions = staticsOf(globalThis.Function);

const NativeJSON = staticsOf(globalThis.JSON);
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
 * import { NativeProxy } from "@cldmv/slothlet/helpers/intrinsics";
 * const view = new NativeProxy(shadow, handler);
 */
export const NativeProxy = globalThis.Proxy;

/**
 * The `Map` constructor, as it was when slothlet loaded.
 * @type {MapConstructor}
 * @internal
 * @example
 * import { Map } from "@cldmv/slothlet/helpers/intrinsics";
 * const seen = new Map();
 */
export const Map = globalThis.Map;

/**
 * The `Set` constructor, as it was when slothlet loaded.
 * @type {SetConstructor}
 * @internal
 * @example
 * import { Set } from "@cldmv/slothlet/helpers/intrinsics";
 * const seen = new Set();
 */
export const Set = globalThis.Set;

/**
 * The `WeakMap` constructor, as it was when slothlet loaded.
 * @type {WeakMapConstructor}
 * @internal
 * @example
 * import { WeakMap } from "@cldmv/slothlet/helpers/intrinsics";
 * const views = new WeakMap();
 */
export const WeakMap = globalThis.WeakMap;

/**
 * The `WeakSet` constructor, as it was when slothlet loaded.
 * @type {WeakSetConstructor}
 * @internal
 * @example
 * import { WeakSet } from "@cldmv/slothlet/helpers/intrinsics";
 * const marked = new WeakSet();
 */
export const WeakSet = globalThis.WeakSet;

/**
 * The `WeakRef` constructor, as it was when slothlet loaded.
 * @type {WeakRefConstructor}
 * @internal
 * @example
 * import { WeakRef } from "@cldmv/slothlet/helpers/intrinsics";
 * const ref = new WeakRef(target);
 */
export const WeakRef = globalThis.WeakRef;

/**
 * The `Promise` constructor, as it was when slothlet loaded. Its static functions are on `Promises`.
 * @type {PromiseConstructor}
 * @internal
 * @example
 * import { Promise } from "@cldmv/slothlet/helpers/intrinsics";
 * const done = new Promise((resolve) => setImmediate(resolve));
 */
export const Promise = NativePromise;

/**
 * The `Symbol` function, as it was when slothlet loaded. The well-known symbols (`Symbol.iterator`, …) are read from
 * it; `Symbol.for` and `Symbol.keyFor` are on `Symbols`.
 * @type {SymbolConstructor}
 * @internal
 * @example
 * import { Symbol } from "@cldmv/slothlet/helpers/intrinsics";
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
 * import { Promises } from "@cldmv/slothlet/helpers/intrinsics";
 * await Promises.all(pending);
 */
export const Promises = boundStaticsOf(NativePromise, ["resolve", "reject", "all", "allSettled", "race", "any"]);

/**
 * `Symbol.for` and `Symbol.keyFor`, as they were when slothlet loaded.
 * @type {SymbolConstructor}
 * @internal
 * @example
 * import { Symbols } from "@cldmv/slothlet/helpers/intrinsics";
 * Symbols.for("nodejs.util.inspect.custom");
 */
export const Symbols = boundStaticsOf(NativeSymbol, ["for", "keyFor"]);

/**
 * The `URL` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * import { URL } from "@cldmv/slothlet/helpers/intrinsics";
 * const href = new URL("./a.mjs", import.meta.url).href;
 */
export const URL = globalThis.URL;

/**
 * The `URLSearchParams` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * import { URLSearchParams } from "@cldmv/slothlet/helpers/intrinsics";
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
 * @type {object}
 * @internal
 * @example
 * import { Strings } from "@cldmv/slothlet/helpers/intrinsics";
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
 * @type {object}
 * @internal
 * @example
 * import { Numbers } from "@cldmv/slothlet/helpers/intrinsics";
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
 * @type {object}
 * @internal
 * @example
 * import { Dates } from "@cldmv/slothlet/helpers/intrinsics";
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
 * import { Error } from "@cldmv/slothlet/helpers/intrinsics";
 * throw new Error("message");
 */
export const Error = globalThis.Error;

/**
 * `Error.captureStackTrace` and `Error.isError` (where the engine has them), as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { Errors } from "@cldmv/slothlet/helpers/intrinsics";
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
 * import { ArrayBuffers } from "@cldmv/slothlet/helpers/intrinsics";
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
 * import { Iterators } from "@cldmv/slothlet/helpers/intrinsics";
 * Iterators.from(iterable);
 */
export const Iterators = globalThis.Iterator ? staticsOf(globalThis.Iterator) : freeze(create(null));

/**
 * The members of `Intl` (its constructors, `Intl.Segmenter` among them), as they were when slothlet loaded, shadowing
 * the global like `JSON`.
 * @type {object}
 * @internal
 * @example
 * import { Intl } from "@cldmv/slothlet/helpers/intrinsics";
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
 * import { CryptoKey } from "@cldmv/slothlet/helpers/intrinsics";
 * typeof CryptoKey === "function";
 */
export const CryptoKey = globalThis.CryptoKey;

/**
 * `queueMicrotask`, as it was when slothlet loaded: the host's own, under none of the boundary patches.
 * @internal
 * @example
 * import { queueMicrotask } from "@cldmv/slothlet/helpers/intrinsics";
 * queueMicrotask(() => settle());
 */
export const queueMicrotask = globalThis.queueMicrotask;

/**
 * `structuredClone`, as it was when slothlet loaded: the host's own, under none of the boundary patches.
 * @internal
 * @example
 * import { structuredClone } from "@cldmv/slothlet/helpers/intrinsics";
 * structuredClone({ a: 1 });
 */
export const structuredClone = globalThis.structuredClone;

/**
 * `setTimeout`, as it was when slothlet loaded: the host's own, under none of the boundary patches.
 * @internal
 * @example
 * import { setTimeout } from "@cldmv/slothlet/helpers/intrinsics";
 * setTimeout(run, 0);
 */
export const setTimeout = globalThis.setTimeout;

/**
 * `clearTimeout`, as it was when slothlet loaded: the host's own, under none of the boundary patches.
 * @internal
 * @example
 * import { setTimeout, clearTimeout } from "@cldmv/slothlet/helpers/intrinsics";
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
 * import { setImmediate } from "@cldmv/slothlet/helpers/intrinsics";
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
 * import { NativeProcess } from "@cldmv/slothlet/helpers/intrinsics";
 * NativeProcess?.env.SLOTHLET_DEBUG;
 * @type {HostProcess|undefined}
 */
export const NativeProcess = globalThis.process;

/**
 * The functions of `process` slothlet calls (`cwd`, `getBuiltinModule`, `nextTick`, `binding`, `kill`, `getuid`,
 * `exit`, `send`), as they were when slothlet loaded, each called on that `process`. A function the host lacks is
 * absent: in a browser the object is empty.
 * @type {object}
 * @internal
 * @example
 * import { Processes } from "@cldmv/slothlet/helpers/intrinsics";
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
 * import { Buffer } from "@cldmv/slothlet/helpers/intrinsics";
 * value instanceof Buffer;
 * @type {HostBufferConstructor|undefined}
 */
export const Buffer = globalThis.Buffer;

/**
 * `Buffer.from`, as it was when slothlet loaded, called on that `Buffer`; empty where there is none.
 * @type {object}
 * @internal
 * @example
 * import { Buffers } from "@cldmv/slothlet/helpers/intrinsics";
 * Buffers.from(text, "utf8");
 */
export const Buffers = boundStaticsOf(globalThis.Buffer, ["from"]);

/**
 * The host's `navigator` object, as it was when slothlet loaded, or undefined where there is none. Its `language` and
 * `languages` are read off it where they are used.
 * @internal
 * @example
 * import { navigator } from "@cldmv/slothlet/helpers/intrinsics";
 * navigator?.languages;
 */
export const navigator = globalThis.navigator;

export { NativeJSON as JSON, NativeMath as Math };
