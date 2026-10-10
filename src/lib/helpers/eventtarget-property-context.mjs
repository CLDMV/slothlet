/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/eventtarget-property-context.mjs
 *	@Date: 2026-09-07T22:36:15-07:00 (1788845775)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:52-07:00 (1791090892)
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
 * @type {Array<{proto: object, propName: string, descriptor: PropertyDescriptor, wrapperGet: Function, wrapperSet: Function}>}
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
	const descriptor = proto && Object.getOwnPropertyDescriptor(proto, propName);
	// Absent on this host's prototype, not an IDL-style accessor, or non-configurable: nothing to patch.
	// Covers a host that lacks the interface entirely, an exotic embedder that exposes the handler as a
	// plain data property instead, and a host that locked the accessor down — redefining a
	// non-configurable accessor throws, and this patch is best-effort like the other boundary patches,
	// not a hard requirement.
	if (!descriptor || typeof descriptor.get !== "function" || typeof descriptor.set !== "function" || !descriptor.configurable) return;
	// Already this patch's accessor: an interface listed by name is also reached by discovery.
	if (installedGetters.has(descriptor.get)) return;

	const { get: originalGet, set: originalSet } = descriptor;

	/**
	 * Targets currently holding a pinned wrapper through this accessor, and what was assigned.
	 * @type {WeakMap<object, {original: Function, wrapper: Function}>}
	 */
	const tracked = new WeakMap();

	const wrapperGet = function () {
		const entry = tracked.get(this);
		const current = originalGet.call(this);
		// Only substitute when the platform still reports the wrapper this patch installed — anything
		// else means the property was reassigned to something this setter did not wrap (e.g. `null`),
		// and the platform's own value is already the right answer.
		if (entry) {
			if (current === entry.wrapper) return entry.original;
			// The platform no longer reports the wrapper this patch installed, so the entry no longer
			// describes reality. Drop it rather than leaving it to keep the stale original/wrapper pair
			// reachable for the lifetime of `this`.
			tracked.delete(this);
		}
		return current;
	};

	const wrapperSet = function (value) {
		// `null` deactivates the handler; anything else non-function is the platform's problem to accept
		// or reject the same way it would unpatched. Neither has an identity to pin.
		if (typeof value !== "function") {
			const result = originalSet.call(this, value);
			tracked.delete(this);
			return result;
		}

		const wrapper = pinToCurrentCaller(value);
		// Mutate `tracked` only once the platform setter has actually accepted the assignment — if it
		// throws, the previous tracked entry (or lack of one) is still the accurate description of state.
		const result = originalSet.call(this, wrapper);
		tracked.set(this, { original: value, wrapper });
		return result;
	};

	Object.defineProperty(proto, propName, {
		configurable: descriptor.configurable,
		enumerable: descriptor.enumerable,
		get: wrapperGet,
		set: wrapperSet
	});
	installedGetters.add(wrapperGet);

	patched.push({ proto, propName, descriptor, wrapperGet, wrapperSet });
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
export function enableEventTargetPropertyPatching() {
	if (isPatchingEnabled) return;

	for (const [ctorName, propNames] of PATCHED_INTERFACES) {
		const ctor = globalThis[ctorName];
		// Host doesn't provide this interface at all (most of these are browser-only) — nothing to patch.
		if (typeof ctor !== "function") continue;
		for (const propName of propNames) runtime_patchHandlerProperty(ctor, propName);
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
	return Object.getOwnPropertyNames(target).filter((name) => name.startsWith("on") && name.length > 2);
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
	const EventTargetCtor = globalThis.EventTarget;
	// A host without EventTarget has no DOM-style handlers to discover; the named list still applies.
	if (typeof EventTargetCtor !== "function") return;
	const base = EventTargetCtor.prototype;

	for (const name of Object.getOwnPropertyNames(globalThis)) {
		const value = Object.getOwnPropertyDescriptor(globalThis, name)?.value;
		if (typeof value !== "function" || !value.prototype || !Object.prototype.isPrototypeOf.call(base, value.prototype)) continue;
		for (const propName of runtime_ownHandlerNames(value.prototype)) runtime_patchHandlerAccessor(value.prototype, propName);
	}

	// A Window or worker global: WebIDL declares its handlers on the global object itself.
	if (Object.prototype.isPrototypeOf.call(base, globalThis)) {
		for (const propName of runtime_ownHandlerNames(globalThis)) runtime_patchHandlerAccessor(globalThis, propName);
	}
}

/**
 * Restore the original `on*` handler accessors.
 *
 * Restores an accessor only when the patch installed here is still in place, so anything that replaced
 * it afterwards keeps ownership of its own restore.
 *
 * @returns {void}
 * @public
 */
export function disableEventTargetPropertyPatching() {
	if (!isPatchingEnabled) return;

	for (const { proto, propName, descriptor, wrapperGet, wrapperSet } of patched) {
		const current = Object.getOwnPropertyDescriptor(proto, propName);
		if (current && current.get === wrapperGet && current.set === wrapperSet) {
			Object.defineProperty(proto, propName, descriptor);
		}
	}

	patched.length = 0;
	isPatchingEnabled = false;
}
