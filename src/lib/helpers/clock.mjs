/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/clock.mjs
 *	@Date: 2026-11-14T10:20:00-08:00 (1794680400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T10:20:00-08:00 (1794680400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The clock an instance reads the time and schedules its deferred work with.
 *
 * @description
 * slothlet reads the time and the timers from the copies taken when it loaded (`helpers/intrinsics`), so a module
 * that replaces `Date.now` or `setTimeout` afterwards cannot move them. A host that wants control of time for an
 * instance (a test faking it) hands the instance its own functions in the `clock` config option. Each instance has one
 * frozen clock, built here when the instance is created and held by the instance alone; a member the host leaves out
 * is the copy taken at load.
 *
 * @module @cldmv/slothlet/helpers/clock
 * @internal
 */
import {
	Objects,
	Arrays,
	Dates,
	setTimeout as loadedSetTimeout,
	clearTimeout as loadedClearTimeout
} from "@cldmv/slothlet/helpers/intrinsics";

/**
 * The clock of an instance.
 * @typedef {object} Clock
 * @property {function(): number} now - The current time in milliseconds.
 * @property {function(function(...unknown): void, number=, ...unknown): unknown} setTimeout - Schedule a callback.
 * @property {function(unknown): void} clearTimeout - Cancel a timer `setTimeout` made.
 * @property {boolean} hostTimers - Whether the host supplied `setTimeout`: slothlet's deferred work then runs on it.
 * @internal
 */

/**
 * Wrap a timer function so it is called detached, as a browser requires of `setTimeout`.
 * @param {Function} fn - The scheduler.
 * @returns {Function} A function that calls it with no receiver.
 * @private
 */
function detached(fn) {
	return (...args) => fn(...args);
}

/**
 * The clock of an instance whose host gave none: the functions slothlet loaded with.
 * @type {Clock}
 * @internal
 * @example
 * DEFAULT_CLOCK.now(); // the same as Date.now() when slothlet loaded
 */
export const DEFAULT_CLOCK = Objects.freeze({
	now: Dates.now,
	setTimeout: detached(loadedSetTimeout),
	clearTimeout: detached(loadedClearTimeout),
	hostTimers: false
});

/**
 * The clock of an instance: its own when it has one, the default otherwise. Anything that is not a real instance (a
 * test's stand-in) has none.
 * @param {{clock?: Clock}|null|undefined} slothlet - The instance.
 * @returns {Clock} Its clock.
 * @internal
 * @example
 * clockOf(slothlet).now();
 */
export function clockOf(slothlet) {
	return slothlet?.clock ?? DEFAULT_CLOCK;
}

/**
 * Build an instance's clock from the host's `clock` option.
 * @param {{now?: Function, setTimeout?: Function, clearTimeout?: Function}|undefined} option - The option as the host
 *   gave it; absent means the default clock.
 * @returns {Clock|null} The clock, or `null` when the option is not an object whose given members are functions.
 * @internal
 * @example
 * const clock = createClock({ now: () => 1000 });
 * clock.now(); // 1000
 */
export function createClock(option) {
	if (option === undefined) return DEFAULT_CLOCK;
	if (option === null || typeof option !== "object" || Arrays.isArray(option)) return null;
	const { now, setTimeout, clearTimeout } = option;
	for (const member of [now, setTimeout, clearTimeout]) if (member !== undefined && typeof member !== "function") return null;
	return Objects.freeze({
		now: now === undefined ? DEFAULT_CLOCK.now : detached(now),
		setTimeout: setTimeout === undefined ? DEFAULT_CLOCK.setTimeout : detached(setTimeout),
		clearTimeout: clearTimeout === undefined ? DEFAULT_CLOCK.clearTimeout : detached(clearTimeout),
		hostTimers: setTimeout !== undefined
	});
}
