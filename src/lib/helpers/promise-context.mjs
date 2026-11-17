/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/promise-context.mjs
 *	@Date: 2026-10-09T18:00:00-07:00 (1791594000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T13:35:21-08:00 (1794951321)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Carries the registering module's caller identity across promise reactions.
 * @module @cldmv/slothlet/helpers/promise-context
 * @internal
 *
 * @description
 * `fetch(url).then((r) => self.cache.put(r))` is ordinary module code, and when nothing awaits the
 * chain the reaction runs after the call that registered it has returned. Under the async runtime
 * AsyncLocalStorage carries the store into the reaction. The live runtime keeps identity in a field
 * that unwinds with the call, so a reaction ran with whatever identity happened to be ambient — with
 * one other call suspended, that call's (#595).
 *
 * The patch pins both reaction callbacks of `Promise.prototype.then` to the caller active when the
 * reaction is registered, which is the only moment the information exists. `catch` and `finally`
 * register their reactions through `then` (the spec has them invoke the promise's own `then`), so they
 * are covered by the same patch. `await` is not affected: on a native promise it reacts through the
 * engine's internal operation, not through the `then` property, so an awaiting call keeps its own
 * identity the way it always has.
 *
 * Slothlet's own reactions that maintain identity bookkeeping (restoring the shared fields when a call
 * settles) must not run inside a pinned context, so they go through {@link nativeThen} instead.
 *
 * Like the other boundary patches this keeps cooperative code correctly attributed; it is not a
 * sandbox. See `docs/PERMISSIONS.md` on what the live runtime does and does not bound.
 */

import { pinManyToCurrentCaller } from "#helpers/caller-pinning";
import { inheritsFrom } from "#helpers/platform";
import { openLayer, closeLayer, holdsValue, markLayer } from "#helpers/boundary-patch-layers";
import {
	FunctionMethods,
	Objects,
	Promise,
	Promises,
	PrototypeFunctions,
	Symbols,
	TypeError,
	WeakSet,
	WeakSetMethods
} from "#helpers/intrinsics";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "#helpers/instance-imports";

/**
 * Where a patched `then` keeps the function it replaced. Registered globally so a second copy of
 * slothlet in the same realm still finds the engine's own `then` underneath the first copy's patch.
 * @type {symbol}
 * @private
 */
const ORIGINAL_THEN = Symbols.for("slothlet.promise.originalThen");

/**
 * Follow patched `then` functions down to the one they replaced.
 * @param {Function} then - A `then` implementation.
 * @returns {Function} The innermost, unpatched implementation.
 * @private
 */
function runtime_unwrapThen(then) {
	let current = then;
	while (typeof current?.[ORIGINAL_THEN] === "function") current = current[ORIGINAL_THEN];
	return current;
}

/**
 * The engine's `Promise.prototype.then`, captured at load.
 * @type {Function}
 * @private
 */
const NATIVE_THEN = runtime_unwrapThen(PrototypeFunctions.Promise.then);

/**
 * Register reactions on a promise without pinning them to the current caller.
 *
 * For framework reactions that restore or inspect identity state themselves. A pinned reaction runs
 * inside a re-entered context, which would put back the state it was trying to change.
 *
 * @param {Promise<*>} promise - A promise, or a Proxy around one.
 * @param {Function} [onFulfilled] - Fulfillment reaction.
 * @param {Function} [onRejected] - Rejection reaction.
 * @returns {Promise<*>} The derived promise, as `then` returns it.
 * @internal
 */
export function nativeThen(promise, onFulfilled, onRejected) {
	try {
		return FunctionMethods.call(NATIVE_THEN, promise, onFulfilled, onRejected);
	} catch (error) {
		// A Proxy around a promise (a wrapped return value) passes `instanceof Promise` but has no
		// promise internals, so the engine's `then` refuses it as a receiver. Adopt it into a genuine
		// promise — which reads its `then` through the proxy — and react to that one instead. Anything
		// else the engine refused is not a promise (a plain object only tagged "Promise", which the
		// browser's tag check cannot tell apart), so the refusal stands and the caller keeps the value.
		if (!inheritsFrom(error, TypeError) || !inheritsFrom(promise, Promise)) throw error;
		return FunctionMethods.call(NATIVE_THEN, Promises.resolve(promise), onFulfilled, onRejected);
	}
}

/**
 * Register reactions on a promise of the engine's own as its `then` would while this copy's patch is installed: through
 * this copy's wrapper, which pins them to the current caller (see {@link enablePromisePatching}), or the engine's `then`
 * when no patch is installed. Neither is read off the promise or `Promise.prototype`, so a `then` module code put there
 * is never called.
 *
 * @param {Promise<*>} promise - A promise of the engine's own (not a Proxy).
 * @param {Function} [onFulfilled] - Fulfillment reaction.
 * @param {Function} [onRejected] - Rejection reaction.
 * @returns {Promise<*>} The derived promise, as `then` returns it.
 * @internal
 * @example
 * pinnedThen(promise, (value) => value, (error) => { throw error; });
 */
export function pinnedThen(promise, onFulfilled, onRejected) {
	return FunctionMethods.call(installed === null ? NATIVE_THEN : installed.wrapper, promise, onFulfilled, onRejected);
}

/**
 * The `then` wrappers this copy installed, so a `then` read off a promise can be told to be the engine's own under
 * the patch rather than code of a module's.
 * @type {WeakSet<Function>}
 * @private
 */
const THEN_WRAPPERS = new WeakSet();

/**
 * The engine's `Promise.prototype.then` a function stands for: the engine's itself, or a wrapper of this copy's
 * installed over it (see {@link enablePromisePatching}). Anything else, a module's own `then` among them, is null.
 * @param {*} fn - A function read as a promise's `then`.
 * @returns {Function|null} The engine's `then`, or null.
 * @internal
 * @example
 * engineThenOf(Promise.prototype.then) === engineThenOf(Promise.resolve().then); // true
 */
export function engineThenOf(fn) {
	if (fn === NATIVE_THEN) return NATIVE_THEN;
	return WeakSetMethods.has(THEN_WRAPPERS, fn) ? NATIVE_THEN : null;
}

/**
 * The patch currently installed, with what {@link disablePromisePatching} needs to restore.
 * @type {{layer: {active: boolean, below: PropertyDescriptor}, wrapper: Function}|null}
 * @private
 */
let installed = null;

/**
 * Identify a `then` descriptor's layer by its function.
 * @param {PropertyDescriptor|undefined} descriptor - A `then` descriptor.
 * @returns {*} Its value.
 * @private
 */
const runtime_descriptorValue = (descriptor) => descriptor?.value;

/**
 * Pin promise reactions to the module that registers them.
 *
 * Called once globally when the first instance is created; later calls are ignored, matching the other
 * boundary patches. Costs one check per registration when no runtime registered a pinning strategy —
 * the reactions are handed straight through.
 *
 * @returns {void}
 * @public
 */
function enablePromisePatching() {
	if (installed) return;
	const descriptor = Objects.getOwnPropertyDescriptor(Promise.prototype, "then");
	// A host that froze or replaced `then` with something exotic keeps it as it is: this patch is
	// best-effort like the others, not a requirement.
	if (!descriptor || typeof descriptor.value !== "function" || !descriptor.configurable) return;
	// Shared with any other copy of slothlet in the realm: wraps what is live, looking through a copy's
	// wrapper that has been disabled but could not be removed.
	const layer = openLayer(descriptor, runtime_descriptorValue);
	const original = layer.below.value;

	// Method syntax gives the wrapper the name `then` and no `prototype`, like the built-in.
	const wrapper = {
		then(onFulfilled, onRejected) {
			// Disabled while another copy's wrapper sat on top of this one: a plain pass-through.
			if (!layer.active) return FunctionMethods.call(original, this, onFulfilled, onRejected);
			// Both reactions were registered by the same caller: resolved once for the pair.
			const unpacked1 = pinManyToCurrentCaller([onFulfilled, onRejected]),
				fulfilled = unpacked1[0],
				rejected = unpacked1[1];
			return FunctionMethods.call(original, this, fulfilled, rejected);
		}
	}.then;
	Objects.defineProperty(wrapper, ORIGINAL_THEN, { __proto__: null, value: original });
	WeakSetMethods.add(THEN_WRAPPERS, wrapper);
	markLayer(wrapper, layer);

	Objects.defineProperty(Promise.prototype, "then", { __proto__: null, ...descriptor, value: wrapper });
	installed = { layer, wrapper };
}

/**
 * Restore the original `Promise.prototype.then`.
 *
 * Restores it only when the wrapper installed here is still in place, so anything that replaced it
 * afterwards keeps ownership of its own restore. Otherwise the wrapper is left where it is, passing
 * through. A restore puts back what is underneath every such wrapper, so copies of slothlet that
 * unpatch out of order still end with the engine's `then` installed.
 *
 * @returns {void}
 * @public
 */
function disablePromisePatching() {
	if (!installed) return;
	const restore = closeLayer(installed.layer, runtime_descriptorValue);
	if (holdsValue(Promise.prototype, "then", installed.wrapper)) Objects.defineProperty(Promise.prototype, "then", restore);
	installed = null;
}

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (!mayTakeInternals(consumer, ["slothlet"])) throw ownBindingsRefusal("lib/helpers/promise-context", import.meta.url);
	return { disablePromisePatching, enablePromisePatching };
}

