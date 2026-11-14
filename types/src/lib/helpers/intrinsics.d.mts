/**
 * The source text of a function, by the language's own `Function.prototype.toString` as it was when slothlet loaded.
 * @param {Function} fn - The function.
 * @returns {string} Its source text.
 * @internal
 * @example
 * functionSource(Math.max); // "function max() { [native code] }"
 */
export function functionSource(fn: Function): string;
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
 *   `queueMicrotask`, `structuredClone`, `setTimeout`, `setImmediate`, `decodeURIComponent`, `encodeURIComponent`, `parseInt`, `isNaN`,
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
export const NativeObject: ObjectConstructor;
/**
 * The functions of `Reflect`, as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { Reflect } from "@cldmv/slothlet/helpers/intrinsics";
 * Reflect.getOwnPropertyDescriptor(value, "constructor");
 */
export const Reflect: object;
/**
 * The static functions of `Object`, as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { Objects } from "@cldmv/slothlet/helpers/intrinsics";
 * Objects.keys(value);
 */
export const Objects: object;
/**
 * The static functions of `Array`, as they were when slothlet loaded. `Arrays.from` and `Arrays.of` make plain arrays.
 * @type {object}
 * @internal
 * @example
 * import { Arrays } from "@cldmv/slothlet/helpers/intrinsics";
 * Arrays.isArray(value);
 */
export const Arrays: object;
/**
 * The data members of `Function` (its `prototype`), as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { Functions } from "@cldmv/slothlet/helpers/intrinsics";
 * Reflect.getPrototypeOf(value) === Functions.prototype;
 */
export const Functions: object;
/**
 * `Function.prototype.toString` itself, as it was when slothlet loaded (the language's own, under any wrapper another
 * copy of slothlet had installed then).
 * @type {Function}
 * @internal
 * @example
 * value === functionToString; // whether a member read is the language's own `toString`
 */
export const functionToString: Function;
/**
 * The `Proxy` constructor, as it was when slothlet loaded.
 * @type {Function}
 * @internal
 * @example
 * import { NativeProxy } from "@cldmv/slothlet/helpers/intrinsics";
 * const view = new NativeProxy(shadow, handler);
 */
export const NativeProxy: Function;
/**
 * The `Map` constructor, as it was when slothlet loaded.
 * @type {MapConstructor}
 * @internal
 * @example
 * import { Map } from "@cldmv/slothlet/helpers/intrinsics";
 * const seen = new Map();
 */
export const Map: MapConstructor;
/**
 * The `Set` constructor, as it was when slothlet loaded.
 * @type {SetConstructor}
 * @internal
 * @example
 * import { Set } from "@cldmv/slothlet/helpers/intrinsics";
 * const seen = new Set();
 */
export const Set: SetConstructor;
/**
 * The `WeakMap` constructor, as it was when slothlet loaded.
 * @type {WeakMapConstructor}
 * @internal
 * @example
 * import { WeakMap } from "@cldmv/slothlet/helpers/intrinsics";
 * const views = new WeakMap();
 */
export const WeakMap: WeakMapConstructor;
/**
 * The `WeakSet` constructor, as it was when slothlet loaded.
 * @type {WeakSetConstructor}
 * @internal
 * @example
 * import { WeakSet } from "@cldmv/slothlet/helpers/intrinsics";
 * const marked = new WeakSet();
 */
export const WeakSet: WeakSetConstructor;
/**
 * The `WeakRef` constructor, as it was when slothlet loaded.
 * @type {WeakRefConstructor}
 * @internal
 * @example
 * import { WeakRef } from "@cldmv/slothlet/helpers/intrinsics";
 * const ref = new WeakRef(target);
 */
export const WeakRef: WeakRefConstructor;
/**
 * The `Promise` constructor, as it was when slothlet loaded. Its static functions are on `Promises`.
 * @type {PromiseConstructor}
 * @internal
 * @example
 * import { Promise } from "@cldmv/slothlet/helpers/intrinsics";
 * const done = new Promise((resolve) => setImmediate(resolve));
 */
export const Promise: PromiseConstructor;
/**
 * The `Symbol` function, as it was when slothlet loaded. The well-known symbols (`Symbol.iterator`, …) are read from
 * it; `Symbol.for` and `Symbol.keyFor` are on `Symbols`.
 * @type {SymbolConstructor}
 * @internal
 * @example
 * import { Symbol } from "@cldmv/slothlet/helpers/intrinsics";
 * const marker = Symbol("marker");
 */
