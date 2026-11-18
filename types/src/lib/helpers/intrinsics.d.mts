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
 * The entries of a `Map`, for `for…of`, stepped with the iterator `next` taken at load.
 * @param {Map<unknown, unknown>|null|undefined} map - The map; none walks nothing.
 * @returns {Iterable<Array<unknown>>} Its `[key, value]` entries.
 * @internal
 * @example
 * for (const entry of mapEntries(map)) use(entry[0], entry[1]);
 */
export function mapEntries(map: Map<unknown, unknown> | null | undefined): Iterable<Array<unknown>>;
/**
 * The keys of a `Map`, for `for…of`, stepped with the iterator `next` taken at load.
 * @param {Map<unknown, unknown>|null|undefined} map - The map; none walks nothing.
 * @returns {Iterable<unknown>} Its keys.
 * @internal
 * @example
 * for (const key of mapKeys(map)) use(key);
 */
export function mapKeys(map: Map<unknown, unknown> | null | undefined): Iterable<unknown>;
/**
 * The values of a `Map`, for `for…of`, stepped with the iterator `next` taken at load.
 * @param {Map<unknown, unknown>|null|undefined} map - The map; none walks nothing.
 * @returns {Iterable<unknown>} Its values.
 * @internal
 * @example
 * for (const value of mapValues(map)) use(value);
 */
export function mapValues(map: Map<unknown, unknown> | null | undefined): Iterable<unknown>;
/**
 * The values of a `Set`, for `for…of`, stepped with the iterator `next` taken at load.
 * @param {Set<unknown>|null|undefined} set - The set; none walks nothing.
 * @returns {Iterable<unknown>} Its values.
 * @internal
 * @example
 * for (const value of setValues(set)) use(value);
 */
export function setValues(set: Set<unknown> | null | undefined): Iterable<unknown>;
/**
 * The steps of a generator slothlet made, for `for…of`, stepped (and closed when the loop stops early) with the
 * generator functions taken at load.
 * @param {Generator<unknown>} generator - The generator.
 * @returns {Iterable<unknown>} Its values.
 * @internal
 * @example
 * for (const frame of generatorSteps(frames())) use(frame);
 */
export function generatorSteps(generator: Generator<unknown>): Iterable<unknown>;
/**
 * The steps of an async generator, for `for await…of` or `yield*` in an async generator, stepped (and closed or thrown
 * into) with the async generator functions taken at load.
 * @param {AsyncGenerator<unknown>} generator - The async generator.
 * @returns {AsyncIterable<unknown>} Its values.
 * @internal
 * @example
 * for await (const chunk of asyncGeneratorSteps(read())) use(chunk);
 */
export function asyncGeneratorSteps(generator: AsyncGenerator<unknown>): AsyncIterable<unknown>;
/**
 * The elements of an array, for `for…of`, stepped with the array iterator's `next` taken at load.
 * @param {ArrayLike<unknown>} list - The array.
 * @returns {Iterable<unknown>} Its elements.
 * @internal
 * @example
 * for (const frame of listSteps(frames)) use(frame);
 */
export function listSteps(list: ArrayLike<unknown>): Iterable<unknown>;
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
export function listFromIterable(iterable: Iterable<unknown>, map?: (arg0: unknown, arg1: number) => unknown): Array<unknown>;
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
export function copyList(list: ArrayLike<unknown>, start?: number, end?: number): Array<unknown>;
/**
 * A new array holding the elements of each list in turn, read by index.
 * @param {...ArrayLike<unknown>} lists - The arrays.
 * @returns {Array<unknown>} Their elements, in order.
 * @internal
 * @example
 * concatLists([1], [2, 3]); // [1, 2, 3]
 */
export function concatLists(...lists: ArrayLike<unknown>[]): Array<unknown>;
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
export function listPush(list: Array<unknown>, ...values: unknown[]): number;
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
export function listUnshift(list: Array<unknown>, ...values: unknown[]): number;
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
export function listSplice(list: Array<unknown>, start: number, ...rest: unknown[]): Array<unknown>;
/**
 * Append the elements of `list` to `target`, read by index, as `target.push(...list)` does, and answer the new length.
 * @param {Array<unknown>} target - The array to add to.
 * @param {ArrayLike<unknown>} list - The elements to add.
 * @returns {number} The new length of `target`.
 * @internal
 * @example
 * appendList(names, more);
 */
