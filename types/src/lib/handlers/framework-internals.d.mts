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
export function isFrameworkMarkerKey(key: string): boolean;
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
export function markFrameworkInternal(obj: any): any;
/**
 * Whether `obj` is a branded slothlet-internal object (see {@link markFrameworkInternal}).
 *
 * @param {*} obj - Candidate object.
 * @returns {boolean} True when `obj` was branded by the framework.
 * @internal
 * @example
 * if (isFrameworkInternal(sourceApi)) markFrameworkInternal(resolveWrapper(targetApi));
 */
export function isFrameworkInternal(obj: any): boolean;
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
export function registerVersionDispatcher(dispatcher: object, record: {
    slothlet: object;
    resolve: () => (object | null);
}): object;
/**
 * The record of a version dispatcher ({@link registerVersionDispatcher}), or null for anything else.
 *
 * @param {*} obj - Candidate.
 * @returns {{slothlet: object, resolve: function(): (object|null)}|null} The record.
 * @internal
 * @example
 * const dispatch = versionDispatcherRecord(node);
 */
export function versionDispatcherRecord(obj: any): {
    slothlet: object;
    resolve: () => (object | null);
} | null;
//# sourceMappingURL=framework-internals.d.mts.map