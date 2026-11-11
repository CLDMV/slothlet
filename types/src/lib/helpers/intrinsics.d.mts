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
declare const NativeJSON: object;
declare const NativeMath: object;
export { NativeJSON as JSON, NativeMath as Math };
//# sourceMappingURL=intrinsics.d.mts.map