export function appendList(target: Array<unknown>, list: ArrayLike<unknown>): number;
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
export function mapList(list: ArrayLike<unknown>, fn: (arg0: unknown, arg1: number, arg2: ArrayLike<unknown>) => unknown): Array<unknown>;
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
export function filterList(list: ArrayLike<unknown>, fn: (arg0: unknown, arg1: number, arg2: ArrayLike<unknown>) => unknown): Array<unknown>;
/**
 * The values of a `Set` in a new array, read with the `forEach` taken at load.
 * @param {Set<unknown>|null|undefined} set - The set; none gives an empty array.
 * @returns {Array<unknown>} Its values, in order.
 * @internal
 * @example
 * setToArray(new Set([1, 2])); // [1, 2]
 */
export function setToArray(set: Set<unknown> | null | undefined): Array<unknown>;
/**
 * The keys of a `Map` in a new array, read with the `forEach` taken at load.
 * @param {Map<unknown, unknown>|null|undefined} map - The map; none gives an empty array.
 * @returns {Array<unknown>} Its keys, in order.
 * @internal
 * @example
 * mapKeysToArray(new Map([["a", 1]])); // ["a"]
 */
export function mapKeysToArray(map: Map<unknown, unknown> | null | undefined): Array<unknown>;
/**
 * The values of a `Map` in a new array, read with the `forEach` taken at load.
 * @param {Map<unknown, unknown>|null|undefined} map - The map; none gives an empty array.
 * @returns {Array<unknown>} Its values, in order.
 * @internal
 * @example
 * mapValuesToArray(new Map([["a", 1]])); // [1]
 */
export function mapValuesToArray(map: Map<unknown, unknown> | null | undefined): Array<unknown>;
/**
 * The `[key, value]` entries of a `Map` in a new array, read with the `forEach` taken at load.
 * @param {Map<unknown, unknown>|null|undefined} map - The map; none gives an empty array.
 * @returns {Array<Array<unknown>>} Its entries, in order.
 * @internal
 * @example
 * mapEntriesToArray(new Map([["a", 1]])); // [["a", 1]]
 */
export function mapEntriesToArray(map: Map<unknown, unknown> | null | undefined): Array<Array<unknown>>;
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
export function splitText(text: string, separator: string, limit?: number): string[];
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
export function regExpReplace(regexp: RegExp, text: string, replacement: string | Function): string;
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
export function regExpSplit(regexp: RegExp, text: string, limit?: number): string[];
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
export function regExpMatch(regexp: RegExp, text: string): RegExpExecArray | string[] | null;
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
export function regExpSearch(regexp: RegExp, text: string): number;
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
export function textReplace(text: string, search: string, replacement: string | Function): string;
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
export function matchAllOf(text: string, regexp: RegExp): Array<RegExpExecArray>;
/**
 * A {@link SafePromise} settled with `value`: the value itself when it is one, otherwise fulfilled with it.
 * @param {unknown} value - The value.
 * @returns {SafePromise} The promise.
 * @internal
 * @example
 * await settledWith(undefined);
 */
export function settledWith(value: unknown): SafePromise;
/**
 * A promise for the values of the promises (or values) in `list`, as `Promise.all(list)` gives, without walking `list`
 * with its iterator or reading `then` off a promise: each is settled with the `then` taken at load.
 * @param {ArrayLike<unknown>} list - The promises or values.
 * @returns {Promise<Array<unknown>>} Their values, in order; rejected with the first rejection.
 * @internal
 * @example
 * await promiseAll([load(a), load(b)]);
 */
export function promiseAll(list: ArrayLike<unknown>): Promise<Array<unknown>>;
/**
 * A promise for how each of the promises (or values) in `list` settled, as `Promise.allSettled(list)` gives, without
 * walking `list` with its iterator or reading `then` off a promise.
 * @param {ArrayLike<unknown>} list - The promises or values.
 * @returns {Promise<Array<{status: string, value?: unknown, reason?: unknown}>>} How each settled, in order.
 * @internal
 * @example
 * await promiseAllSettled([load(a), load(b)]);
 */
export function promiseAllSettled(list: ArrayLike<unknown>): Promise<Array<{
    status: string;
    value?: unknown;
    reason?: unknown;
}>>;
/**
 * A new object with a data member for each `[key, value]` entry of `list`, as `Object.fromEntries(list)` makes,
 * without walking `list` with its iterator.
 * @param {ArrayLike<ArrayLike<unknown>>} list - The entries.
 * @returns {object} The object.
 * @internal
 * @example
 * objectFromEntries([["a", 1]]); // { a: 1 }
 */
