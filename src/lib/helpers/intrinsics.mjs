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
 *
 * Methods a value inherits (`array.map`, `map.get`) are not covered here: they are looked up on the value when called.
 *
 * @module @cldmv/slothlet/helpers/intrinsics
 * @internal
 */

const NativeObject = Object;
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
export const Arrays = staticsOf(Array);

const NativeJSON = staticsOf(JSON);
const NativeMath = staticsOf(Math);

/**
 * The function under every `toString` wrapper a copy of slothlet installed (see helpers/function-source-context): each
 * holds what it wraps under a registered symbol, so a copy loaded while another's instance is up still takes the
 * language's own function.
 * @param {Function} fn - `Function.prototype.toString` as found.
 * @returns {Function} The function under the wrappers.
 * @private
 */
function unwrapToString(fn) {
	const marker = Symbol.for("slothlet.functionSource.original");
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
export const functionToString = unwrapToString(Function.prototype.toString);

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
 * Bind the named static functions of a constructor to it, on a frozen object with no prototype.
 * @param {Function} constructor - The constructor.
 * @param {string[]} names - The static functions to take.
 * @returns {object} The bound functions, by name.
 * @private
 */
function boundStaticsOf(constructor, names) {
	const copy = create(null);
	for (const name of names) {
		const fn = constructor[name];
		copy[name] = (...args) => apply(fn, constructor, args);
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

export { NativeJSON as JSON, NativeMath as Math };
