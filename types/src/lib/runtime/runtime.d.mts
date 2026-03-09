/**
 * Live binding to the current API (self-reference)
 * Proxies to the appropriate runtime's self export
 * @type {Proxy}
 * @public
 */
export const self: ProxyConstructor;
/**
 * User-provided context data for live bindings
 * Proxies to the appropriate runtime's context export
 * @type {Proxy}
 * @public
 */
export const context: ProxyConstructor;
/**
 * Current instance ID
 * Proxies to the appropriate runtime's instanceID export
 * @type {Proxy}
 * @public
 */
export const instanceID: ProxyConstructor;
//# sourceMappingURL=runtime.d.mts.map