export function objectFromEntries(list: ArrayLike<ArrayLike<unknown>>): object;
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
export function stringOf(value: unknown, depth?: number): string;
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
export function jsonOf(value: unknown, depth?: number): string | undefined;
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
export function describeThrown(thrown: unknown): string;
/**
 * A new `Set` of the elements of `list`, added with the `add` taken at load.
 * @param {ArrayLike<unknown>} list - The elements.
 * @returns {Set<unknown>} The set.
 * @internal
 * @example
 * setFrom(["a", "b"]).size; // 2
 */
export function setFrom(list: ArrayLike<unknown>): Set<unknown>;
/**
 * A new `Map` of the `[key, value]` entries in `entries`, set with the `set` taken at load.
 * @param {ArrayLike<ArrayLike<unknown>>} entries - The entries.
 * @returns {Map<unknown, unknown>} The map.
 * @internal
 * @example
 * mapFrom([["a", 1]]).get("a"); // 1
 */
export function mapFrom(entries: ArrayLike<ArrayLike<unknown>>): Map<unknown, unknown>;
/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/intrinsics.mjs
 *	@Date: 2026-11-11T10:41:20-08:00 (1794422480)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T13:35:20-08:00 (1794951320)
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
export const NativeObject: ObjectConstructor;
/**
 * The functions of `Reflect`, as they were when slothlet loaded.
 * @type {typeof globalThis.Reflect}
 * @internal
 * @example
 * import { Reflect } from "#helpers/intrinsics";
 * Reflect.getOwnPropertyDescriptor(value, "constructor");
 */
export const Reflect: typeof globalThis.Reflect;
/**
 * The static functions of `Object`, as they were when slothlet loaded.
 * @type {ObjectConstructor}
 * @internal
 * @example
 * import { Objects } from "#helpers/intrinsics";
 * Objects.keys(value);
 */
export const Objects: ObjectConstructor;
/**
 * The static functions of `Array`, as they were when slothlet loaded. `Arrays.from` and `Arrays.of` make plain arrays.
 * @type {ArrayConstructor}
 * @internal
 * @example
 * import { Arrays } from "#helpers/intrinsics";
 * Arrays.isArray(value);
 */
export const Arrays: ArrayConstructor;
/**
 * The data members of `Function` (its `prototype`), as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { Functions } from "#helpers/intrinsics";
 * Reflect.getPrototypeOf(value) === Functions.prototype;
 */
export const Functions: object;
/**
 * The `Function` constructor, as it was when slothlet loaded: for checking whether the host lets code be made from a
 * string (the permission baseline), whatever `globalThis.Function` holds afterwards.
 * @type {FunctionConstructor}
 * @internal
 * @example
 * import { NativeFunction } from "#helpers/intrinsics";
 * new NativeFunction("return 1"); // throws EvalError where code from strings is refused
 */
export const NativeFunction: FunctionConstructor;
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
 * import { NativeProxy } from "#helpers/intrinsics";
 * const view = new NativeProxy(shadow, handler);
 */
export const NativeProxy: Function;
/**
 * The `Map` constructor, as it was when slothlet loaded.
 * @type {MapConstructor}
 * @internal
 * @example
 * import { Map } from "#helpers/intrinsics";
 * const seen = new Map();
 */
export const Map: MapConstructor;
/**
 * The `Set` constructor, as it was when slothlet loaded.
 * @type {SetConstructor}
 * @internal
 * @example
 * import { Set } from "#helpers/intrinsics";
 * const seen = new Set();
 */
export const Set: SetConstructor;
/**
 * The `WeakMap` constructor, as it was when slothlet loaded.
 * @type {WeakMapConstructor}
 * @internal
 * @example
 * import { WeakMap } from "#helpers/intrinsics";
 * const views = new WeakMap();
 */
export const WeakMap: WeakMapConstructor;
/**
 * The `WeakSet` constructor, as it was when slothlet loaded.
 * @type {WeakSetConstructor}
 * @internal
 * @example
 * import { WeakSet } from "#helpers/intrinsics";
 * const marked = new WeakSet();
 */
export const WeakSet: WeakSetConstructor;
/**
 * The `WeakRef` constructor, as it was when slothlet loaded.
 * @type {WeakRefConstructor}
 * @internal
 * @example
 * import { WeakRef } from "#helpers/intrinsics";
 * const ref = new WeakRef(target);
 */
