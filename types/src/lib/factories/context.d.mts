/**
 * Get context manager for specified runtime type
 * @param {string} runtime - Runtime type ("async" or "live")
 * @returns {Object} Context manager instance
 * @public
 */
export function getContextManager(runtime?: string): any;
/**
 * Default context manager (async)
 * @public
 */
export const contextManager: any;
/**
 * Async runtime for runtime exports
 * @public
 */
export const asyncRuntime: any;
/**
 * Live runtime for runtime exports
 * @public
 */
export const liveRuntime: any;
export { asyncContextManager, liveContextManager };
//# sourceMappingURL=context.d.mts.map