export const Symbol: SymbolConstructor;
/**
 * `Promise.resolve`, `reject`, `all`, `allSettled`, `race` and `any`, as they were when slothlet loaded, each called
 * on the `Promise` constructor slothlet loaded with.
 * @type {PromiseConstructor}
 * @internal
 * @example
 * import { Promises } from "@cldmv/slothlet/helpers/intrinsics";
 * await Promises.all(pending);
 */
export const Promises: PromiseConstructor;
/**
 * `Symbol.for` and `Symbol.keyFor`, as they were when slothlet loaded.
 * @type {SymbolConstructor}
 * @internal
 * @example
 * import { Symbols } from "@cldmv/slothlet/helpers/intrinsics";
 * Symbols.for("nodejs.util.inspect.custom");
 */
export const Symbols: SymbolConstructor;
/**
 * The `URL` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * import { URL } from "@cldmv/slothlet/helpers/intrinsics";
 * const href = new URL("./a.mjs", import.meta.url).href;
 */
export const URL: {
    new (url: string | URL, base?: string | URL): URL;
    prototype: URL;
    canParse(url: string | URL, base?: string | URL): boolean;
    createObjectURL(obj: Blob | MediaSource): string;
    parse(url: string | URL, base?: string | URL): URL | null;
    revokeObjectURL(url: string): void;
};
/**
 * The `URLSearchParams` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * import { URLSearchParams } from "@cldmv/slothlet/helpers/intrinsics";
 * new URLSearchParams(query).get("slothlet_instance");
 */
export const URLSearchParams: {
    new (init?: string[][] | Record<string, string> | string | URLSearchParams): URLSearchParams;
    prototype: URLSearchParams;
};
/**
 * The `String` function, as it was when slothlet loaded. Its static functions are on `Strings`.
 * @internal
 * @example
 * String(value); // the language's own conversion
 */
export const String: StringConstructor;
/**
 * The static functions of `String` (`fromCharCode`, `fromCodePoint`, `raw`), as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { Strings } from "@cldmv/slothlet/helpers/intrinsics";
 * Strings.fromCharCode(0x41); // "A"
 */
export const Strings: object;
/**
 * The `Boolean` function, as it was when slothlet loaded.
 * @internal
 * @example
 * Boolean(value);
 */
export const Boolean: BooleanConstructor;
/**
 * The `Number` function, as it was when slothlet loaded. Its static functions and constants are on `Numbers`.
 * @internal
 * @example
 * Number(value);
 */
export const Number: NumberConstructor;
/**
 * The static functions and constants of `Number`, as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { Numbers } from "@cldmv/slothlet/helpers/intrinsics";
 * Numbers.isFinite(value);
 */
export const Numbers: object;
/**
 * The `BigInt` function, as it was when slothlet loaded.
 * @internal
 * @example
 * BigInt(1);
 */
export const BigInt: BigIntConstructor;
/**
 * The `Date` constructor, as it was when slothlet loaded. `Date.now` and the other static functions are on `Dates`.
 * @internal
 * @example
 * new Date(time);
 */
export const Date: DateConstructor;
/**
 * The static functions of `Date` (`now`, `parse`, `UTC`), as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { Dates } from "@cldmv/slothlet/helpers/intrinsics";
 * const started = Dates.now();
 */
export const Dates: object;
/**
 * The `RegExp` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new RegExp(pattern, "u");
 */
export const RegExp: RegExpConstructor;
/**
 * The `Error` constructor, as it was when slothlet loaded: the realm's own, which the engine reads `stackTraceLimit` and
 * `prepareStackTrace` from. `class SlothletError extends Error` extends this one. `Error.captureStackTrace` and
 * `Error.isError` are on `Errors`.
 * @internal
 * @example
 * import { Error } from "@cldmv/slothlet/helpers/intrinsics";
 * throw new Error("message");
 */
export const Error: ErrorConstructor;
/**
 * `Error.captureStackTrace` and `Error.isError` (where the engine has them), as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { Errors } from "@cldmv/slothlet/helpers/intrinsics";
 * Errors.captureStackTrace(error, constructorOpt);
 */
export const Errors: object;
/**
 * The `EvalError` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new EvalError("message");
 */
export const EvalError: EvalErrorConstructor;
/**
 * The `RangeError` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new RangeError("message");
 */
export const RangeError: RangeErrorConstructor;
/**
 * The `ReferenceError` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new ReferenceError("message");
 */
export const ReferenceError: ReferenceErrorConstructor;
/**
 * The `SyntaxError` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new SyntaxError("message");
 */
export const SyntaxError: SyntaxErrorConstructor;
/**
 * The `TypeError` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new TypeError("message");
 */
