/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/helpers/builtin-forms.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:41-08:00 (1795869041)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What the language itself gives a value, read without running any of its code: the form `util.inspect` gives a function, whether a member is inherited from the language's own prototypes, and the `name` / `length` every function has.
 * @module @cldmv/slothlet/helpers/builtin-forms
 * @internal
 */
import { util } from "#helpers/platform";
import { functionSource, Reflect, RegExpMethods, setFrom, SetMethods } from "#helpers/intrinsics";

/**
 * The language's own prototypes an object or function inherits from.
 * @type {Set<object>}
 */
const BUILTIN_PROTOTYPES = setFrom([
	Reflect.getPrototypeOf({}),
	Reflect.getPrototypeOf(function () {}),
	Reflect.getPrototypeOf(async function () {}),
	Reflect.getPrototypeOf(function* () {}),
	Reflect.getPrototypeOf(async function* () {})
]);

/**
 * Whether a name an object does not hold itself is one it inherits from the language's own prototypes, not from one
 * placed between them.
 * @param {object|Function} target - The object.
 * @param {string} prop - The name.
 * @returns {boolean} True when the nearest holder of `prop` is one of the language's own prototypes.
 */
export function inheritsBuiltin(target, prop) {
	let holder = Reflect.getPrototypeOf(target);
	while (holder !== null && !Reflect.getOwnPropertyDescriptor(holder, prop)) holder = Reflect.getPrototypeOf(holder);
	return holder !== null && SetMethods.has(BUILTIN_PROTOTYPES, holder);
}

/**
 * Whether `descriptor` is the `name` or `length` the language gives every function: a string or number value, not
 * writable and not enumerable. A `name` getter, or an enumerable one the module assigned, is the module's own.
 * @param {PropertyKey} prop - The member's key.
 * @param {PropertyDescriptor|undefined} descriptor - The function's own descriptor for it.
 * @returns {boolean} True when the language gave it.
 *
 * @example
 * isLanguageNameDescriptor("length", Reflect.getOwnPropertyDescriptor(function add(a, b) {}, "length")); // true
 */
export function isLanguageNameDescriptor(prop, descriptor) {
	if (prop !== "name" && prop !== "length") return false;
	if (!descriptor || !("value" in descriptor) || descriptor.writable || descriptor.enumerable) return false;
	return typeof descriptor.value === (prop === "name" ? "string" : "number");
}

/**
 * The form `util.inspect` gives a function (`[Function: name]`, `[class Name]`, `[AsyncFunction: name]`, …), made
 * without running any of it: its source is read by the language's own `toString`, and its name only from a data
 * descriptor of a function that is not a Proxy.
 * @param {Function} fn - The function.
 * @returns {string} Its form.
 */
export function codeLabel(fn) {
	const isProxy = util.types.isProxy(fn);
	const name = isProxy ? "" : dataName(fn);
	const named = name === "" ? " (anonymous)" : null;
	if (!isProxy && RegExpMethods.exec(/^class[\s{]/, functionSource(fn)) !== null) {
		// As util.inspect gives it: the class it extends, by that class's own name.
		const parent = Reflect.getPrototypeOf(fn);
		const parentName = typeof parent === "function" && !util.types.isProxy(parent) ? dataName(parent) : "";
		return `[class${named ?? ` ${name}`}${parentName ? ` extends ${parentName}` : ""}]`;
	}
	const async = util.types.isAsyncFunction(fn);
	const kind = util.types.isGeneratorFunction(fn)
		? async
			? "AsyncGeneratorFunction"
			: "GeneratorFunction"
		: async
			? "AsyncFunction"
			: "Function";
	return `[${kind}${named ?? `: ${name}`}]`;
}

/**
 * A function's own `name` when it is a data property holding a string, read by its descriptor so no getter runs.
 * @param {Function} fn - A function that is not a Proxy.
 * @returns {string} The name, empty when there is none.
 */
function dataName(fn) {
	const descriptor = Reflect.getOwnPropertyDescriptor(fn, "name");
	return typeof descriptor?.value === "string" ? descriptor.value : "";
}
