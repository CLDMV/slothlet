/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/eventtarget-property-context.mjs
 *	@Date: 2026-09-07T22:36:15-07:00 (1788845775)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T18:55:14-08:00 (1794797714)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Carries the assigning module's caller identity across IDL `on*` handler properties.
 * @module @cldmv/slothlet/helpers/eventtarget-property-context
 * @internal
 *
 * @description
 * `eventtarget-context.mjs` closes the boundary for `addEventListener`, but the DOM offers a second,
 * unrelated way to register the same kind of callback: assigning `thing.onmessage = fn`. That write
 * lands on an IDL attribute the target interface declares on its own prototype — there is no single
 * shared setter the way `EventTarget.prototype.addEventListener` is shared, so `addEventListener`
 * patching never sees it. The callback then runs with no pinned identity, the same
 * `RUNTIME_NO_ACTIVE_CONTEXT_SELF` / unattributed-caller failure the `addEventListener` patch exists
 * to prevent.
 *
 * Each interface below declares its `on*` attributes independently, so each one is patched by name on
 * its own prototype rather than once at a shared ancestor. A handler property holds at most one
 * function at a time — unlike `addEventListener`, there is no list and no capture flag — so the
 * bookkeeping only has to remember the one pinned wrapper currently installed per target, not track a
 * `(type, capture)` triple.
 *
 * The interfaces below are patched by name, for hosts whose interfaces do not descend from `EventTarget`.
 * Beyond them, every `EventTarget` interface the global object exposes is patched by discovery: each
 * `on*` accessor its prototype declares, which takes in `HTMLElement` / `SVGElement` / `Document`
 * (`onclick`, `oninput`, …), `XMLHttpRequestEventTarget`, `AbortSignal`, `BroadcastChannel`, IndexedDB
 * requests and every other interface without listing them — plus the global object's own `on*`
 * accessors (`window.onload`, `onmessage` in a worker), which WebIDL declares on the global itself.
 *
 * Reading the property back has to return the exact function that was assigned, not the pinned
 * wrapper — code that does `thing.onmessage = fn; assert(thing.onmessage === fn)` is common and
 * correct against the unpatched platform. The getter below only substitutes the original when the
 * platform's own getter still reports the wrapper this patch installed; anything else (never assigned
 * through here, or reassigned to something this patch did not wrap) passes straight through.
 *
 * This closes the boundary for cooperative code, not a sandbox — a module can still reach an
 * unpatched interface through another realm. See `docs/PERMISSIONS.md` on what the live runtime does
 * and does not bound.
 */

import { pinToCurrentCaller } from "@cldmv/slothlet/helpers/caller-pinning";
import { openLayer, closeLayer, isActiveLayer, markLayer } from "@cldmv/slothlet/helpers/boundary-patch-layers";
import {
	ArrayMethods,
	EventTarget,
	filterList,
	FunctionMethods,
	Objects,
	StringMethods,
	WeakMap,
	WeakMapMethods,
	WeakSet,
	WeakSetMethods
} from "@cldmv/slothlet/helpers/intrinsics";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "@cldmv/slothlet/helpers/instance-imports";
import { isSlothletProxy } from "#handlers/framework-internals";

/**
 * Interfaces and the `on*` handler properties patched on each.
 *
 * Every property here is an IDL event handler attribute declared directly on the named interface's
 * own prototype (not inherited from `EventTarget`). Listed explicitly so a host whose interfaces do not
 * descend from `EventTarget` is still covered; on a standard host discovery (see
 * {@link enableEventTargetPropertyPatching}) reaches these and every other interface's handlers too.
 *
 * @type {Array<[string, string[]]>}
 * @private
 */
const PATCHED_INTERFACES = [
	["EventSource", ["onopen", "onmessage", "onerror"]],
	["WebSocket", ["onopen", "onmessage", "onerror", "onclose"]],
	["Worker", ["onmessage", "onmessageerror", "onerror"]],
	["MessagePort", ["onmessage", "onmessageerror"]],
	["FileReader", ["onloadstart", "onprogress", "onabort", "onerror", "onload", "onloadend"]],
	["XMLHttpRequest", ["onreadystatechange", "onloadstart", "onprogress", "onabort", "onerror", "onload", "ontimeout", "onloadend"]]
];

/**
 * Patched properties, holding what {@link disableEventTargetPropertyPatching} needs to restore only
 * the accessor it actually replaced.
 * @type {Array<{proto: object, propName: string, layer: {active: boolean, below: PropertyDescriptor}, wrapperGet: Function, wrapperSet: Function}>}
 * @private
 */
const patched = [];

/**
 * Getters this patch installed, so discovery never wraps an accessor twice.
 * @type {WeakSet<Function>}
 * @private
 */
const installedGetters = new WeakSet();