export const TypeError: TypeErrorConstructor;
/**
 * The `URIError` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new URIError("message");
 */
export const URIError: URIErrorConstructor;
/**
 * The `AggregateError` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new AggregateError("message");
 */
export const AggregateError: AggregateErrorConstructor;
/**
 * The `ArrayBuffer` constructor, as it was when slothlet loaded. `ArrayBuffer.isView` is on `ArrayBuffers`.
 * @internal
 * @example
 * new ArrayBuffer(8);
 */
export const ArrayBuffer: ArrayBufferConstructor;
/**
 * The static functions of `ArrayBuffer` (`isView`), as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { ArrayBuffers } from "@cldmv/slothlet/helpers/intrinsics";
 * ArrayBuffers.isView(value);
 */
export const ArrayBuffers: object;
/**
 * The `SharedArrayBuffer` constructor, or undefined where the host has none (a browser page that is not cross-origin isolated), as it was when slothlet loaded.
 * @internal
 * @example
 * typeof SharedArrayBuffer === "function";
 */
export const SharedArrayBuffer: SharedArrayBufferConstructor;
/**
 * The `DataView` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new DataView(buffer);
 */
export const DataView: DataViewConstructor;
/**
 * The `Int8Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Int8Array(8);
 */
export const Int8Array: Int8ArrayConstructor;
/**
 * The `Uint8Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Uint8Array(8);
 */
export const Uint8Array: Uint8ArrayConstructor;
/**
 * The `Uint8ClampedArray` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Uint8ClampedArray(8);
 */
export const Uint8ClampedArray: Uint8ClampedArrayConstructor;
/**
 * The `Int16Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Int16Array(8);
 */
export const Int16Array: Int16ArrayConstructor;
/**
 * The `Uint16Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Uint16Array(8);
 */
export const Uint16Array: Uint16ArrayConstructor;
/**
 * The `Int32Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Int32Array(8);
 */
export const Int32Array: Int32ArrayConstructor;
/**
 * The `Uint32Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Uint32Array(8);
 */
export const Uint32Array: Uint32ArrayConstructor;
/**
 * The `Float32Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Float32Array(8);
 */
export const Float32Array: Float32ArrayConstructor;
/**
 * The `Float64Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new Float64Array(8);
 */
export const Float64Array: Float64ArrayConstructor;
/**
 * The `BigInt64Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new BigInt64Array(8);
 */
export const BigInt64Array: BigInt64ArrayConstructor;
/**
 * The `BigUint64Array` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new BigUint64Array(8);
 */
export const BigUint64Array: BigUint64ArrayConstructor;
/**
 * The `Float16Array` constructor, or undefined where the engine has none, as it was when slothlet loaded.
 * @internal
 * @example
 * typeof Float16Array === "function";
 */
export const Float16Array: any;
/**
 * The `FinalizationRegistry` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new FinalizationRegistry(cleanup);
 */
export const FinalizationRegistry: FinalizationRegistryConstructor;
/**
 * The `Iterator` constructor, or undefined where the engine has none, as it was when slothlet loaded. `Iterator.from` is on `Iterators`.
 * @internal
 * @example
 * Iterator.prototype;
 */
export const Iterator: any;
/**
 * The static functions of `Iterator` (`from`), as they were when slothlet loaded; empty where the engine has no
 * `Iterator`.
 * @type {object}
 * @internal
 * @example
 * import { Iterators } from "@cldmv/slothlet/helpers/intrinsics";
 * Iterators.from(iterable);
 */
export const Iterators: object;
/**
 * The members of `Intl` (its constructors, `Intl.Segmenter` among them), as they were when slothlet loaded, shadowing
 * the global like `JSON`.
 * @type {object}
 * @internal
 * @example
 * import { Intl } from "@cldmv/slothlet/helpers/intrinsics";
 * new Intl.Segmenter();
 */
export const Intl: object;
/**
 * The `TextDecoder` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new TextDecoder().decode(bytes);
 */
export const TextDecoder: {
    new (label?: string, options?: TextDecoderOptions): TextDecoder;
    prototype: TextDecoder;
};
/**
 * The `TextEncoder` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new TextEncoder().encode(text);
 */
export const TextEncoder: {
    new (): TextEncoder;
    prototype: TextEncoder;
};
/**
 * The `Blob` constructor, or undefined where the host has none, as it was when slothlet loaded.
 * @internal
 * @example
 * new Blob([text]);
 */
export const Blob: {
    new (blobParts?: BlobPart[], options?: BlobPropertyBag): Blob;
    prototype: Blob;
};
/**
 * The `EventTarget` constructor, or undefined where the host has none, as it was when slothlet loaded.
 * @internal
 * @example
 * EventTarget.prototype.addEventListener;
 */
