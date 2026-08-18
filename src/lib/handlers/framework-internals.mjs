/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/framework-internals.mjs
 *	@Date: 2026-08-17 00:00:00 -07:00 (1786953600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-17 00:00:00 -07:00 (1786953600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Object-identity brand for slothlet's own framework-internal objects (#283).
 * @module @cldmv/slothlet/handlers/framework-internals
 * @internal
 *
 * @description
 * A module-private registry of objects slothlet ITSELF created and stamped with reserved internal
 * marker keys (currently a version dispatcher's `{ __isVersionDispatcher, __logicalPath }` target and
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

/**
 * Objects slothlet created and stamped with a framework-internal marker key. Weak so a branded
 * dispatcher/wrapper is never kept alive by the registry.
 * @type {WeakSet<object>}
 * @private
 */
const FRAMEWORK_INTERNAL = new WeakSet();

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
const FRAMEWORK_MARKER_KEYS = new Set(["__isVersionDispatcher", "__logicalPath"]);

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
	return FRAMEWORK_MARKER_KEYS.has(key);
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
export function markFrameworkInternal(obj) {
	if (obj !== null && (typeof obj === "object" || typeof obj === "function")) FRAMEWORK_INTERNAL.add(obj);
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
	return obj !== null && (typeof obj === "object" || typeof obj === "function") && FRAMEWORK_INTERNAL.has(obj);
}