export const WeakRef: WeakRefConstructor;
/**
 * The `Promise` constructor, as it was when slothlet loaded. Its static functions are on `Promises`.
 * @type {PromiseConstructor}
 * @internal
 * @example
 * import { Promise } from "#helpers/intrinsics";
 * const done = new Promise((resolve) => setImmediate(resolve));
 */
export const Promise: PromiseConstructor;
/**
 * The `Symbol` function, as it was when slothlet loaded. The well-known symbols (`Symbol.iterator`, …) are read from
 * it; `Symbol.for` and `Symbol.keyFor` are on `Symbols`.
 * @type {SymbolConstructor}
 * @internal
 * @example
 * import { Symbol } from "#helpers/intrinsics";
 * const marker = Symbol("marker");
 */
export const Symbol: SymbolConstructor;
/**
 * `Promise.resolve`, `reject`, `all`, `allSettled`, `race` and `any`, as they were when slothlet loaded, each called
 * on the `Promise` constructor slothlet loaded with.
 * @type {PromiseConstructor}
 * @internal
 * @example
 * import { Promises } from "#helpers/intrinsics";
 * await Promises.all(pending);
 */
export const Promises: PromiseConstructor;
/**
 * `Symbol.for` and `Symbol.keyFor`, as they were when slothlet loaded.
 * @type {SymbolConstructor}
 * @internal
 * @example
 * import { Symbols } from "#helpers/intrinsics";
 * Symbols.for("nodejs.util.inspect.custom");
 */
export const Symbols: SymbolConstructor;
/**
 * The `URL` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * import { URL } from "#helpers/intrinsics";
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
 * `URL.createObjectURL` and `URL.revokeObjectURL`, as they were when slothlet loaded (absent where the host has none).
 * Unbound: call them with `URL` as `this`.
 * @type {{createObjectURL?: function(Blob): string, revokeObjectURL?: function(string): void}}
 * @internal
 * @example
 * import { URL, URLs } from "#helpers/intrinsics";
 * const href = Reflect.apply(URLs.createObjectURL, URL, [blob]);
 */
export const URLs: {
    createObjectURL?: (arg0: Blob) => string;
    revokeObjectURL?: (arg0: string) => void;
};
/**
 * The `URLSearchParams` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * import { URLSearchParams } from "#helpers/intrinsics";
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
 * @type {StringConstructor}
 * @internal
 * @example
 * import { Strings } from "#helpers/intrinsics";
 * Strings.fromCharCode(0x41); // "A"
 */
export const Strings: StringConstructor;
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
 * @type {NumberConstructor}
 * @internal
 * @example
 * import { Numbers } from "#helpers/intrinsics";
 * Numbers.isFinite(value);
 */
export const Numbers: NumberConstructor;
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
 * @type {DateConstructor}
 * @internal
 * @example
 * import { Dates } from "#helpers/intrinsics";
 * const started = Dates.now();
 */
export const Dates: DateConstructor;
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
 * import { Error } from "#helpers/intrinsics";
 * throw new Error("message");
 */
export const Error: ErrorConstructor;
/**
 * `Error.captureStackTrace` and `Error.isError` (where the engine has them), as they were when slothlet loaded.
 * @type {object}
 * @internal
 * @example
 * import { Errors } from "#helpers/intrinsics";
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
 * import { ArrayBuffers } from "#helpers/intrinsics";
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
export const Float16Array: Float16ArrayConstructor | undefined;
/**
 * The `FinalizationRegistry` constructor, as it was when slothlet loaded.
 * @internal
 * @example
 * new FinalizationRegistry(cleanup);
 */
export const FinalizationRegistry: FinalizationRegistryConstructor;
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
export const Iterator: IteratorConstructor | undefined;
/**
 * The static functions of `Iterator` (`from`), as they were when slothlet loaded; empty where the engine has no
 * `Iterator`.
 * @type {object}
 * @internal
 * @example
 * import { Iterators } from "#helpers/intrinsics";
 * Iterators.from(iterable);
 */
export const Iterators: object;
/**
 * The members of `Intl` (its constructors, `Intl.Segmenter` among them), as they were when slothlet loaded, shadowing
 * the global like `JSON`.
 * @type {typeof globalThis.Intl}
 * @internal
 * @example
 * import { Intl } from "#helpers/intrinsics";
 * new Intl.Segmenter();
 */