/**
 * Identify an accessor's layer by its getter.
 * @param {PropertyDescriptor|undefined} descriptor - An accessor descriptor.
 * @returns {Function|undefined} Its getter.
 * @private
 */
const runtime_descriptorGetter = (descriptor) => descriptor?.get;

/**
 * Whether the `on*` handler properties are currently patched.
 * @type {boolean}
 * @private
 */
let isPatchingEnabled = false;

/**
 * Replace one interface's `on*` accessor with a pinning get/set pair.
 *
 * @param {Function} ctor - Interface constructor (e.g. `EventSource`).
 * @param {string} propName - Handler property name (e.g. `"onmessage"`).
 * @returns {void}
 * @private
 */
function runtime_patchHandlerProperty(ctor, propName) {
	runtime_patchHandlerAccessor(ctor?.prototype, propName);
}

/**
 * Replace one `on*` accessor, declared on `proto` itself, with a pinning get/set pair.
 *
 * @param {object|undefined} proto - The object declaring the accessor: an interface prototype, or the
 *   global object for the handlers WebIDL puts on it directly.
 * @param {string} propName - Handler property name.
 * @returns {void}
 * @private
 */
function runtime_patchHandlerAccessor(proto, propName) {
	const descriptor = proto && Objects.getOwnPropertyDescriptor(proto, propName);
	// Absent on this host's prototype, not an IDL-style accessor, or non-configurable: nothing to patch.
	// Covers a host that lacks the interface entirely, an exotic embedder that exposes the handler as a
	// plain data property instead, and a host that locked the accessor down — redefining a
	// non-configurable accessor throws, and this patch is best-effort like the other boundary patches,
	// not a hard requirement.
	if (!descriptor || typeof descriptor.get !== "function" || typeof descriptor.set !== "function" || !descriptor.configurable) return;
	// Already this patch's accessor: an interface listed by name is also reached by discovery. One this
	// copy disabled earlier, and that is back on top, is wrapped afresh instead.
	if (WeakSetMethods.has(installedGetters, descriptor.get) && isActiveLayer(descriptor.get)) return;

	// Shared with any other copy of slothlet in the realm (see boundary-patch-layers).
	const layer = openLayer(descriptor, runtime_descriptorGetter);
	const { get: originalGet, set: originalSet } = layer.below;

	/**
	 * Targets currently holding a pinned wrapper through this accessor, and what was assigned.
	 * @type {WeakMap<object, {original: Function, wrapper: Function}>}
	 */
	const tracked = new WeakMap();

	const wrapperGet = function () {
		const entry = WeakMapMethods.get(tracked, this);
		const current = FunctionMethods.call(originalGet, this);
		// Only substitute when the platform still reports the wrapper this patch installed — anything
		// else means the property was reassigned to something this setter did not wrap (e.g. `null`),
		// and the platform's own value is already the right answer.
		if (entry) {
			if (current === entry.wrapper) return entry.original;
			// The platform no longer reports the wrapper this patch installed, so the entry no longer
			// describes reality. Drop it rather than leaving it to keep the stale original/wrapper pair
			// reachable for the lifetime of `this`.
			WeakMapMethods.delete(tracked, this);
		}
		return current;
	};

	const wrapperSet = function (value) {
		// `null` deactivates the handler; anything else non-function is the platform's problem to accept
		// or reject the same way it would unpatched. Neither has an identity to pin — and an accessor
		// disabled under another copy's pins nothing either.
		if (typeof value !== "function" || !layer.active) {
			const result = FunctionMethods.call(originalSet, this, value);
			WeakMapMethods.delete(tracked, this);
			return result;
		}

		const wrapper = pinToCurrentCaller(value);
		// Mutate `tracked` only once the platform setter has actually accepted the assignment — if it
		// throws, the previous tracked entry (or lack of one) is still the accurate description of state.
		const result = FunctionMethods.call(originalSet, this, wrapper);
		WeakMapMethods.set(tracked, this, { original: value, wrapper });
		return result;
	};

	Objects.defineProperty(proto, propName, {
		configurable: descriptor.configurable,
		enumerable: descriptor.enumerable,
		get: wrapperGet,
		set: wrapperSet
	});
	WeakSetMethods.add(installedGetters, wrapperGet);
	markLayer(wrapperGet, layer);

	ArrayMethods.push(patched, { proto, propName, layer, wrapperGet, wrapperSet });
}

/**
 * Pin `on*` handler assignments to the module that makes them.
 *
 * Called once globally when the first instance is created; later calls are ignored, matching how the
 * other boundary patches behave. Costs nothing when no runtime registered a pinning strategy — the
 * wrapper hands the callback straight through.
 *
 * @returns {void}
 * @public
 */
