/**
 * Get context manager for specified runtime type
 * @param {string} runtime - Runtime type ("async" or "live")
 * @returns {Object} Context manager instance
 * @public
 */
export function getContextManager(runtime?: string): Object;
/**
 * Default context manager (async)
 * @public
 */
export const contextManager: import("#handlers/context-async").AsyncContextManager;
/**
 * Async runtime for runtime exports
 * @public
 */
export const asyncRuntime: import("#handlers/context-async").AsyncContextManager;
/**
 * Live runtime for runtime exports
 * @public
 */
export const liveRuntime: import("#handlers/context-live").LiveContextManager;
import { asyncContextManager } from "#handlers/context-async";
import { liveContextManager } from "#handlers/context-live";
export { asyncContextManager, liveContextManager };
//# sourceMappingURL=context.d.mts.map