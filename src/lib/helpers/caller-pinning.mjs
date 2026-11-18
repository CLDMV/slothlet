/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/caller-pinning.mjs
 *	@Date: 2026-07-30T12:00:00-07:00 (1785438000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T20:34:17-08:00 (1794976457)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Shared registry for binding a deferred callback to the caller that scheduled it.
 * @module @cldmv/slothlet/helpers/caller-pinning
 * @internal
 *
 * @description
 * A callback handed to a scheduling boundary — an EventEmitter listener, a timer, a microtask —
 * runs after the call that registered it has returned. Whatever caller identity it carries must
 * therefore be captured at registration, because by the time it runs there is nothing left to
 * infer it from.
 *
 * The async runtime needs none of this: AsyncLocalStorage carries the executing store across every
 * async boundary, so a callback resumes with the identity it was created under. The live runtime
 * keeps identity in a single mutable field that unwinds when the scheduling call returns, and a
 * browser has no `async_hooks` to fall back on. A callback there had no identity at all — and an
 * absent caller is read as host-initiated and exempt, so a leaf's deferred work ran with more
 * authority than the leaf itself.
 *
 * This module holds the one hook the boundary patches consult. The live context manager registers a
 * pinner; the async manager leaves it unset and its boundaries pass callbacks through untouched.
 */
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "#helpers/instance-imports";
import { ArrayMethods, FunctionMethods, mapList } from "#helpers/intrinsics";

/**
 * Binds a callback to the caller active at registration, or `null` when the runtime does not need it.
 * Takes the callback and returns a replacement that re-enters the registering module's context.
 * @type {Function|null}
 * @private
 */
let pinner = null;

/**
 * Register the strategy for binding a callback to whoever scheduled it.
 *
 * @param {Function|null} strategy - Takes a callback and returns a replacement that re-enters the
 *   registering module's context when it runs. `null` clears the registration.
 * @returns {void}
 * @internal
 */
function setApiCallerPinner(strategy) {
	pinner = strategy;
}

/**
 * Bind a callback to the caller active right now, if the runtime supplies a way to.
 *
 * Called by each scheduling boundary at registration time. Returns the callback unchanged when no
 * pinner is registered (the async runtime) or when there is no caller to pin (the host scheduling
 * its own work), so the boundary pays nothing outside a module call.
 *
 * @param {Function} callback - Callback about to be deferred.
 * @returns {Function} The callback, bound to the current caller where one exists.
 * @internal
 */
export function pinToCurrentCaller(callback) {
	if (!pinner || typeof callback !== "function") return callback;
	return pinner(callback);
}

/**
 * Bind a callback to the caller and flow active right now, after one quick check that there is any: outside every
 * `run()` / `scope()` flow and every module call the callback is handed back as it is, as it would run the same either
 * way. For a boundary that sees many calls from host code (Node's callback-style APIs, see
 * `helpers/node-callback-context`). A strategy that offers no `idle` check pins as {@link pinToCurrentCaller} does.
 *
 * @param {Function} callback - Callback about to be deferred.
 * @returns {Function} The callback, bound to the current caller and flow where there is one.
 * @internal
 */
export function pinToCurrentFlow(callback) {
	if (!pinner || typeof callback !== "function") return callback;
	if (typeof pinner.idle === "function" && pinner.idle()) return callback;
	return pinner(callback);
}

/**
 * Bind a callback that runs code in a resource's scope (what an `AsyncResource`, a snapshot or a bound function runs
 * later) to the caller active right now. Whoever holds the resource chooses the code, so the strategy tells it by its
 * frames when it runs: the code of the caller it was pinned to keeps the pin, anyone else's runs as whatever was running
 * where the resource was used. A strategy that offers no `scope` form pins it as any callback.
 *
 * @param {Function} callback - The callback.
 * @returns {Function} The callback, bound to the current caller where one exists.
 * @internal
 */
export function pinScopeToCurrentCaller(callback) {
	if (!pinner || typeof callback !== "function") return callback;
	if (typeof pinner.scope === "function") return pinner.scope(callback);
	return pinner(callback);
}

/**
 * Bind several callbacks registered at the same moment to the caller active right now, resolving that
 * caller once for all of them — a promise reaction's two callbacks, say. A strategy that offers no
 * `many` form pins each one in turn.
 *
 * @param {Array<*>} callbacks - Callbacks about to be deferred; anything that is not a function is
 *   handed back as it is.
 * @returns {Array<*>} The callbacks, bound to the current caller where one exists.
 * @internal
 */
export function pinManyToCurrentCaller(callbacks) {
	if (!pinner || !ArrayMethods.some(callbacks, (callback) => typeof callback === "function")) return callbacks;
	if (typeof pinner.many === "function") return pinner.many(callbacks);
	return mapList(callbacks, (callback) => pinToCurrentCaller(callback));
}

/**
 * Pin the reactions registered on the promise a call returned to who made the call, when the runtime knows it (a
 * strategy's `forResult`), instead of resolving who is registering them now; otherwise as
 * {@link pinManyToCurrentCaller} pins them.
 * @param {Promise<*>} result - The promise the call returned.
 * @param {Array<Function|undefined>} callbacks - The reactions.
 * @returns {Array<Function|undefined>} Each reaction, pinned where there is a caller to pin it to.
 * @internal
 * @example
 * const [fulfilled, rejected] = pinManyForResult(result, [onFulfilled, onRejected]);
 */
export function pinManyForResult(result, callbacks) {
	if (pinner && typeof pinner.forResult === "function") {
		const pinned = pinner.forResult(result, callbacks);
		if (pinned) return pinned;
	}
	return pinManyToCurrentCaller(callbacks);
}

/**
 * Count a callback about to be deferred as work of the `run()` / `scope()` the registering code runs in, where the
 * runtime counts it this way (the live runtime; the async runtime counts it through its async hooks). The run's copy of
 * the instance lives until all such work has finished (see `holdRunWork` in `helpers/flow-stores`).
 *
 * @returns {Function|null} What releases the count, once (a second call does nothing), or null when nothing was
 *   counted: no run, or a runtime that counts some other way.
 * @internal
 */
export function holdForCurrentFlow() {
	if (!pinner || typeof pinner.hold !== "function") return null;
	return pinner.hold();
}

/**
 * A callback that releases a count {@link holdForCurrentFlow} took once it has run, for a boundary that calls its
 * callback once (a timer, a microtask, a Node callback).
 *
 * @param {Function} callback - The callback, pinned already.
 * @param {Function} release - The release.
 * @returns {Function} The callback, releasing the count after it runs, whether it returns or throws.
 * @internal
 */
export function releaseAfterCall(callback, release) {
	return function slothlet_releasedAfterCall(...args) {
		try {
			return FunctionMethods.apply(callback, this, args);
		} finally {
			release();
		}
	};
}

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (!mayTakeInternals(consumer, ["lib/handlers/context-live"])) throw ownBindingsRefusal("lib/helpers/caller-pinning", import.meta.url);
	return { setApiCallerPinner };
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
/** @type {typeof setApiCallerPinner} */
const guarded_setApiCallerPinner = guardInternal(setApiCallerPinner, "setApiCallerPinner", import.meta.url);
export { guarded_setApiCallerPinner as setApiCallerPinner };