function enableEventTargetPropertyPatching() {
	if (isPatchingEnabled) return;

	for (let ofIndex = 0, ofList = PATCHED_INTERFACES; ofIndex < ofList.length; ofIndex++) {
		const ofEntry = ofList[ofIndex],
			ctorName = ofEntry[0],
			propNames = ofEntry[1];
		const ctor = globalThis[ctorName];
		// Host doesn't provide this interface at all (most of these are browser-only) — nothing to patch.
		if (typeof ctor !== "function") continue;
		for (let ofIndex = 0, ofList = propNames; ofIndex < ofList.length; ofIndex++) {
			const propName = ofList[ofIndex];
			runtime_patchHandlerProperty(ctor, propName);
		}
	}

	runtime_patchDiscoveredHandlers();

	isPatchingEnabled = true;
}

/**
 * The `on*` accessors an object declares itself.
 * @param {object} target - Prototype or global object.
 * @returns {string[]} Own property names that look like event handler attributes.
 * @private
 */
function runtime_ownHandlerNames(target) {
	return filterList(Objects.getOwnPropertyNames(target), (name) => StringMethods.startsWith(name, "on") && name.length > 2);
}

/**
 * Patch the `on*` handlers of every `EventTarget` interface the global object exposes, and the global
 * object's own.
 *
 * Interfaces are found among the global's own data properties only: an accessor-backed global (a lazily
 * initialised one in Node, a deprecated alias in a browser) is never read, so discovery cannot trigger
 * a getter's side effects or warnings.
 *
 * @returns {void}
 * @private
 */
function runtime_patchDiscoveredHandlers() {
	const EventTargetCtor = EventTarget;
	// A host without EventTarget has no DOM-style handlers to discover; the named list still applies.
	if (typeof EventTargetCtor !== "function") return;
	const base = EventTargetCtor.prototype;

	for (let ofIndex = 0, ofList = Objects.getOwnPropertyNames(globalThis); ofIndex < ofList.length; ofIndex++) {
		const name = ofList[ofIndex];
		const value = Objects.getOwnPropertyDescriptor(globalThis, name)?.value;
		// Slothlet's own Proxies (a function root's `self`, #803) are no interface, and are not read here.
		if (
			typeof value !== "function" ||
			isSlothletProxy(value) ||
			!value.prototype ||
			!Objects.prototype.isPrototypeOf.call(base, value.prototype)
		)
			continue;
		for (const propName of runtime_ownHandlerNames(value.prototype)) runtime_patchHandlerAccessor(value.prototype, propName);
	}

	// A Window or worker global: WebIDL declares its handlers on the global object itself.
	if (FunctionMethods.call(Objects.prototype.isPrototypeOf, base, globalThis)) {
		for (let ofIndex = 0, ofList = runtime_ownHandlerNames(globalThis); ofIndex < ofList.length; ofIndex++) {
			const propName = ofList[ofIndex];
			runtime_patchHandlerAccessor(globalThis, propName);
		}
	}
}

/**
 * Restore the original `on*` handler accessors.
 *
 * Restores an accessor only when the patch installed here is still in place, so anything that replaced
 * it afterwards keeps ownership of its own restore. An accessor left in place passes through from then
 * on, and a restore puts back what is under every such accessor (see boundary-patch-layers).
 *
 * @returns {void}
 * @public
 */
function disableEventTargetPropertyPatching() {
	if (!isPatchingEnabled) return;

	for (let ofIndex = 0, ofList = patched; ofIndex < ofList.length; ofIndex++) {
		const { proto, propName, layer, wrapperGet, wrapperSet } = ofList[ofIndex];
		const restore = closeLayer(layer, runtime_descriptorGetter);
		const current = Objects.getOwnPropertyDescriptor(proto, propName);
		if (current && current.get === wrapperGet && current.set === wrapperSet) {
			Objects.defineProperty(proto, propName, restore);
		}
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
	if (!mayTakeInternals(consumer, ["slothlet"])) throw ownBindingsRefusal("lib/helpers/eventtarget-property-context", import.meta.url);
	return { disableEventTargetPropertyPatching, enableEventTargetPropertyPatching };
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
/** @type {typeof enableEventTargetPropertyPatching} */
const guarded_enableEventTargetPropertyPatching = guardInternal(
	enableEventTargetPropertyPatching,
	"enableEventTargetPropertyPatching",
	import.meta.url
);
/** @type {typeof disableEventTargetPropertyPatching} */
const guarded_disableEventTargetPropertyPatching = guardInternal(
	disableEventTargetPropertyPatching,
	"disableEventTargetPropertyPatching",
	import.meta.url
);
export {
	guarded_enableEventTargetPropertyPatching as enableEventTargetPropertyPatching,
	guarded_disableEventTargetPropertyPatching as disableEventTargetPropertyPatching
};
