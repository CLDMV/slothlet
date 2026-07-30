/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/scheduler-context.mjs
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
 * @fileoverview Carries the scheduling module's caller identity across timer and microtask boundaries.
 * @module @cldmv/slothlet/helpers/scheduler-context
 * @internal
 *
 * @description
 * `setTimeout(() => self.db.write())` is ordinary module code, but the callback runs after the call
 * that scheduled it has returned. Under the async runtime AsyncLocalStorage carries the store across
 * that gap, so the callback resumes as the module that wrote it. The live runtime keeps identity in a
 * single field that unwinds with the call, and enforcement reads an absent caller as host-initiated
 * and therefore exempt — so a leaf's deferred work ran with authority the leaf itself did not have.
 *
 * These patches capture the caller at scheduling time and restore it when the callback runs, which is
 * the only moment the information exists. The wrappers are transparent otherwise: the original return
 * value is passed straight back (so `clearTimeout`/`clearInterval` keep working on the handle callers
 * already hold), trailing arguments are forwarded, non-function callbacks go through untouched, and
 * the patch is a no-op when no runtime has registered a pinning strategy.
 *
 * This closes the boundary for cooperative code. It is not a sandbox: a module can hold its own
 * reference to an unpatched scheduler, or reach one through another realm. See `docs/PERMISSIONS.md`
 * on what the live runtime does and does not bound.
 */

import { pinToCurrentCaller } from "@cldmv/slothlet/helpers/caller-pinning";

/**
 * Patched scheduler entry points, keyed by the wrapper installed for each.
 *
 * Holds the host object, the property name, and the function that was there before, so
 * {@link disableSchedulerPatching} can restore only what it actually replaced.
 *
 * @type {Array<{host: object, name: string, original: Function, wrapper: Function}>}
 * @private
 */
const patched = [];

/**
 * Whether the scheduler entry points are currently patched.
 * @type {boolean}
 * @private
 */
let isPatchingEnabled = false;

/**
 * Copy a scheduler's own extras onto its wrapper.
 *
 * Node hangs promisify support off `setTimeout`/`setImmediate` as a well-known symbol, and callers
 * reach it through the global they were given. A wrapper that dropped it would break
 * `util.promisify(setTimeout)` for everything in the process, so carry every own symbol and every own
 * enumerable string key across. `length`, `name`, and `prototype` are deliberately left alone — they
 * belong to the wrapper.
 *
 * @param {Function} wrapper - Replacement function.
 * @param {Function} original - Function being replaced.
 * @returns {void}
 * @private
 */
function runtime_carryOwnExtras(wrapper, original) {
	for (const key of Object.getOwnPropertySymbols(original)) {
		const descriptor = Object.getOwnPropertyDescriptor(original, key);
		/* v8 ignore next -- a symbol from getOwnPropertySymbols always has a descriptor; belt-and-braces so a host with an exotic global can't throw here. */
		if (!descriptor) continue;
		Object.defineProperty(wrapper, key, descriptor);
	}
	for (const key of Object.keys(original)) {
		wrapper[key] = original[key];
	}
}

/**
 * Replace one scheduler entry point with a wrapper that pins its callback.
 *
 * @param {object} host - Object carrying the entry point (`globalThis` or `process`).
 * @param {string} name - Property name to patch.
 * @returns {void}
 * @private
 */
function runtime_patchScheduler(host, name) {
	const original = host?.[name];
	// Absent or non-callable in this host: `setImmediate` and `process.nextTick` are Node-only, and a
	// browser reaches here with neither. Exercised by the vitest browser compose.
	if (typeof original !== "function") return;

	const wrapper = function (callback, ...rest) {
		// Non-function callbacks (legacy string-of-code timers) have no identity to carry.
		if (typeof callback !== "function") return original.call(host, callback, ...rest);
		return original.call(host, pinToCurrentCaller(callback), ...rest);
	};

	runtime_carryOwnExtras(wrapper, original);
	host[name] = wrapper;
	patched.push({ host, name, original, wrapper });
}

/**
 * Pin deferred callbacks to the module that schedules them.
 *
 * Called once globally when the first instance is created; later calls are ignored, matching how
 * EventEmitter patching behaves. Costs nothing when no runtime registered a pinning strategy — the
 * wrapper hands the callback straight through.
 *
 * @returns {void}
 * @public
 */
export function enableSchedulerPatching() {
	if (isPatchingEnabled) return;

	runtime_patchScheduler(globalThis, "setTimeout");
	runtime_patchScheduler(globalThis, "setInterval");
	runtime_patchScheduler(globalThis, "setImmediate");
	runtime_patchScheduler(globalThis, "queueMicrotask");
	runtime_patchScheduler(globalThis.process, "nextTick");

	isPatchingEnabled = true;
}

/**
 * Restore the original scheduler entry points.
 *
 * Restores an entry point only when the wrapper installed here is still the one in place. Anything
 * that replaced a scheduler afterwards — a test runner's fake timers being the usual case — owns that
 * slot and its own restore, and writing over it would strand the process on a stale function.
 *
 * @returns {void}
 * @public
 */
export function disableSchedulerPatching() {
	if (!isPatchingEnabled) return;

	for (const { host, name, original, wrapper } of patched) {
		if (host[name] === wrapper) host[name] = original;
	}

	patched.length = 0;
	isPatchingEnabled = false;
}
