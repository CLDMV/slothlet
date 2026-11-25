/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/framework-internals.mjs
 *	@Date: 2026-08-17T00:00:00-07:00 (1786950000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T21:15:37-08:00 (1794978937)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Object-identity brand for slothlet's own framework-internal objects (#283).
 * @module @cldmv/slothlet/handlers/framework-internals
 * @internal
 *
 * @description
 * A module-private registry of objects slothlet ITSELF created and stamped with reserved internal
 * marker keys (currently a version dispatcher's `{ ____isVersionDispatcher, ____logicalPath }` target and
 * any wrapper those markers are merged onto). Membership is by object IDENTITY — the registry is not
 * reachable by consumer code and cannot be joined by naming a member.
 *
 * The module-private `_`/`__` rule (#269) denies an unidentified (host) caller a `_`/`__`-prefixed
 * member by default. Slothlet's own dispatcher marker keys are `__`-prefixed, so the framework's own
 * reads of them (e.g. `mergeApiObjects` detecting a dispatcher during composition, caller `null`) were
 * denied — regressing every version-dispatched field (#283). The permission read-gate exempts a read
 * of a `FRAMEWORK_MARKER_KEYS` key ONLY when the object carrying it is branded here, so:
 *
 * - slothlet's own marker on a branded object → exempt (framework machinery, never a secret), while
 * - a consumer's identically-named member lives on a NON-branded object → stays denied by #269.
 *
 * The distinction is object identity, never the key name — a name whitelist would hand the host a
 * consumer's private member that happened to share the name, reopening exactly what #269 closed.
 */

import { setFrom, SetMethods, WeakMap, WeakMapMethods, WeakSet, WeakSetMethods } from "#helpers/intrinsics";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "#helpers/instance-imports";

/**
 * Objects slothlet created and stamped with a framework-internal marker key. Weak so a branded
 * dispatcher/wrapper is never kept alive by the registry.
 * @type {WeakSet<object>}
 * @private
 */

const FRAMEWORK_INTERNAL = new WeakSet();

/** `WeakSet.prototype.has` as it was when slothlet loaded, so a module replacing it changes no answer below. */
const weakSetHas = WeakSetMethods.has;

/**
 * Reserved marker keys slothlet stamps as OWN properties on framework-internal objects.
 *
 * These are framework machinery, not module exports (#260 rejects a module file/export named for a
 * reserved key at load), so a consumer only ever holds one of these names as *data* on a non-branded
 * object — where it stays gated. A read of one of these keys is exempt from the module-private host
 * gate ONLY when the carrying object is branded via {@link markFrameworkInternal}.
 *
 * Kept module-PRIVATE and exposed only through the immutable {@link isFrameworkMarkerKey} predicate:
 * the set participates in permission (read-gate) decisions, so a mutable export could let any importer
 * silently broaden the exemption beyond these reserved keys.
 * @type {Set<string>}
 * @private
 */
const FRAMEWORK_MARKER_KEYS = setFrom(["____isVersionDispatcher", "____logicalPath"]);

/**
 * Whether `key` is one of slothlet's reserved dispatcher marker keys.
 *
 * The immutable read view over `FRAMEWORK_MARKER_KEYS` — importers can test membership but
 * cannot add keys and broaden the read-gate exemption.
 *
 * @param {string} key - Property name to test.
 * @returns {boolean} True when `key` is a reserved framework marker key.
 * @internal
 * @example
 * if (isFrameworkInternal(wrapper) && isFrameworkMarkerKey(leafKey)) return { allowed: true };
 */
export function isFrameworkMarkerKey(key) {
	return SetMethods.has(FRAMEWORK_MARKER_KEYS, key);
}

/**
 * Brand an object as slothlet-internal so reads of its `FRAMEWORK_MARKER_KEYS` are exempt from
 * the module-private host gate. No-op for non-objects.
 *
 * @param {*} obj - The object (or function) slothlet created / stamped with a marker key.
 * @returns {*} The same `obj`, for call-site chaining.
 * @internal
 * @example
 * const dispatcher = markFrameworkInternal(new Proxy(target, handlers));
 */
function markFrameworkInternal(obj) {
	if (obj !== null && (typeof obj === "object" || typeof obj === "function")) WeakSetMethods.add(FRAMEWORK_INTERNAL, obj);
	return obj;
}

/**
 * Whether `obj` is a branded slothlet-internal object (see {@link markFrameworkInternal}).
 *
 * @param {*} obj - Candidate object.
 * @returns {boolean} True when `obj` was branded by the framework.
 * @internal
 * @example
 * if (isFrameworkInternal(sourceApi)) markFrameworkInternal(resolveWrapper(targetApi));
 */
export function isFrameworkInternal(obj) {
	return obj !== null && (typeof obj === "object" || typeof obj === "function") && weakSetHas(FRAMEWORK_INTERNAL, obj);
}

/**
 * Routine callables slothlet built (a per-path routine stack or a routine's root cascade). Weak, like the brand.
 * @type {WeakSet<Function>}
 * @private
 */
const FRAMEWORK_ROUTINES = new WeakSet();

/**
 * The marker keys slothlet stamps as own properties on the routine callables it builds.
 * @type {Set<string>}
 * @private
 */
const ROUTINE_MARKER_KEYS = setFrom(["____slothletRoutineStack", "____slothletRoutineCascade", "____slothletRoutineName"]);

/**
 * Record a routine callable slothlet built, by identity.
 * @param {Function} fn - The callable.
 * @returns {Function} The same `fn`.
 * @internal
 */
function markFrameworkRoutine(fn) {
	WeakSetMethods.add(FRAMEWORK_ROUTINES, fn);
	return fn;
}

/**
 * Whether `key` on `holder` is a marker slothlet stamped on a routine callable it built: the framework's own member,
 * which nothing written by a module installs or takes over. Decided by the holder's identity, never by the name alone.
 * @param {*} holder - The object or function carrying the key.
 * @param {string} key - The key.
 * @returns {boolean} True for a routine marker on a routine callable slothlet built.
 * @internal
 * @example
 * if (isFrameworkRoutineMarker(fn, "____slothletRoutineStack")) continue;
 */
export function isFrameworkRoutineMarker(holder, key) {
	return typeof holder === "function" && SetMethods.has(ROUTINE_MARKER_KEYS, key) && weakSetHas(FRAMEWORK_ROUTINES, holder);
}

/**
 * Version dispatchers slothlet mounted, each with the instance it serves and how it resolves the versioned
 * node it currently routes to. Weak, like the brand.
 * @type {WeakMap<object, {slothlet: object, resolve: function(): (object|null)}>}
 * @private
 */
const VERSION_DISPATCHERS = new WeakMap();

/**
 * Record a version dispatcher, so a view of it can be built for module code (#625): the dispatcher is no
 * api node of its own, it routes every access to a versioned node.
 *
 * @param {object} dispatcher - The dispatcher proxy.
 * @param {{slothlet: object, resolve: function(): (object|null)}} record - Its instance, and the resolver of
 *   the versioned node it routes to right now.
 * @returns {object} `dispatcher`.
 * @internal
 * @example
 * registerVersionDispatcher(proxy, { slothlet, resolve: resolveVersionedWrapper });
 */
function registerVersionDispatcher(dispatcher, record) {
	WeakMapMethods.set(VERSION_DISPATCHERS, dispatcher, record);
	return dispatcher;
}

/**
 * The record of a version dispatcher ({@link registerVersionDispatcher}), or null for anything else.
 *
 * @param {*} obj - Candidate.
 * @returns {{slothlet: object, resolve: function(): (object|null)}|null} The record.
 * @internal
 * @example
 * const dispatch = versionDispatcherRecord(node);
 */
function versionDispatcherRecord(obj) {
	if (obj === null || (typeof obj !== "object" && typeof obj !== "function")) return null;
	return WeakMapMethods.get(VERSION_DISPATCHERS, obj) ?? null;
}

/**
 * Every Proxy slothlet makes on its own account (a context or principal view, a hook's thenable, the runtime's
 * `self`), so it is never taken for a module's own Proxy, whose traps are that module's code (#597).
 * @type {WeakSet<object>}
 * @private
 */
const SLOTHLET_PROXIES = new WeakSet();

/**
 * Record a Proxy as one slothlet made on its own account (see {@link isSlothletProxy}). No-op for non-objects.
 *
 * @param {*} proxy - The Proxy.
 * @returns {*} The same `proxy`, for call-site chaining.
 * @internal
 * @example
 * const view = markSlothletProxy(new Proxy(value, handler));
 */
function markSlothletProxy(proxy) {
	if (proxy !== null && (typeof proxy === "object" || typeof proxy === "function")) WeakSetMethods.add(SLOTHLET_PROXIES, proxy);
	return proxy;
}

/**
 * Whether a value is a Proxy slothlet made on its own account (see {@link markSlothletProxy}).
 *
 * @param {*} value - Candidate value.
 * @returns {boolean} True for slothlet's own Proxy.
 * @internal
 * @example
 * if (isSlothletProxy(value)) return value;
 */
export function isSlothletProxy(value) {
	return value !== null && (typeof value === "object" || typeof value === "function") && weakSetHas(SLOTHLET_PROXIES, value);
}

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (
		!mayTakeInternals(consumer, [
			"lib/builders/api-assignment",
			"lib/builders/api_builder",
			"lib/handlers/api-manager",
			"lib/handlers/hook-manager",
			"lib/handlers/permission-manager",
			"lib/handlers/routine-manager",
			"lib/handlers/trusted-root",
			"lib/handlers/unified-wrapper",
			"lib/handlers/unified-wrapper/run",
			"lib/handlers/version-manager",
			"lib/helpers/defaults",
			"lib/runtime/runtime",
			"lib/runtime/runtime-asynclocalstorage",
			"lib/runtime/runtime-livebindings",
			"slothlet"
		])
	)
		throw ownBindingsRefusal("lib/handlers/framework-internals", import.meta.url);
	return { markFrameworkInternal, markFrameworkRoutine, markSlothletProxy, registerVersionDispatcher, versionDispatcherRecord };
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
/** @type {typeof markFrameworkInternal} */
const guarded_markFrameworkInternal = guardInternal(markFrameworkInternal, "markFrameworkInternal", import.meta.url);
/** @type {typeof registerVersionDispatcher} */
const guarded_registerVersionDispatcher = guardInternal(registerVersionDispatcher, "registerVersionDispatcher", import.meta.url);
/** @type {typeof versionDispatcherRecord} */
const guarded_versionDispatcherRecord = guardInternal(versionDispatcherRecord, "versionDispatcherRecord", import.meta.url);
/** @type {typeof markSlothletProxy} */
const guarded_markSlothletProxy = guardInternal(markSlothletProxy, "markSlothletProxy", import.meta.url);
export {
	guarded_markFrameworkInternal as markFrameworkInternal,
	guarded_registerVersionDispatcher as registerVersionDispatcher,
	guarded_versionDispatcherRecord as versionDispatcherRecord,
	guarded_markSlothletProxy as markSlothletProxy
};
