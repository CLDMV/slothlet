/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/scheduler-context.mjs
 *	@Date: 2026-07-30T12:00:00-07:00 (1785438000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T15:23:50-08:00 (1794957830)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
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

import { pinToCurrentCaller } from "#helpers/caller-pinning";
import { checkCapability } from "#helpers/capability-context";
import { openLayer, closeLayer, holdsValue, markLayer } from "#helpers/boundary-patch-layers";
import { concatLists, listPush, Objects, Reflect } from "#helpers/intrinsics";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "#helpers/instance-imports";

/**
 * Patched scheduler entry points, keyed by the wrapper installed for each.
 *
 * Holds the host object, the property name, the wrapper and its layer (which records the function
 * that was there before), so {@link disableSchedulerPatching} can restore only what it actually
 * replaced.
 *
 * @type {Array<{host: object, name: string, layer: {active: boolean, below: Function}, wrapper: Function}>}
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
 * `util.promisify(setTimeout)` for everything in the process, so carry every own property across by
 * descriptor — accessors stay accessors and non-enumerable keys stay non-enumerable. `length`, `name`,
 * and `prototype` are deliberately left alone — they belong to the wrapper.
 *
 * @param {Function} wrapper - Replacement function.
 * @param {Function} original - Function being replaced.
 * @returns {void}
 * @private
 */
function runtime_carryOwnExtras(wrapper, original) {
	for (let ofIndex = 0, ofList = Reflect.ownKeys(original); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		// The wrapper's own intrinsics stay its own; `prototype` in particular is what keeps `instanceof`
		// and subclassing working.
		if (key === "length" || key === "name" || key === "prototype") continue;
		const descriptor = Objects.getOwnPropertyDescriptor(original, key);
		/* v8 ignore next -- a key from Reflect.ownKeys always has a descriptor; belt-and-braces so an exotic host can't throw here. */
		if (!descriptor) continue;
		// Copied as a descriptor, not by assignment: a static accessor (`PerformanceObserver.supportedEntryTypes`)
		// stays an accessor, and a non-enumerable key stays non-enumerable.
		Objects.defineProperty(wrapper, key, descriptor);
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
	const installed = host?.[name];
	// Absent or non-callable in this host: `setImmediate` and `process.nextTick` are Node-only, and a
	// browser reaches here with neither. Exercised by the vitest browser compose.
	if (typeof installed !== "function") return;
	// Shared with any other copy of slothlet in the realm (see boundary-patch-layers).
	const layer = openLayer(installed);
	const original = layer.below;

	// A string a timer runs as code (a browser's `setTimeout("…")`) is code from a string: module code needs
	// `capability:code` for it (see helpers/capability-context).
	const runsStrings = host === globalThis && (name === "setTimeout" || name === "setInterval");
	const wrapper = function (callback, ...rest) {
		if (runsStrings && layer.active && callback != null && typeof callback !== "function") checkCapability("code", name);
		// Non-function callbacks (legacy string-of-code timers) have no identity to carry, and a wrapper
		// disabled under another copy's passes everything through.
		if (typeof callback !== "function" || !layer.active) return Reflect.apply(original.call, original, concatLists([host, callback], rest));
		return Reflect.apply(original.call, original, concatLists([host, pinToCurrentCaller(callback)], rest));
	};

	runtime_carryOwnExtras(wrapper, original);
	markLayer(wrapper, layer);
	host[name] = wrapper;
	listPush(patched, { host, name, layer, wrapper });
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
function enableSchedulerPatching() {
	if (isPatchingEnabled) return void reinstateSchedulerPatching();

	// The current globals: the patch installs over whatever the host has there now, and restores it.
	runtime_patchScheduler(globalThis, "setTimeout");
	runtime_patchScheduler(globalThis, "setInterval");
	runtime_patchScheduler(globalThis, "setImmediate");
	runtime_patchScheduler(globalThis, "queueMicrotask");
	runtime_patchScheduler(globalThis.process, "nextTick");
	runtime_patchScheduler(globalThis, "requestAnimationFrame");
	runtime_patchScheduler(globalThis, "requestIdleCallback");
	// The Prioritized Task Scheduling API: `scheduler.postTask(callback, options)`.
	runtime_patchScheduler(globalThis.scheduler, "postTask");

	isPatchingEnabled = true;
}

/**
 * Put a wrapper back where a host wrote over it with the very function the wrapper calls.
 *
 * Code that read a scheduler before slothlet patched it, swapped in a function of its own for a while and then wrote
 * back what it had read, takes the patch out for the rest of the process: callbacks scheduled from then on run unpinned,
 * outside the flow and the caller that scheduled them. vitest does this with `process.nextTick` around every message
 * its worker sends to the main process. It installs the original for the call and writes back what it found on a later
 * tick, so a wrapper installed in between is overwritten, and two calls that overlap leave the original in place for
 * good. The function written back is exactly the one under the wrapper, so it can be told from a replacement (fake
 * timers, another library's wrapper), which owns the slot and is left alone. Called where a live flow or module call
 * starts, which is where the slot has to be right: a few property reads.
 *
 * @returns {void}
 * @public
 */
function reinstateSchedulerPatching() {
	for (let i = 0; i < patched.length; i++) {
		const { host, name, layer, wrapper } = patched[i];
		if (layer.active && host[name] === layer.below && holdsValue(host, name, layer.below)) host[name] = wrapper;
	}
}

/**
 * Restore the original scheduler entry points.
 *
 * Restores an entry point only when the wrapper installed here is still the one in place. Anything
 * that replaced a scheduler afterwards — a test runner's fake timers being the usual case — owns that
 * slot and its own restore, and writing over it would strand the process on a stale function. A
 * wrapper left in place that way passes through from then on, and a restore puts back what is under
 * every such wrapper, so copies of slothlet that unpatch out of order still restore the original.
 *
 * @returns {void}
 * @public
 */
function disableSchedulerPatching() {
	if (!isPatchingEnabled) return;

	for (let ofIndex = 0, ofList = patched; ofIndex < ofList.length; ofIndex++) {
		const { host, name, layer, wrapper } = ofList[ofIndex];
		const restore = closeLayer(layer);
		if (holdsValue(host, name, wrapper)) host[name] = restore;
	}

	patched.length = 0;
	isPatchingEnabled = false;
}

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (!mayTakeInternals(consumer, ["slothlet", "lib/handlers/context-live"]))
		throw ownBindingsRefusal("lib/helpers/scheduler-context", import.meta.url);
	return { disableSchedulerPatching, enableSchedulerPatching, reinstateSchedulerPatching };
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
/** @type {typeof enableSchedulerPatching} */
const guarded_enableSchedulerPatching = guardInternal(enableSchedulerPatching, "enableSchedulerPatching", import.meta.url);
/** @type {typeof disableSchedulerPatching} */
const guarded_disableSchedulerPatching = guardInternal(disableSchedulerPatching, "disableSchedulerPatching", import.meta.url);
export { guarded_enableSchedulerPatching as enableSchedulerPatching, guarded_disableSchedulerPatching as disableSchedulerPatching };
