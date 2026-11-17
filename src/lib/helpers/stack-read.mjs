/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/stack-read.mjs
 *	@Date: 2026-11-14T11:50:46-08:00 (1794685846)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:16:14-08:00 (1794874574)
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
 * On Node the stack is read from a realm of slothlet's own (a `vm` context made when slothlet loads, which no module
 * code is handed): an error made by that realm's `Error` is formatted by that realm's `prepareStackTrace` and captured
 * with that realm's `stackTraceLimit`, whatever the global `Error` of the process holds. Its `prepareStackTrace` is
 * fixed to slothlet's formatter when the realm is made. So a module that fixes the process's own settings in place
 * changes nothing slothlet reads. The frames are the engine's, from every realm, with every call-site method (file,
 * line, column, script hash, eval, native and async markers). Where no such realm can be made (a browser), the global
 * `Error` is held as above, and a setting fixed in place refuses the read.
 *
 * An engine without a formatter hook (Firefox, Safari) formats the stack as text. That text is read through the
 * `stack` getter as it was when slothlet loaded (or the error's own value, where the engine sets one), so a getter
 * defined later is not what is read.
 *
 * @module @cldmv/slothlet/helpers/stack-read
 * @internal
 */

import { Error, Errors, FunctionMethods, Objects, Processes, Reflect, Symbol } from "#helpers/intrinsics";

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
 * The `stack` getter V8 puts on each error of the global realm, as it was when slothlet loaded; undefined elsewhere.
 * @type {Function|undefined}
 * @private
 */
const OWN_STACK_GETTER = Objects.getOwnPropertyDescriptor(new RealmError(), "stack")?.get;

/**
 * The `stack` setter V8 puts on each error of the global realm, as it was when slothlet loaded; undefined elsewhere.
 * @type {Function|undefined}
 * @private
 */
const OWN_STACK_SETTER = Objects.getOwnPropertyDescriptor(new RealmError(), "stack")?.set;

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
	Objects.defineProperty(target, key, {
		__proto__: null,
		value,
		writable: true,
		enumerable: saved?.enumerable ?? false,
		configurable: true
	});
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
		__proto__: null,
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
let budget;

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
 * Node's `vm.createContext` and the option that makes a context with an ordinary global object, as they were when
 * slothlet loaded; null where there is no `vm` (a browser) or no such option.
 * @type {{createContext: Function, plain: symbol}|null}
 * @private
 */
const VM = (() => {
	const getBuiltinModule = Processes.getBuiltinModule;
	if (typeof getBuiltinModule !== "function") return null;
	const vm = getBuiltinModule("node:vm");
	const createContext = vm?.createContext;
	const plain = vm?.constants?.DONT_CONTEXTIFY;
	return typeof createContext === "function" && plain !== undefined ? { createContext, plain } : null;
})();

/**
 * Make a realm of slothlet's own to read stacks from (see the module description): a `vm` context with an ordinary
 * global object, whose `Error` binding and `Error.prepareStackTrace` (slothlet's formatter) are fixed in place. Kept
 * only when its formatter is handed the engine's call sites.
 * @returns {{Error: ErrorConstructor, stackGetter: Function|null, captureStackTrace: Function}|null} The realm, or null
 *   when none can be made.
 * @private
 */
function makeRealm() {
	if (VM === null) return null;
	try {
		const global = Reflect.apply(VM.createContext, null, [VM.plain]);
		const OwnError = global.Error;
		if (typeof OwnError !== "function" || OwnError === RealmError) return null;
		Objects.defineProperty(global, "Error", { __proto__: null, value: OwnError, writable: false, enumerable: false, configurable: false });
		Objects.defineProperty(OwnError, "prepareStackTrace", {
			__proto__: null,
			value: readingFormatter,
			writable: false,
			enumerable: false,
			configurable: false
		});
		Objects.defineProperty(OwnError, "stackTraceLimit", {
			__proto__: null,
			value: 10,
			writable: true,
			enumerable: true,
			configurable: true
		});
		const realm = {
			Error: OwnError,
			stackGetter: Objects.getOwnPropertyDescriptor(new OwnError(), "stack")?.get ?? null,
			captureStackTrace: OwnError.captureStackTrace
		};
		const probe = readPrivate(realm, (_error, sites) => typeof sites?.[0]?.getScriptHash === "function", { limit: 1 });
		return probe?.value === true ? realm : null;
	} catch {
		return null;
	}
}

/**
 * The realm of slothlet's own the stack is read from (see {@link makeRealm}); null where none can be made, and the
 * global `Error` is read instead. Its call sites reach its globals, so code handed them could fix its frame budget in
 * place: a read that finds it so makes a new realm.
 * @type {{Error: ErrorConstructor, stackGetter: Function|null, captureStackTrace: Function}|null}
 * @private
 */
let PRIVATE = makeRealm();

/**
 * Read a stack with slothlet's own formatter.
 * @param {function(Error, Array<object>): unknown} format - Makes the result from the error and its call sites.
 * @param {object} [options] - Options.
 * @param {number} [options.limit] - The most frames to capture; when not given, the budget of the realm read from is
 *   left alone (the engine's default of 10 in slothlet's own realm).
 * @param {Error} [options.error] - An error whose stack is still unread, to read instead of a new one. One made by
 *   {@link unreadError} is read from slothlet's own realm; any other is formatted through the global `Error` of the
 *   realm that made it.
 * @param {Function} [options.skip] - Capture from below this function's frame (`Error.captureStackTrace`).
 * @returns {{value: unknown}|{text: string}|null} The formatted result (`value`); on an engine without a formatter hook,
 *   the stack as text (`text`); null when the read cannot be trusted.
 * @internal
 */
export function readStack(format, { limit, error, skip } = {}) {
	reads++;
	if (PRIVATE === null || (error !== undefined && !ownRealmError(error))) return readGlobal(format, { limit, error, skip });
	const read = readPrivate(PRIVATE, format, { limit, error, skip });
	if (read !== null || error !== undefined || !budgetFixed(PRIVATE)) return read;
	// The realm's frame budget was fixed in place: a new realm reads the stack instead.
	PRIVATE = makeRealm() ?? PRIVATE;
	return readPrivate(PRIVATE, format, { limit, error, skip });
}

/**
 * Whether an error was made by a realm of slothlet's own ({@link unreadError}): its `stack` is that realm's getter.
 * @param {object} error - The error.
 * @returns {boolean} True when it was.
 * @private
 */
function ownRealmError(error) {
	const get = Objects.getOwnPropertyDescriptor(error, "stack")?.get;
	return get !== undefined && get === PRIVATE?.stackGetter;
}

/**
 * Whether a realm's frame budget is fixed in place, so it cannot be held for a read.
 * @param {{Error: ErrorConstructor}} realm - The realm.
 * @returns {boolean} True when it is.
 * @private
 */
function budgetFixed(realm) {
	const own = Objects.getOwnPropertyDescriptor(realm.Error, "stackTraceLimit");
	return own !== undefined && !own.configurable && !own.writable;
}

/**
 * Read a stack from a realm of slothlet's own (see {@link PRIVATE}): its `prepareStackTrace` is slothlet's formatter,
 * fixed in place, and only its frame budget is held for the read.
 * @param {{Error: ErrorConstructor, stackGetter: Function|null, captureStackTrace: Function}} realm - The realm.
 * @param {function(Error, Array<object>): unknown} format - Makes the result from the error and its call sites.
 * @param {{limit?: number, error?: Error, skip?: Function}} options - What {@link readStack} takes.
 * @returns {{value: unknown}|null} The formatted result, or null when the read cannot be trusted.
 * @private
 */
function readPrivate(realm, format, { limit, error, skip }) {
	let limitSaved = UNCHANGED;
	const previous = { reading, formatted, formatter, budget };
	try {
		try {
			if (limit !== undefined) limitSaved = hold(realm.Error, "stackTraceLimit", limit);
		} catch {
			return null;
		}
		budget = Objects.getOwnPropertyDescriptor(realm.Error, "stackTraceLimit")?.value;
		const target = error ?? new realm.Error();
		if (skip) Reflect.apply(realm.captureStackTrace, realm.Error, [target, skip]);
		reading = target;
		formatted = null;
		formatter = format;
		const stack = realm.stackGetter
			? Reflect.apply(realm.stackGetter, target, [])
			: Objects.getOwnPropertyDescriptor(target, "stack")?.value;
		return formatted !== null && formatted.value === stack ? formatted : null;
	} finally {
		reading = previous.reading;
		formatted = previous.formatted;
		formatter = previous.formatter;
		budget = previous.budget;
		release(realm.Error, "stackTraceLimit", limitSaved);
	}
}

/**
 * Read a stack through the global `Error` (where slothlet has no realm of its own, or for an error the global realm
 * made): the global `Error`, `prepareStackTrace` and `stackTraceLimit` are held as plain values for the read.
 * @param {function(Error, Array<object>): unknown} format - Makes the result from the error and its call sites.
 * @param {{limit?: number, error?: Error, skip?: Function}} options - What {@link readStack} takes.
 * @returns {{value: unknown}|{text: string}|null} What {@link readStack} returns.
 * @private
 */
function readGlobal(format, { limit, error, skip }) {
	let limitSaved = UNCHANGED;
	let prepareSaved = UNCHANGED;
	let globalSaved = UNCHANGED;
	const previous = { reading, formatted, formatter, budget };
	try {
		try {
			if (limit !== undefined) limitSaved = hold(RealmError, "stackTraceLimit", limit);
			prepareSaved = hold(RealmError, "prepareStackTrace", readingFormatter);
			globalSaved = hold(GLOBAL, "Error", RealmError);
		} catch {
			// A property fixed in place with another value: the stack slothlet would read is not the engine's.
			return null;
		}
		budget = Objects.getOwnPropertyDescriptor(RealmError, "stackTraceLimit")?.value;
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
		budget = previous.budget;
		release(GLOBAL, "Error", globalSaved);
		release(RealmError, "prepareStackTrace", prepareSaved);
		release(RealmError, "stackTraceLimit", limitSaved);
	}
}

/**
 * The frame budget of the read in progress: what a formatter compares its call sites' count with to tell whether the
 * capture was cut short.
 * @returns {number|undefined} The budget, or undefined outside a read.
 * @internal
 * @example
 * readStack((_error, sites) => sites.length >= stackBudget(), { limit: 48 }); // { value: true } when cut short
 */
export function stackBudget() {
	return budget;
}

/**
 * An error whose stack is not read yet, captured now with a frame budget, to read later with {@link readStack} (`error`).
 * Made by slothlet's own realm where there is one, so neither the capture nor the later read depends on the global
 * `Error` and its settings.
 * @param {number} limit - The most frames to capture.
 * @returns {Error|null} The error, or null when the budget cannot be held for the capture.
 * @internal
 */
export function unreadError(limit) {
	if (PRIVATE !== null && budgetFixed(PRIVATE)) PRIVATE = makeRealm() ?? PRIVATE;
	const OwnError = PRIVATE?.Error ?? RealmError;
	let saved;
	try {
		saved = hold(OwnError, "stackTraceLimit", limit);
	} catch {
		return null;
	}
	try {
		return new OwnError();
	} finally {
		release(OwnError, "stackTraceLimit", saved);
	}
}

/**
 * Whether an error's `stack` is still the engine's own getter, unread: of the global realm's errors or of slothlet's
 * own realm's (see {@link unreadError}).
 * @param {unknown} error - The error.
 * @returns {boolean} True when it is.
 * @internal
 */
export function hasEngineStack(error) {
	if (error === null || (typeof error !== "object" && typeof error !== "function")) return false;
	const get = Objects.getOwnPropertyDescriptor(error, "stack")?.get;
	return get !== undefined && (get === OWN_STACK_GETTER || get === PRIVATE?.stackGetter);
}

/**
 * Whether a function is the `stack` getter or setter the engine gives the errors of this realm, as it was when
 * slothlet loaded: the getter runs no code of a module's but the realm's `Error.prepareStackTrace`, which
 * {@link runUnformatted} holds, and the setter stores a value.
 * @param {unknown} half - A getter or setter.
 * @returns {boolean} True when it is.
 * @internal
 */
export function isEngineStackAccessor(half) {
	return typeof half === "function" && (half === OWN_STACK_GETTER || half === STACK_GETTER || half === OWN_STACK_SETTER);
}

/**
 * Thrown by the formatter {@link runUnformatted} holds when the engine asks it to format a stack.
 * @type {symbol}
 * @private
 */
const UNFORMATTED = Symbol("unformatted stack");

/**
 * The formatter {@link runUnformatted} holds: it formats nothing. The engine keeps a stack it could not format
 * unformatted, so the next read formats it as it would have been.
 * @returns {never}
 * @throws {symbol} Always, {@link UNFORMATTED}.
 * @private
 */
function refuseFormat() {
	throw UNFORMATTED;
}

/**
 * Run `run` with the global `Error` and its `prepareStackTrace` held so that reading the stack of an error of this realm
 * not read yet formats nothing and runs none of a module's code: the read throws instead, and the stack is left as it
 * was.
 * @param {Function} run - What to run.
 * @returns {{held: false}|{held: true, value: unknown}|{held: true, error: unknown, unformatted: boolean}} Whether the
 *   formatter could be held, and what `run` returned or threw; `unformatted` when it threw because a stack was read.
 * @internal
 */
export function runUnformatted(run) {
	let prepareSaved = UNCHANGED;
	let globalSaved = UNCHANGED;
	try {
		try {
			prepareSaved = hold(RealmError, "prepareStackTrace", refuseFormat);
			globalSaved = hold(GLOBAL, "Error", RealmError);
		} catch {
			return { held: false };
		}
		try {
			return { held: true, value: run() };
		} catch (error) {
			return { held: true, error, unformatted: error === UNFORMATTED };
		}
	} finally {
		release(GLOBAL, "Error", globalSaved);
		release(RealmError, "prepareStackTrace", prepareSaved);
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
	// The site's `toString` is fixed on V8's call-site prototype; it is called through the `call` taken at load.
	for (let i = 0; i < sites.length; i++) text += "\n    at " + FunctionMethods.call(sites[i].toString, sites[i]);
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
