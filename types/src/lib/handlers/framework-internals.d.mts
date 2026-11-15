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
 * Whether a value is a Proxy slothlet made on its own account (see {@link markSlothletProxy}).
 *
 * @param {*} value - Candidate value.
 * @returns {boolean} True for slothlet's own Proxy.
 * @internal
 * @example
 * if (isSlothletProxy(value)) return value;
 */
export function isSlothletProxy(value: any): boolean;
/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer: string): object;
/** @type {typeof markFrameworkInternal} */
declare const guarded_markFrameworkInternal: typeof markFrameworkInternal;
/** @type {typeof registerVersionDispatcher} */
declare const guarded_registerVersionDispatcher: typeof registerVersionDispatcher;
/** @type {typeof versionDispatcherRecord} */
declare const guarded_versionDispatcherRecord: typeof versionDispatcherRecord;
/** @type {typeof markSlothletProxy} */
declare const guarded_markSlothletProxy: typeof markSlothletProxy;
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
declare function markFrameworkInternal(obj: any): any;
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
declare function registerVersionDispatcher(dispatcher: object, record: {
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
declare function versionDispatcherRecord(obj: any): {
    slothlet: object;
    resolve: () => (object | null);
} | null;
/**
 * Record a Proxy as one slothlet made on its own account (see {@link isSlothletProxy}). No-op for non-objects.
 *
 * @param {*} proxy - The Proxy.
 * @returns {*} The same `proxy`, for call-site chaining.
 * @internal
 * @example
 * const view = markSlothletProxy(new Proxy(value, handler));
 */
declare function markSlothletProxy(proxy: any): any;
export { guarded_markFrameworkInternal as markFrameworkInternal, guarded_registerVersionDispatcher as registerVersionDispatcher, guarded_versionDispatcherRecord as versionDispatcherRecord, guarded_markSlothletProxy as markSlothletProxy };
//# sourceMappingURL=framework-internals.d.mts.map