export const Intl: typeof globalThis.Intl;
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
 * import { CryptoKey } from "#helpers/intrinsics";
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
 * import { queueMicrotask } from "#helpers/intrinsics";
 * queueMicrotask(() => settle());
 */
export const queueMicrotask: typeof globalThis.queueMicrotask;
/**
 * `structuredClone`, as it was when slothlet loaded: the host's own, under none of the boundary patches.
 * @internal
 * @example
 * import { structuredClone } from "#helpers/intrinsics";
 * structuredClone({ a: 1 });
 */
export const structuredClone: typeof globalThis.structuredClone;
/**
 * `setTimeout`, as it was when slothlet loaded: the host's own, under none of the boundary patches.
 * @internal
 * @example
 * import { setTimeout } from "#helpers/intrinsics";
 * setTimeout(run, 0);
 */
export const setTimeout: typeof globalThis.setTimeout;
/**
 * `clearTimeout`, as it was when slothlet loaded: the host's own, under none of the boundary patches.
 * @internal
 * @example
 * import { setTimeout, clearTimeout } from "#helpers/intrinsics";
 * clearTimeout(setTimeout(run, 1000));
 */
export const clearTimeout: typeof globalThis.clearTimeout;
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
export const setImmediate: ImmediateScheduler | undefined;
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
export const NativeProcess: HostProcess | undefined;
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
export const Processes: object;
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
export const Buffer: HostBufferConstructor | undefined;
/**
 * `Buffer.from`, as it was when slothlet loaded, called on that `Buffer`; empty where there is none.
 * @type {object}
 * @internal
 * @example
 * import { Buffers } from "#helpers/intrinsics";
 * Buffers.from(text, "utf8");
 */
export const Buffers: object;
/**
 * The host's `navigator` object, as it was when slothlet loaded, or undefined where there is none. Its `language` and
 * `languages` are read off it where they are used.
 * @internal
 * @example
 * import { navigator } from "#helpers/intrinsics";
 * navigator?.languages;
 */
export const navigator: Navigator;
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
export const ArrayMethods: object;
/**
 * The methods of `String.prototype`, as they were when slothlet loaded, each taking the string first.
 * @type {object}
 * @internal
 * @example
 * import { StringMethods } from "#helpers/intrinsics";
 * StringMethods.startsWith(text, "node:");
 */
export const StringMethods: object;
/**
 * The methods of `Map.prototype` (and its `size`), as they were when slothlet loaded, each taking the map first.
 * @type {object}
 * @internal
 * @example
 * import { MapMethods } from "#helpers/intrinsics";
 * MapMethods.get(map, key);
 */
export const MapMethods: object;
/**
 * The methods of `Set.prototype` (and its `size`), as they were when slothlet loaded, each taking the set first.
 * @type {object}
 * @internal
 * @example
 * import { SetMethods } from "#helpers/intrinsics";
 * SetMethods.has(set, value);
 */
export const SetMethods: object;
/**
 * The methods of `WeakMap.prototype`, as they were when slothlet loaded, each taking the map first.
 * @type {object}
 * @internal
 * @example
 * import { WeakMapMethods } from "#helpers/intrinsics";
 * WeakMapMethods.get(views, target);
 */
export const WeakMapMethods: object;
/**
 * The methods of `WeakSet.prototype`, as they were when slothlet loaded, each taking the set first.
 * @type {object}
 * @internal
 * @example
 * import { WeakSetMethods } from "#helpers/intrinsics";
 * WeakSetMethods.has(seen, value);
 */
export const WeakSetMethods: object;
/**
 * The methods of `WeakRef.prototype` (`deref`), as they were when slothlet loaded, each taking the reference first.
 * @type {object}
 * @internal
 * @example
 * import { WeakRefMethods } from "#helpers/intrinsics";
 * WeakRefMethods.deref(ref);
 */
export const WeakRefMethods: object;
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
export const RegExpMethods: object;
/**
 * The methods of `Promise.prototype` (`then`, `catch`, `finally`), as they were when slothlet loaded, each taking the
 * promise first.
 * @type {object}
 * @internal
 * @example
 * import { PromiseMethods } from "#helpers/intrinsics";
 * PromiseMethods.then(promise, onFulfilled, onRejected);
 */
