/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/stack-read.mjs
 *	@Date: 2026-11-14T12:00:00-08:00 (1794686400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T12:00:00-08:00 (1794686400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Reading the call stack with slothlet's own formatter, whatever the global `Error` and its stack
 * settings hold.
 *
 * @description
 * slothlet tells which file's code is running by the call stack. On V8 the stack is handed to a formatter, which Node
 * looks up when the stack is first read as `globalThis.Error.prepareStackTrace`: the current global `Error`, not the
 * one slothlet loaded with. The engine reads the frame budget off the realm's own `Error.stackTraceLimit`, and only
 * when it is a plain value. Code running in the same realm can change all three: put another `Error` on the global
 * object, make `prepareStackTrace` or `stackTraceLimit` an accessor (on `Error` or, once `Error`'s own is removed, on
 * `Function.prototype`), or give the global one a formatter of its own. Any of these would hand slothlet frames that
 * code chose.
 *
 * {@link readStack} holds all three for the read: the global `Error` is slothlet's, and `prepareStackTrace` and
 * `stackTraceLimit` are plain values on it, set in place, and then put back as they were. It then checks that its own
 * formatter ran for the error it made. When a property cannot be held (it was made read-only and fixed in place) or the
 * formatter it set is not the one that ran, it reports that nothing was read, and the caller refuses what depended on
 * the read. The call sites the engine hands the formatter are its own: their methods are fixed on their prototype.
 *
 * An engine without a formatter hook (Firefox, Safari) formats the stack as text. That text is read through the
 * `stack` getter as it was when slothlet loaded (or the error's own value, where the engine sets one), so a getter
 * defined later is not what is read.
 *
 * @module @cldmv/slothlet/helpers/stack-read
 * @internal
 */

import { Error, Errors, Objects, Reflect, Symbol } from "@cldmv/slothlet/helpers/intrinsics";

/**
 * The realm's `Error`, as slothlet loaded with it.
 * @type {ErrorConstructor}
 * @private
 */
const RealmError = Error;

/**
 * The global object, whose `Error` the engine's formatter lookup reads.
 * @type {object}
 * @private
 */
const GLOBAL = globalThis;

/**
 * The `stack` getter the engine gives errors (V8 puts it on each error, SpiderMonkey on `Error.prototype`), as it was
 * when slothlet loaded; null where the engine gives each error its own value instead.
 * @type {Function|null}
 * @private
 */
const STACK_GETTER =
	Objects.getOwnPropertyDescriptor(new RealmError(), "stack")?.get ??
	Objects.getOwnPropertyDescriptor(RealmError.prototype, "stack")?.get ??
	null;

/**
 * A property {@link hold} did not change: it held the value already.
 * @type {symbol}
 * @private
 */
const UNCHANGED = Symbol("unchanged");

/**
 * A property {@link hold} made: there was no own property before.
 * @type {symbol}
 * @private
 */
const ABSENT = Symbol("absent");

/**
 * Make `target[key]` a plain value for a read, without running code anyone put on it: an own writable value is set in
 * place, anything else (absent, an accessor, read-only) is defined over while it can be.
 * @param {object} target - The object.
 * @param {string} key - The property.
 * @param {unknown} value - The value to hold.
 * @returns {PropertyDescriptor|symbol} What to put back with {@link release}.
 * @throws {TypeError} When the property is fixed in place with another value.
 * @private
 */
function hold(target, key, value) {
	const saved = Objects.getOwnPropertyDescriptor(target, key);
	if (saved !== undefined && "value" in saved) {
		if (saved.value === value) return UNCHANGED;
		if (saved.writable) {
			target[key] = value;
			return saved;
		}
	}
	Objects.defineProperty(target, key, { value, writable: true, enumerable: saved?.enumerable ?? false, configurable: true });
	return saved ?? ABSENT;
}

/**
 * Put back what {@link hold} changed.
 * @param {object} target - The object.
 * @param {string} key - The property.
 * @param {PropertyDescriptor|symbol} saved - What {@link hold} returned.
 * @returns {void}
 * @private
 */
function release(target, key, saved) {
	if (saved === UNCHANGED) return;
	if (saved === ABSENT) Reflect.deleteProperty(target, key);
	else if ("value" in saved && saved.writable && saved.configurable) target[key] = saved.value;
	else Objects.defineProperty(target, key, saved);
}

/**
 * Whether the engine calls a formatter set as `Error.prepareStackTrace` (V8): there a stack the formatter did not
 * make is never taken as text. Settled once, when slothlet loads, before any module's code runs.
 * @type {boolean}
 * @private
 */
const HAS_FORMATTER_HOOK = (() => {
	const probe = new RealmError();
	let called = false;
	const saved = Objects.getOwnPropertyDescriptor(RealmError, "prepareStackTrace");
	Objects.defineProperty(RealmError, "prepareStackTrace", {
		value: () => {
			called = true;
			return "";
		},
		writable: true,
		enumerable: false,
		configurable: true
	});
	try {
		if (STACK_GETTER) Reflect.apply(STACK_GETTER, probe, []);
		else Objects.getOwnPropertyDescriptor(probe, "stack");
	} finally {
		if (saved) Objects.defineProperty(RealmError, "prepareStackTrace", saved);
		else Reflect.deleteProperty(RealmError, "prepareStackTrace");
	}
	return called;
})();

/**
 * The error {@link readStack} is reading, and what its formatter made of it.
 * @private
 */
let reading = null;
let formatted = null;
let formatter = null;

/**
 * The formatter {@link readStack} sets: it formats only the error being read, with the format given for it.
 * @param {Error} error - The error being formatted.
 * @param {Array<object>} sites - The engine's call sites, innermost first.
 * @returns {unknown} The formatted stack.
 * @private
 */
function readingFormatter(error, sites) {
	if (error !== reading || formatter === null) return undefined;
	const format = formatter;
	formatter = null;
	formatted = { value: format(error, sites) };
	return formatted.value;
}

/**
 * Read a stack with slothlet's own formatter.
 * @param {function(Error, Array<object>): unknown} format - Makes the result from the error and its call sites.
 * @param {object} [options] - Options.
 * @param {number} [options.limit] - The most frames to capture; the budget is left alone when not given.
 * @param {Error} [options.error] - An error whose stack is still unread, to read instead of a new one.
 * @param {Function} [options.skip] - Capture from below this function's frame (`Error.captureStackTrace`).
 * @returns {{value: unknown}|{text: string}|null} The formatted result (`value`); on an engine without a formatter hook,
 *   the stack as text (`text`); null when the read cannot be trusted.
 * @internal
 */
export function readStack(format, { limit, error, skip } = {}) {
	reads++;
	let limitSaved = UNCHANGED;
	let prepareSaved = UNCHANGED;
	let globalSaved = UNCHANGED;
	const previous = { reading, formatted, formatter };
	try {
		try {
			if (limit !== undefined) limitSaved = hold(RealmError, "stackTraceLimit", limit);
			prepareSaved = hold(RealmError, "prepareStackTrace", readingFormatter);
			globalSaved = hold(GLOBAL, "Error", RealmError);
		} catch {
			// A property fixed in place with another value: the stack slothlet would read is not the engine's.
			return null;
		}
		const target = error ?? new RealmError();
		if (skip) Errors.captureStackTrace(target, skip);
		reading = target;
		formatted = null;
		formatter = format;
		const stack = STACK_GETTER ? Reflect.apply(STACK_GETTER, target, []) : Objects.getOwnPropertyDescriptor(target, "stack")?.value;
		if (formatted !== null) return formatted.value === stack ? formatted : null;
		// The formatter did not run. On V8 that means another one did, or the error's stack was read before: nothing is
		// trusted. An engine with no formatter hook (its errors have no call-site API) formats the text itself.
		return typeof stack === "string" && !HAS_FORMATTER_HOOK ? { text: stack } : null;
	} finally {
		reading = previous.reading;
		formatted = previous.formatted;
		formatter = previous.formatter;
		release(GLOBAL, "Error", globalSaved);
		release(RealmError, "prepareStackTrace", prepareSaved);
		release(RealmError, "stackTraceLimit", limitSaved);
	}
}

/**
 * How many stacks {@link readStack} has read, for a test that checks which calls read the stack.
 * @type {number}
 * @private
 */
let reads = 0;

/**
 * How many stacks slothlet has read since it loaded.
 * @returns {number} The count.
 * @internal
 * @example
 * const before = stackReadCount();
 * api.leaf();
 * stackReadCount() - before; // the reads the call made
 */
export function stackReadCount() {
	return reads;
}

/**
 * The stack as V8 formats an error with no message, from its call sites, with each site's own `toString` (fixed on its
 * prototype): the `name` and `message` an `Error.prototype` getter might report are not read.
 * @param {Error} _error - The error.
 * @param {Array<object>} sites - The call sites, innermost first.
 * @returns {string} The stack text.
 * @internal
 */
export function stackText(_error, sites) {
	let text = "Error";
	for (const site of sites) text += "\n    at " + site.toString();
	return text;
}

/**
 * The call sites themselves, for a reader that walks them.
 * @param {Error} _error - The error.
 * @param {Array<object>} sites - The call sites, innermost first.
 * @returns {Array<object>} The call sites.
 * @internal
 */
export function stackSites(_error, sites) {
	return sites;
}
