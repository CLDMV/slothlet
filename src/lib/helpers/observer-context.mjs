/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/observer-context.mjs
 *	@Date: 2026-09-07T22:36:15-07:00 (1788845775)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T21:05:04-08:00 (1794978304)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Carries the constructing module's caller identity into observer callback arguments.
 * @module @cldmv/slothlet/helpers/observer-context
 * @internal
 *
 * @description
 * `MutationObserver`, `ResizeObserver`, `IntersectionObserver`, `PerformanceObserver`, and
 * `ReportingObserver` all take their callback as a
 * constructor argument rather than a registered listener or an assigned property — neither the
 * `addEventListener` patch nor the `on*` property patch applies, because there is no method call or
 * property assignment to intercept, only a constructor invocation. Left unpinned, the callback runs
 * with no active identity the first time the observer actually fires, the same
 * `CONTEXT_NOT_ACTIVE_SELF` failure the other boundary patches exist to prevent.
 *
 * The fix wraps each constructor so the callback argument is pinned before it reaches the native
 * constructor. The constructed instance itself is untouched — `observe()`, `disconnect()`, and every
 * other method run exactly as the native implementation provides them; only the callback is
 * substituted. `Reflect.construct` with the caller's own `new.target` keeps subclassing and
 * `instanceof` working the same as the unpatched constructor, and omitting `new` still throws the same
 * way a native class constructor does.
 *
 * This closes the boundary for cooperative code, not a sandbox — a module can still reach an
 * unpatched constructor through another realm. See `docs/PERMISSIONS.md` on what the live runtime does
 * and does not bound.
 */

import { pinToCurrentCaller, recordOfCurrentFlow } from "#helpers/caller-pinning";
import { openLayer, closeLayer, holdsValue, markLayer } from "#helpers/boundary-patch-layers";
import { holdRunWorkOnce } from "#helpers/flow-stores";
import { concatLists, listPush, Objects, Reflect, Set, SetMethods, TypeError, WeakMap, WeakMapMethods } from "#helpers/intrinsics";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "#helpers/instance-imports";

/**
 * Observer constructors patched by name.
 * @type {string[]}
 * @private
 */
const PATCHED_CONSTRUCTORS = ["MutationObserver", "ResizeObserver", "IntersectionObserver", "PerformanceObserver", "ReportingObserver"];

/**
 * The observer methods that start and stop an observer's work (see {@link runtime_countObserving}).
 * @type {string[]}
 * @private
 */
const OBSERVER_METHODS = ["observe", "unobserve", "disconnect"];

/**
 * Patched entry points, holding what {@link disableObserverPatching} needs to restore only the
 * global it actually replaced.
 * @type {Array<{name: string, layer: {active: boolean, below: Function}, wrapper: Function}>}
 * @private
 */
const patched = [];

/**
 * Observers constructed in a `run()` / `scope()`, and the run's count of them: an observer is the run's work from its
 * first `observe()` until it is disconnected (or, where it has `unobserve()`, has nothing left to observe), so the run's
 * copy of the instance stays while its callback can still be called (see `holdRunWork` in `helpers/flow-stores`).
 * @type {WeakMap<object, {record: object, release: Function|null, targets: Set<object>|null}>}
 * @private
 */
const observing = new WeakMap();

/**
 * Whether the observer constructors are currently patched.
 * @type {boolean}
 * @private
 */
let isPatchingEnabled = false;

/**
 * Copy an original constructor's own extras onto its wrapper.
 *
 * Mirrors {@link runtime_carryOwnExtras} in `scheduler-context.mjs` — carries every own property
 * across by descriptor, so a static a consumer reaches through the constructor they were given
 * survives being wrapped exactly as declared: `PerformanceObserver.supportedEntryTypes` is a
 * non-enumerable accessor, and copying only enumerable keys left it `undefined` while patched.
 * `length`, `name`, and `prototype` are deliberately left alone; the wrapper's own `prototype` is
 * what makes `instanceof` and subclassing keep working.
 *
 * @param {Function} wrapper - Replacement constructor.
 * @param {Function} original - Constructor being replaced.
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
 * Give a wrapper's prototype its own `observe()`, `unobserve()` and `disconnect()`, each calling the method the
 * original prototype has when it is called, then counting an observer constructed in a run as the run's work while it
 * observes anything (see {@link observing}). The original prototype is untouched; an observer constructed outside every
 * run is only passed through.
 *
 * @param {object} proto - The wrapper's prototype.
 * @param {object} originalProto - The original constructor's prototype.
 * @returns {void}
 * @private
 */
function runtime_countObserving(proto, originalProto) {
	if (!originalProto || typeof originalProto.observe !== "function") return;
	const tracksTargets = typeof originalProto.unobserve === "function";
	const methods = {
		observe(target, ...rest) {
			const result = Reflect.apply(originalProto.observe, this, concatLists([target], rest));
			const state = WeakMapMethods.get(observing, this);
			if (state !== undefined) {
				if (state.release === null) state.release = holdRunWorkOnce(state.record);
				if (tracksTargets) SetMethods.add((state.targets ??= new Set()), target);
			}
			return result;
		},
		unobserve(target, ...rest) {
			const result = Reflect.apply(originalProto.unobserve, this, concatLists([target], rest));
			const state = WeakMapMethods.get(observing, this);
			if (state !== undefined && state.targets !== null) {
				SetMethods.delete(state.targets, target);
				if (SetMethods.size(state.targets) === 0) runtime_stopObserving(state);
			}
			return result;
		},
		disconnect(...args) {
			const result = Reflect.apply(originalProto.disconnect, this, args);
			const state = WeakMapMethods.get(observing, this);
			if (state !== undefined) runtime_stopObserving(state);
			return result;
		}
	};
	for (let ofIndex = 0, ofList = OBSERVER_METHODS; ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		const below = Objects.getOwnPropertyDescriptor(originalProto, key);
		if (typeof below?.value !== "function") continue;
		const method = methods[key];
		Objects.defineProperty(method, "length", { __proto__: null, value: below.value.length, configurable: true });
		Objects.defineProperty(proto, key, {
			__proto__: null,
			value: method,
			writable: below.writable,
			enumerable: below.enumerable,
			configurable: true
		});
	}
}

