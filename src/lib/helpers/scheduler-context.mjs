/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/scheduler-context.mjs
 *	@Date: 2026-07-30T12:00:00-07:00 (1785438000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T23:44:29-08:00 (1795419869)
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

import { holdForCurrentFlow, pinToCurrentCaller, releaseAfterCall } from "#helpers/caller-pinning";
import { checkCapability } from "#helpers/capability-context";
import { openLayer, closeLayer, holdsValue, markLayer, matchShape } from "#helpers/boundary-patch-layers";
import {
	concatLists,
	EventTargetMethods,
	listPush,
	Map,
	MapMethods,
	Objects,
	Processes,
	Reflect,
	Set,
	SetMethods,
	Symbol,
	WeakMap,
	WeakMapMethods
} from "#helpers/intrinsics";
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
 * A Node builtin, when the platform has it.
 * @param {string} id - The builtin's id.
 * @returns {object|null} Its exports, or null.
 * @private
 */
function runtime_builtin(id) {
	try {
		return Processes.getBuiltinModule?.(id) ?? null;
	} catch {
		// A platform that refuses the lookup has no such builtin to patch.
		/* v8 ignore next */
		return null;
	}
}

/**
 * The builtin `node:timers`, taken as slothlet loads; null where the platform has none (a browser).
 * @type {object|null}
 * @private
 */
const TIMERS = runtime_builtin("node:timers");

/**
 * `module.syncBuiltinESMExports`, taken as slothlet loads. Undefined where the platform has no such builtin.
 * @type {Function|undefined}
 * @private
 */
const SYNC_BUILTIN_ESM_EXPORTS = runtime_builtin("node:module")?.syncBuiltinESMExports;

/**
 * Which handles' work each clearing function ends, by the family of schedulers that hand those handles out: a timer's
 * handle is cleared by either `clearTimeout` or `clearInterval`, an immediate's by `clearImmediate`, and so on.
 * @type {Readonly<Record<string, string>>}
 * @private
 */
const FAMILY = Objects.freeze({
	__proto__: null,
	setTimeout: "timer",
	setInterval: "timer",
	clearTimeout: "timer",
	clearInterval: "timer",
	setImmediate: "immediate",
	clearImmediate: "immediate",
	requestAnimationFrame: "frame",
	cancelAnimationFrame: "frame",
	requestIdleCallback: "idle",
	cancelIdleCallback: "idle"
});

/**
 * For each family (see {@link FAMILY}), what releases the run's count of the work behind a handle a scheduler handed
 * out in a `run()` / `scope()` (see `holdForCurrentFlow` in `helpers/caller-pinning`): kept until the work runs (a
 * one-shot) or is cleared. Object handles (Node's) are kept weakly, number handles (a browser's) until released. `ids`
 * holds the id a held object handle answered when code turned it into a primitive (Node's timers, which a clearing
 * function then takes by that id, see {@link runtime_patchHandleId}), and `idOf` the other way, until it is released.
 * @type {Record<string, {objects: WeakMap<object, Function>, numbers: Map<number, Function>, ids: Map<string, object>|null, idOf: WeakMap<object, string>|null}>}
 * @private
 */
const HELD = { __proto__: null };

/**
 * Remember what releases the work behind a handle.
 * @param {string} family - The handle's family.
 * @param {*} handle - The handle.
 * @param {Function} release - The release.
 * @returns {void}
 * @private
 */
function runtime_holdHandle(family, handle, release) {
	const held = (HELD[family] ??= { objects: new WeakMap(), numbers: new Map(), ids: null, idOf: null });
	if (typeof handle === "number") MapMethods.set(held.numbers, handle, release);
	else if (handle !== null && (typeof handle === "object" || typeof handle === "function"))
		WeakMapMethods.set(held.objects, handle, release);
}

/**
 * Forget a handle's release, handing it back.
 * @param {string} family - The handle's family.
 * @param {*} handle - The handle.
 * @returns {Function|undefined} The release, if one was kept.
 * @private
 */
function runtime_takeHandle(family, handle) {
	const held = HELD[family];
	if (held === undefined) return undefined;
	let release;
	if (typeof handle === "number" || typeof handle === "string") {
		if (typeof handle === "number") {
			release = MapMethods.get(held.numbers, handle);
			MapMethods.delete(held.numbers, handle);
		}
		// Node takes a timer by the id its handle answered as a primitive (`clearTimeout(+timer)`), as a number or a string.
		if (release === undefined && held.ids !== null) {
			const object = MapMethods.get(held.ids, "" + handle);
			if (object !== undefined) return runtime_takeHandle(family, object);
		}
	} else if (handle !== null && (typeof handle === "object" || typeof handle === "function")) {
		release = WeakMapMethods.get(held.objects, handle);
		WeakMapMethods.delete(held.objects, handle);
		if (held.idOf !== null) {
			const id = WeakMapMethods.get(held.idOf, handle);
			if (id !== undefined) {
				WeakMapMethods.delete(held.idOf, handle);
				MapMethods.delete(held.ids, id);
			}
		}
	}
	return release;
}

/**
 * Release a `scheduler.postTask()` callback's work when its signal aborts the task, which then never runs. Reads the
 * signal after the platform accepted the call, and listens with `EventTarget`'s own method, below slothlet's patch.
 * @param {*} options - The options the task was posted with.
 * @param {Function} release - The release.
 * @returns {Function|null} What stops listening, once the task has run; null when there is nothing to listen to.
 * @private
 */
function runtime_releaseOnAbort(options, release) {
	if (options === null || typeof options !== "object" || typeof EventTargetMethods.addEventListener !== "function") return null;
	try {
		const signal = options.signal;
		if (signal === null || typeof signal !== "object") return null;
		// Aborted already: the platform refused the task, and its callback never runs.
		if (signal.aborted === true) {
			release();
			return null;
		}
		const onAbort = () => release();
		EventTargetMethods.addEventListener(signal, "abort", onAbort, { __proto__: null, once: true });
		return () => EventTargetMethods.removeEventListener(signal, "abort", onAbort);
	} catch {
		// Not an EventTarget: the platform took it for something else, and the task runs.
		return null;
	}
}

/**
 * Copy a scheduler's own extras onto its wrapper.
 *
 * Node hangs promisify support off `setTimeout`/`setImmediate` as a well-known symbol, and callers
 * reach it through the global they were given. A wrapper that dropped it would break
 * `util.promisify(setTimeout)` for everything in the process, so carry every own property across by
 * descriptor — accessors stay accessors and non-enumerable keys stay non-enumerable. `prototype` is
 * deliberately left alone, it belongs to the wrapper; `name` and `length` are the original's, set by
 * `matchShape` (see helpers/boundary-patch-layers).
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
 * Install on `node:timers` the very wrapper the global has, when the function there is the one the global's wrapper
 * replaced: Node exports one function as both `globalThis.setTimeout` and `require("node:timers").setTimeout` (and so
 * for each timer function), and code that compares them keeps finding them equal. A `node:timers` function that is not
 * the global's (a host replaced one of them) gets a wrapper of its own.
 * @param {object} host - Object carrying the entry point.
 * @param {string} name - Property name to patch.
 * @param {Function} installed - The function there now.
 * @returns {boolean} True when the global's wrapper was installed.
 * @private
 */
function runtime_shareGlobalWrapper(host, name, installed) {
	if (host === globalThis) return false;
	for (let index = 0; index < patched.length; index++) {
		const entry = patched[index];
		if (entry.host !== globalThis || entry.name !== name || entry.layer.below !== installed) continue;
		host[name] = entry.wrapper;
		listPush(patched, { host, name, layer: entry.layer, wrapper: entry.wrapper });
		return true;
	}
	return false;
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
	if (runtime_shareGlobalWrapper(host, name, installed)) return;
	// Shared with any other copy of slothlet in the realm (see boundary-patch-layers).
	const layer = openLayer(installed);
	const original = layer.below;

	// A string a timer runs as code (a browser's `setTimeout("…")`) is code from a string: module code needs
	// `capability:code` for it (see helpers/capability-context).
	const runsStrings = host === globalThis && (name === "setTimeout" || name === "setInterval");
	// A callback scheduled in a run() / scope() is the run's work until it has run (an interval: until it is cleared).
	const family = FAMILY[name];
	const repeats = name === "setInterval";
	// A task posted with a signal that aborts it never runs: its work ends at the abort.
	const abortable = name === "postTask";
	const wrapper = function (callback, ...rest) {
		if (runsStrings && layer.active && callback != null && typeof callback !== "function") checkCapability("code", name);
		// Non-function callbacks (legacy string-of-code timers) have no identity to carry, and a wrapper
		// disabled under another copy's passes everything through.
		if (typeof callback !== "function" || !layer.active) return Reflect.apply(original.call, original, concatLists([host, callback], rest));
		const release = holdForCurrentFlow();
		if (release === null) return Reflect.apply(original.call, original, concatLists([host, pinToCurrentCaller(callback)], rest));
		let handle;
		let stopListening = null;
		let pinned = pinToCurrentCaller(callback);
		if (!repeats) {
			pinned = releaseAfterCall(pinned, () => {
				if (family !== undefined) runtime_takeHandle(family, handle);
				if (stopListening !== null) stopListening();
				release();
			});
		}
		try {
			handle = Reflect.apply(original.call, original, concatLists([host, pinned], rest));
		} catch (error) {
			release();
			throw error;
		}
		if (family !== undefined) {
			runtime_holdHandle(family, handle, release);
			runtime_patchHandleType(family, handle);
		} else if (abortable) stopListening = runtime_releaseOnAbort(rest[0], release);
		return handle;
	};

	runtime_carryOwnExtras(wrapper, original);
	matchShape(wrapper, original);
	markLayer(wrapper, layer);
	host[name] = wrapper;
	listPush(patched, { host, name, layer, wrapper });
}

/**
 * Replace one clearing function (`clearTimeout`, `cancelAnimationFrame`, ...) with a wrapper that, after clearing,
 * releases the run's count of the work behind the handle (see {@link runtime_patchScheduler}). Everything else is the
 * original's: the arguments, the receiver, the result and any throw.
 *
 * @param {object} host - Object carrying the entry point.
 * @param {string} name - Property name to patch.
 * @returns {void}
 * @private
 */
function runtime_patchClear(host, name) {
	const installed = host?.[name];
	if (typeof installed !== "function") return;
	if (runtime_shareGlobalWrapper(host, name, installed)) return;
	const layer = openLayer(installed);
	const original = layer.below;
	const family = FAMILY[name];
	// Not gated on the layer: work a run held while this copy was active is still released when it is cleared.
	const wrapper = function (handle, ...rest) {
		const result = Reflect.apply(original.call, original, concatLists([host, handle], rest));
		const release = runtime_takeHandle(family, handle);
		if (release !== undefined) release();
		return result;
	};
	runtime_carryOwnExtras(wrapper, original);
	matchShape(wrapper, original);
	markLayer(wrapper, layer);
	host[name] = wrapper;
	listPush(patched, { host, name, layer, wrapper });
}

/**
 * Replace one method of a handle's prototype that clears the handle (Node's `Timeout.prototype.close()` and
 * `[Symbol.dispose]()`, `Immediate.prototype[Symbol.dispose]()`) with a wrapper that, after clearing, releases the run's
 * count of the work behind the handle. Node clears through its own `clearTimeout` / `clearImmediate` there, which no
 * patch of the exported functions reaches. Everything else is the original's.
 *
 * @param {object} proto - The prototype.
 * @param {string|symbol} key - The method's key.
 * @param {string} family - The family of the handles it clears.
 * @returns {void}
 * @private
 */
function runtime_patchHandleMethod(proto, key, family) {
	const descriptor = Objects.getOwnPropertyDescriptor(proto, key);
	if (typeof descriptor?.value !== "function" || descriptor.writable !== true) return;
	const layer = openLayer(descriptor.value);
	const original = layer.below;
	const wrapper = {
		[key](...args) {
			const result = Reflect.apply(original, this, args);
			const release = runtime_takeHandle(family, this);
			if (release !== undefined) release();
			return result;
		}
	}[key];
	runtime_carryOwnExtras(wrapper, original);
	matchShape(wrapper, original);
	markLayer(wrapper, layer);
	proto[key] = wrapper;
	listPush(patched, { host: proto, name: key, layer, wrapper });
}

/**
 * Replace a handle prototype's `[Symbol.toPrimitive]()` (Node's `Timeout`: it answers the timer's id, and registers the
 * timer under it for the clearing functions to take by that id) with a wrapper that, when the handle is held as a run's
 * work, also keeps the id it answered, so a clearing function handed that id releases the work as one handed the handle
 * does (see {@link runtime_takeHandle}). Only code that asks for the number pays for it: no handle is turned into one up
 * front. Everything else is the original's.
 *
 * @param {object} proto - The prototype.
 * @param {string} family - The family of its handles.
 * @returns {void}
 * @private
 */
function runtime_patchHandleId(proto, family) {
	const key = Symbol.toPrimitive;
	const descriptor = Objects.getOwnPropertyDescriptor(proto, key);
	if (typeof descriptor?.value !== "function" || descriptor.writable !== true) return;
	const layer = openLayer(descriptor.value);
	const original = layer.below;
	const wrapper = {
		[key](...args) {
			const id = Reflect.apply(original, this, args);
			const held = HELD[family];
			if (
				held !== undefined &&
				(typeof id === "number" || typeof id === "string") &&
				WeakMapMethods.has(held.objects, this) &&
				(held.idOf === null || !WeakMapMethods.has(held.idOf, this))
			) {
				const name = "" + id;
				MapMethods.set((held.ids ??= new Map()), name, this);
				WeakMapMethods.set((held.idOf ??= new WeakMap()), this, name);
			}
			return id;
		}
	}[key];
	runtime_carryOwnExtras(wrapper, original);
	matchShape(wrapper, original);
	markLayer(wrapper, layer);
	proto[key] = wrapper;
	listPush(patched, { host: proto, name: key, layer, wrapper });
}

/**
 * The handle prototypes whose clearing methods are patched (see {@link runtime_patchHandleType}), while the patch is on.
 * @type {Set<object>}
 * @private
 */
const patchedHandleTypes = new Set();

/**
 * The clearing methods of each family's handle prototype (see {@link runtime_patchHandleMethod}).
 * @type {Readonly<Record<string, ReadonlyArray<string|symbol>>>}
 * @private
 */
const HANDLE_METHODS = Objects.freeze({ __proto__: null, timer: ["close", Symbol.dispose], immediate: [Symbol.dispose] });

/**
 * Patch the clearing methods of a handle's prototype the first time a handle of that type is counted as a run's work:
 * the prototype is only known from a handle (Node does not export `Timeout` or `Immediate`). A handle that is a number
 * or a plain object (a browser's, a fake timer's) has no such methods, and nothing is patched.
 * @param {string} family - The handle's family.
 * @param {*} handle - The handle.
 * @returns {void}
 * @private
 */
function runtime_patchHandleType(family, handle) {
	if (handle === null || typeof handle !== "object") return;
	const proto = Objects.getPrototypeOf(handle);
	if (proto === null || SetMethods.has(patchedHandleTypes, proto)) return;
	SetMethods.add(patchedHandleTypes, proto);
	const keys = HANDLE_METHODS[family];
	if (keys === undefined) return;
	for (let index = 0; index < keys.length; index++) runtime_patchHandleMethod(proto, keys[index], family);
	if (family === "timer") runtime_patchHandleId(proto, family);
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
	runtime_patchClear(globalThis, "clearTimeout");
	runtime_patchClear(globalThis, "clearInterval");
	runtime_patchClear(globalThis, "clearImmediate");
	runtime_patchClear(globalThis, "cancelAnimationFrame");
	runtime_patchClear(globalThis, "cancelIdleCallback");
	// The functions `node:timers` exports schedule and clear as the global ones do: `import { setTimeout } from
	// "node:timers"` (or `require("node:timers").setTimeout`) keeps the flow and the caller it was scheduled in, and a
	// timer cleared there ends the work. ES modules read a builtin's exports through bindings Node refreshes on request.
	if (TIMERS !== null) {
		runtime_patchScheduler(TIMERS, "setTimeout");
		runtime_patchScheduler(TIMERS, "setInterval");
		runtime_patchScheduler(TIMERS, "setImmediate");
		runtime_patchClear(TIMERS, "clearTimeout");
		runtime_patchClear(TIMERS, "clearInterval");
		runtime_patchClear(TIMERS, "clearImmediate");
		SYNC_BUILTIN_ESM_EXPORTS?.();
	}

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
		if (!layer.active) continue;
		// Read from the own descriptor, never through a getter, and only a writable data property is written: a host that
		// wrote the function back read-only (or behind an accessor) keeps it, and the call starting here is not made to throw.
		const descriptor = Reflect.getOwnPropertyDescriptor(host, name);
		if (descriptor !== undefined && descriptor.writable === true && descriptor.value === layer.below) host[name] = wrapper;
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
	SetMethods.clear(patchedHandleTypes);
	// The ids of handles still held: the unpatched clearing functions release nothing by them any more.
	for (const family in HELD) {
		const held = HELD[family];
		if (held.ids !== null) MapMethods.clear(held.ids);
		held.ids = null;
		held.idOf = null;
	}
	if (TIMERS !== null) SYNC_BUILTIN_ESM_EXPORTS?.();
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
