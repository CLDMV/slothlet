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
 * `Function.prototype.toString` itself, as it was when slothlet loaded.
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
declare const NativeJSON: object;
declare const NativeMath: object;
export { NativeJSON as JSON, NativeMath as Math };
//# sourceMappingURL=intrinsics.d.mts.map