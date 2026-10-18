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
 * Record a Proxy as one slothlet made on its own account (see {@link isSlothletProxy}). No-op for non-objects.
 *
 * @param {*} proxy - The Proxy.
 * @returns {*} The same `proxy`, for call-site chaining.
 * @internal
 * @example
 * const view = markSlothletProxy(new Proxy(value, handler));
 */
export function markSlothletProxy(proxy: any): any;
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
//# sourceMappingURL=framework-internals.d.mts.map