export const PromiseMethods: object;
/**
 * The methods of `Function.prototype` (`call`, `apply`, `bind`, `toString`), as they were when slothlet loaded, each
 * taking the function first: `FunctionMethods.call(fn, thisArg, a, b)` runs `fn` as `fn.call(thisArg, a, b)` would.
 * @type {object}
 * @internal
 * @example
 * import { FunctionMethods } from "#helpers/intrinsics";
 * FunctionMethods.bind(fn, receiver);
 */
export const FunctionMethods: object;
/**
 * The methods of `Object.prototype` (`hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `toString`, …), as
 * they were when slothlet loaded, each taking the value first.
 * @type {object}
 * @internal
 * @example
 * import { ObjectMethods } from "#helpers/intrinsics";
 * ObjectMethods.hasOwnProperty(value, "key");
 */
export const ObjectMethods: object;
/**
 * The methods of `Number.prototype`, as they were when slothlet loaded, each taking the number first.
 * @type {object}
 * @internal
 * @example
 * import { NumberMethods } from "#helpers/intrinsics";
 * NumberMethods.toString(255, 16); // "ff"
 */
export const NumberMethods: object;
/**
 * The methods of `Date.prototype`, as they were when slothlet loaded, each taking the date first.
 * @type {object}
 * @internal
 * @example
 * import { DateMethods } from "#helpers/intrinsics";
 * DateMethods.toISOString(date);
 */
export const DateMethods: object;
/**
 * The methods and accessors of `Symbol.prototype` (`description`, `toString`), as they were when slothlet loaded,
 * each taking the symbol first.
 * @type {object}
 * @internal
 * @example
 * import { SymbolMethods } from "#helpers/intrinsics";
 * SymbolMethods.description(marker);
 */
export const SymbolMethods: object;
/**
 * The methods of `Error.prototype` (`toString`), as they were when slothlet loaded, each taking the error first.
 * @type {object}
 * @internal
 * @example
 * import { ErrorMethods } from "#helpers/intrinsics";
 * ErrorMethods.toString(error);
 */
export const ErrorMethods: object;
/**
 * The methods and accessors the typed arrays share (`length`, `byteLength`, `buffer`, `subarray`, `set`, …), as they
 * were when slothlet loaded, each taking the typed array first.
 * @type {object}
 * @internal
 * @example
 * import { TypedArrayMethods } from "#helpers/intrinsics";
 * TypedArrayMethods.length(bytes);
 */
export const TypedArrayMethods: object;
/**
 * The methods and accessors of `ArrayBuffer.prototype` (`byteLength`, `slice`, …), as they were when slothlet loaded,
 * each taking the buffer first.
 * @type {object}
 * @internal
 * @example
 * import { ArrayBufferMethods } from "#helpers/intrinsics";
 * ArrayBufferMethods.byteLength(buffer);
 */
export const ArrayBufferMethods: object;
/**
 * The methods and accessors of `URL.prototype` (`href`, `pathname`, `searchParams`, `toString`, …), as they were when
 * slothlet loaded, each taking the URL first.
 * @type {object}
 * @internal
 * @example
 * import { URLMethods } from "#helpers/intrinsics";
 * URLMethods.href(new URL("./a.mjs", base));
 */
export const URLMethods: object;
/**
 * The methods of `URLSearchParams.prototype`, as they were when slothlet loaded, each taking the parameters first.
 * @type {object}
 * @internal
 * @example
 * import { URLSearchParamsMethods } from "#helpers/intrinsics";
 * URLSearchParamsMethods.get(params, "slothlet_instance");
 */
export const URLSearchParamsMethods: object;
/**
 * The methods and accessors of `TextDecoder.prototype` (`decode`, `encoding`, …), as they were when slothlet loaded,
 * each taking the decoder first; empty where the host has none.
 * @type {object}
 * @internal
 * @example
 * import { TextDecoderMethods } from "#helpers/intrinsics";
 * TextDecoderMethods.decode(new TextDecoder(), bytes);
 */
export const TextDecoderMethods: object;
/**
 * The methods and accessors of `TextEncoder.prototype` (`encode`, …), as they were when slothlet loaded, each taking
 * the encoder first; empty where the host has none.
 * @type {object}
 * @internal
 * @example
 * import { TextEncoderMethods } from "#helpers/intrinsics";
 * TextEncoderMethods.encode(new TextEncoder(), text);
 */