/**
 * The files of slothlet's own that took this file's bindings (see {@link internals}). A `var` with no initializer, so a
 * file can take them before this file's top level has run (a cycle of slothlet's own files), and that run does not reset
 * what was taken.
 * @type {object|undefined}
 * @private
 */
var internalsTaken;

/**
 * Whether a file may take this file's bindings: it is one of those listed, and has not taken them yet. Reads no import
 * and no built-in a module can replace, so it answers the same before this file's imports are ready and after.
 * @param {string} consumer - The file asking.
 * @param {string[]} consumers - The files that take them.
 * @returns {boolean} True, once, for each file listed.
 * @private
 */
function mayTakeInternals(consumer, consumers) {
	if (internalsTaken === undefined) internalsTaken = { __proto__: null };
	let listed = false;
	for (let i = 0; i < consumers.length; i++) if (consumers[i] === consumer) listed = true;
	if (!listed || typeof consumer !== "string") return false;
	// Taken already: only a second evaluation of that very file, at its own top level, takes them again.
	if (internalsTaken[consumer] === true) return isOwnTopLevelOf(consumer);
	internalsTaken[consumer] = true;
	return true;
}

// The exports below answer slothlet's own files and the host only (see `guardInternal` in `helpers/instance-imports`).
/** @type {typeof enablePromisePatching} */
const guarded_enablePromisePatching = guardInternal(enablePromisePatching, "enablePromisePatching", import.meta.url);
/** @type {typeof disablePromisePatching} */
const guarded_disablePromisePatching = guardInternal(disablePromisePatching, "disablePromisePatching", import.meta.url);
export { guarded_enablePromisePatching as enablePromisePatching, guarded_disablePromisePatching as disablePromisePatching };