/**
 * An observer stopped observing: release the run's count of it, once.
 * @param {{release: Function|null, targets: Set<object>|null}} state - The observer's state.
 * @returns {void}
 * @private
 */
function runtime_stopObserving(state) {
	state.targets = null;
	const release = state.release;
	state.release = null;
	if (release !== null) release();
}

/**
 * Replace one observer constructor with a wrapper that pins its callback argument.
 *
 * @param {string} name - Global constructor name (e.g. `"MutationObserver"`).
 * @returns {void}
 * @private
 */
function runtime_patchObserverConstructor(name) {
	// The current global: the patch installs over whatever the host has there now.
	const installed = globalThis[name];
	// Absent in this host: all but `PerformanceObserver` are browser-only. Exercised by the vitest node compose.
	if (typeof installed !== "function") return;
	// Shared with any other copy of slothlet in the realm (see boundary-patch-layers).
	const layer = openLayer(installed);
	const original = layer.below;

	const wrapper = function (callback, ...rest) {
		// Native observer constructors throw when called without `new` (they're spec'd as classes);
		// `Reflect.construct` below requires a `new.target` to build against, so surface the same failure
		// the platform would rather than a confusing internal error.
		if (!new.target) throw new TypeError(`Failed to construct '${name}': Please use the 'new' operator.`);

		// A non-function callback is the platform's problem to reject, and it should see the exact error
		// it would unpatched — hand it through untouched rather than pinning nothing.
		// A wrapper disabled under another copy's passes the callback through as well.
		const pins = typeof callback === "function" && layer.active;
		const pinned = pins ? pinToCurrentCaller(callback) : callback;
		const record = pins ? recordOfCurrentFlow() : null;
		const observer = Reflect.construct(original, concatLists([pinned], rest), new.target);
		if (record !== null) WeakMapMethods.set(observing, observer, { record, release: null, targets: null });
		return observer;
	};

	// A prototype shared verbatim with `original` would leave `instance.constructor` pointing at the
	// unpatched constructor instead of the wrapper now installed as `globalThis[name]`. Link to
	// `original.prototype` (so `instanceof` still walks the real hierarchy) but give the wrapper its own
	// prototype object with `constructor` pointing back at itself.
	wrapper.prototype = Objects.create(original.prototype, {
		constructor: { __proto__: null, value: wrapper, writable: true, configurable: true }
	});
	runtime_countObserving(wrapper.prototype, original.prototype);
	runtime_carryOwnExtras(wrapper, original);
	markLayer(wrapper, layer);
	globalThis[name] = wrapper;
	listPush(patched, { name, layer, wrapper });
}

/**
 * Pin observer callbacks to the module that constructs them.
 *
 * Called once globally when the first instance is created; later calls are ignored, matching how the
 * other boundary patches behave. Costs nothing when no runtime registered a pinning strategy — the
 * wrapper hands the callback straight through.
 *
 * @returns {void}
 * @public
 */
function enableObserverPatching() {
	if (isPatchingEnabled) return;

	for (let ofIndex = 0, ofList = PATCHED_CONSTRUCTORS; ofIndex < ofList.length; ofIndex++) {
		const name = ofList[ofIndex];
		runtime_patchObserverConstructor(name);
	}

	isPatchingEnabled = true;
}

/**
 * Restore the original observer constructors.
 *
 * Restores a constructor only when the wrapper installed here is still in place, so anything that
 * replaced it afterwards keeps ownership of its own restore. A wrapper left in place passes through
 * from then on, and a restore puts back what is under every such wrapper (see boundary-patch-layers).
 *
 * @returns {void}
 * @public
 */
function disableObserverPatching() {
	if (!isPatchingEnabled) return;

	for (let ofIndex = 0, ofList = patched; ofIndex < ofList.length; ofIndex++) {
		const { name, layer, wrapper } = ofList[ofIndex];
		const restore = closeLayer(layer);
		if (holdsValue(globalThis, name, wrapper)) globalThis[name] = restore;
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
	if (!mayTakeInternals(consumer, ["slothlet"])) throw ownBindingsRefusal("lib/helpers/observer-context", import.meta.url);
	return { disableObserverPatching, enableObserverPatching };
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
/** @type {typeof enableObserverPatching} */
const guarded_enableObserverPatching = guardInternal(enableObserverPatching, "enableObserverPatching", import.meta.url);
/** @type {typeof disableObserverPatching} */
const guarded_disableObserverPatching = guardInternal(disableObserverPatching, "disableObserverPatching", import.meta.url);
export { guarded_enableObserverPatching as enableObserverPatching, guarded_disableObserverPatching as disableObserverPatching };