export const TextEncoderMethods: object;
/**
 * The methods of Node's `Buffer.prototype` (`toString`, …), as they were when slothlet loaded, each taking the buffer
 * first; empty where the host has none (a browser).
 * @type {object}
 * @internal
 * @example
 * import { BufferMethods } from "#helpers/intrinsics";
 * BufferMethods.toString(chunk, "utf8");
 */
export const BufferMethods: object;
/**
 * The methods of `FinalizationRegistry.prototype` (`register`, `unregister`), as they were when slothlet loaded, each
 * taking the registry first.
 * @type {object}
 * @internal
 * @example
 * import { FinalizationRegistryMethods } from "#helpers/intrinsics";
 * FinalizationRegistryMethods.register(registry, target, held);
 */
export const FinalizationRegistryMethods: object;
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
export const IteratorMethods: object;
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
export const PrototypeFunctions: Readonly<Record<string, Readonly<Record<string, Function>>>>;
/**
 * `%TypedArray%.prototype`, the prototype every typed array class's `prototype` inherits from, as it was when slothlet
 * loaded (its functions and getters are `PrototypeFunctions.TypedArray`).
 * @type {object}
 * @internal
 * @example
 * import { TypedArrayPrototype } from "#helpers/intrinsics";
 * Reflect.getPrototypeOf(Uint8Array.prototype) === TypedArrayPrototype;
 */
export const TypedArrayPrototype: object;
/**
 * The language's own setter of `Object.prototype.__proto__`, as it was when slothlet loaded (its getter is
 * `PrototypeFunctions.Object.__proto__`).
 * @type {function(this: object, (object|null)): void}
 * @internal
 * @example
 * import { ObjectProtoSetter, Reflect } from "#helpers/intrinsics";
 * Reflect.apply(ObjectProtoSetter, value, [null]);
 */
export const ObjectProtoSetter: (this: object, arg1: (object | null)) => void;
/**
 * The `Array` function, as it was when slothlet loaded, for comparing a value's `constructor` against. Its static
 * functions are on `Arrays`.
 * @type {ArrayConstructor}
 * @internal
 * @example
 * import { NativeArray } from "#helpers/intrinsics";
 * value.constructor === NativeArray;
 */
export const NativeArray: ArrayConstructor;
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
export class SafePromise extends Promise<any> {
    constructor(executor: (resolve: (value: any) => void, reject: (reason?: any) => void) => void);
}
/**
 * The shape of the `Float16Array` constructor, which the declaration build's library does not know: the same members
 * as `Float32ArrayConstructor` (its instances are typed arrays over numbers).
 */
export type Float16ArrayConstructor = Float32ArrayConstructor;
/**
 * The shape of the `Iterator` constructor, which the declaration build's library does not know: the members slothlet
 * reads (`Iterator.prototype`, `Iterator.from`).
 */
export type IteratorConstructor = {
    /**
     * - `Iterator.prototype`.
     */
    prototype: object;
    /**
     * - `Iterator.from`.
     */
    from: (arg0: object) => object;
};
/**
 * The shape of `setImmediate`, which the declaration build's library does not know: it takes a callback and the
 * arguments to hand it, and answers the handle.
 */
export type ImmediateScheduler = (arg0: (...args: unknown[]) => void, ...args: unknown[]) => unknown;
/**
 * The members of the host's `process` object that slothlet reads where they are used.
 */
export type HostProcess = {
    /**
     * - The environment.
     */
    env: {
        [x: string]: string | undefined;
    };
    /**
     * - The command line.
     */
    argv: string[];
    /**
     * - The versions of the runtime and its parts.
     */
    versions: {
        [x: string]: string | undefined;
    };
    /**
     * - The platform.
     */
    platform: string;
    /**
     * - The process ID.
     */
    pid: number;
};
/**
 * The members of Node's `Buffer` constructor that slothlet reads (`instanceof Buffer`, `Buffer.from`).
 */
export type HostBufferConstructor = {
    /**
     * - `Buffer.prototype`.
     */
    prototype: Uint8Array;
    /**
     * - `Buffer.from`.
     */
    from: (arg0: (string | ArrayBuffer | ArrayLike<number>), arg1: string | undefined) => Uint8Array;
    /**
     * - `Buffer.isBuffer`.
     */
    isBuffer: (arg0: unknown) => boolean;
};
/** @type {JSON} */
declare const NativeJSON: JSON;
/** @type {Math} */
declare const NativeMath: Math;
export { NativeJSON as JSON, NativeMath as Math };
//# sourceMappingURL=intrinsics.d.mts.map