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
 *	@Last modified time: 2026-11-11T13:14:06-08:00 (1794431646)
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
declare const NativeJSON: object;
declare const NativeMath: object;
export { NativeJSON as JSON, NativeMath as Math };
//# sourceMappingURL=intrinsics.d.mts.map