export const EventTarget: {
    new (): EventTarget;
    prototype: EventTarget;
};
/**
 * The `MessageChannel` constructor, or undefined where the host has none, as it was when slothlet loaded.
 * @internal
 * @example
 * new MessageChannel();
 */
export const MessageChannel: {
    new (): MessageChannel;
    prototype: MessageChannel;
};
/**
 * The Web Crypto `CryptoKey` constructor, as it was when slothlet loaded, or undefined where the host has none.
 * @internal
 * @example
 * import { CryptoKey } from "@cldmv/slothlet/helpers/intrinsics";
 * typeof CryptoKey === "function";
 */
export const CryptoKey: {
    new (): CryptoKey;
    prototype: CryptoKey;
};
/**
 * `queueMicrotask`, as it was when slothlet loaded: the host's own, under none of the boundary patches.
 * @internal
 * @example
 * import { queueMicrotask } from "@cldmv/slothlet/helpers/intrinsics";
 * queueMicrotask(() => settle());
 */
export const queueMicrotask: typeof globalThis.queueMicrotask;
/**
 * `structuredClone`, as it was when slothlet loaded: the host's own, under none of the boundary patches.
 * @internal
 * @example
 * import { structuredClone } from "@cldmv/slothlet/helpers/intrinsics";
 * structuredClone({ a: 1 });
 */
export const structuredClone: typeof globalThis.structuredClone;
/**
 * `setTimeout`, as it was when slothlet loaded: the host's own, under none of the boundary patches.
 * @internal
 * @example
 * import { setTimeout } from "@cldmv/slothlet/helpers/intrinsics";
 * setTimeout(run, 0);
 */
export const setTimeout: typeof globalThis.setTimeout;
/**
 * `setImmediate`, as it was when slothlet loaded, or undefined where the host has none (a browser).
 * @internal
 * @example
 * import { setImmediate } from "@cldmv/slothlet/helpers/intrinsics";
 * setImmediate?.(run);
 */
export const setImmediate: any;
/**
 * `decodeURIComponent`, as it was when slothlet loaded.
 * @internal
 * @example
 * decodeURIComponent("%20"); // " "
 */
export const decodeURIComponent: typeof globalThis.decodeURIComponent;
/**
 * `encodeURIComponent`, as it was when slothlet loaded.
 * @internal
 * @example
 * encodeURIComponent(" "); // "%20"
 */
export const encodeURIComponent: typeof globalThis.encodeURIComponent;
/**
 * `parseInt`, as it was when slothlet loaded.
 * @internal
 * @example
 * parseInt("ff", 16); // 255
 */
export const parseInt: typeof globalThis.parseInt;
/**
 * `isNaN`, as it was when slothlet loaded.
 * @internal
 * @example
 * isNaN(value);
 */
export const isNaN: typeof globalThis.isNaN;
/**
 * The host's `process` object, as it was when slothlet loaded, or undefined where there is none (a browser). Its data
 * members (`env`, `pid`, `argv`, `versions`, `platform`) are read off it where they are used; the functions slothlet
 * calls are on `Processes`.
 * @internal
 * @example
 * import { NativeProcess } from "@cldmv/slothlet/helpers/intrinsics";
 * NativeProcess?.env.SLOTHLET_DEBUG;
 */
export const NativeProcess: any;
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
export const Processes: object;
/**
 * Node's `Buffer` constructor, as it was when slothlet loaded, or undefined where there is none (a browser).
 * `Buffer.from` is on `Buffers`.
 * @internal
 * @example
 * import { Buffer } from "@cldmv/slothlet/helpers/intrinsics";
 * value instanceof Buffer;
 */
export const Buffer: any;
/**
 * `Buffer.from`, as it was when slothlet loaded, called on that `Buffer`; empty where there is none.
 * @type {object}
 * @internal
 * @example
 * import { Buffers } from "@cldmv/slothlet/helpers/intrinsics";
 * Buffers.from(text, "utf8");
 */
export const Buffers: object;
/**
 * The host's `navigator` object, as it was when slothlet loaded, or undefined where there is none. Its `language` and
 * `languages` are read off it where they are used.
 * @internal
 * @example
 * import { navigator } from "@cldmv/slothlet/helpers/intrinsics";
 * navigator?.languages;
 */
export const navigator: Navigator;
declare const NativeJSON: object;
declare const NativeMath: object;
export { NativeJSON as JSON, NativeMath as Math };
//# sourceMappingURL=intrinsics.d.mts.map