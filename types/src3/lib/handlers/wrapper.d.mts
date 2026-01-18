/**
 * @fileoverview Universal function wrapper system with context isolation
 * @module @cldmv/slothlet/wrapper
 */
/**
 * Wraps API functions with context isolation and metadata
 * @public
 */
export class WrapperManager {
    /**
     * Create wrapper manager
     * @param {Object} contextManager - Context manager instance
     * @param {Object} instance - Slothlet instance for ownership lookups
     */
    constructor(contextManager: any, instance?: any);
    context: any;
    instance: any;
    /**
     * Create proxy-based wrapper for API with dynamic ownership lookups
     * @param {Object} api - API object to wrap
     * @param {string} instanceID - Instance ID for context
     * @param {string} [currentPath=""] - Current API path
     * @returns {Proxy} Proxied API object
     * @public
     */
    public wrapAPI(api: any, instanceID: string, currentPath?: string): ProxyConstructor;
    /**
     * Wrap single function with context
     * @param {Function} fn - Function to wrap
     * @param {string} instanceID - Instance ID for context
     * @param {string} apiPath - API path for this function
     * @returns {Function} Wrapped function
     * @public
     */
    public wrapFunction(fn: Function, instanceID: string, apiPath: string): Function;
    /**
     * Check if function is already wrapped
     * @param {Function} fn - Function to check
     * @returns {boolean} True if wrapped
     * @public
     */
    public isWrapped(fn: Function): boolean;
    /**
     * Unwrap function to get original
     * @param {Function} fn - Function to unwrap
     * @returns {Function} Original unwrapped function
     * @public
     */
    public unwrap(fn: Function): Function;
}
//# sourceMappingURL=wrapper.d.mts.map