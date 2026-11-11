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
 *
 * Methods a value inherits (`array.map`, `map.get`) are not covered here: they are looked up on the value when called.
 *
 * @module @cldmv/slothlet/helpers/intrinsics
 * @internal
 */

const NativeObject = Object;
const NativeReflect = globalThis.Reflect;
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
export const Arrays = staticsOf(Array);

const NativeJSON = staticsOf(JSON);
const NativeMath = staticsOf(Math);

/**
 * `Function.prototype.toString` itself, as it was when slothlet loaded.
 * @type {Function}
 * @internal
 * @example
 * value === functionToString; // whether a member read is the language's own `toString`
 */
export const functionToString = Function.prototype.toString;

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
export const NativeProxy = Proxy;

export { NativeJSON as JSON, NativeMath as Math };
