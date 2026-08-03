/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/caller-pinning.mjs
 *	@Date: 2026-07-30 12:00:00 -07:00 (1785438000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-30 12:00:00 -07:00 (1785438000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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
export function setApiCallerPinner(strategy) {
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
