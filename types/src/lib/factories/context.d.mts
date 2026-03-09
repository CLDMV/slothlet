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
export const contextManager: import("@cldmv/slothlet/handlers/context-async").AsyncContextManager;
/**
 * Async runtime for runtime exports
 * @public
 */
export const asyncRuntime: import("@cldmv/slothlet/handlers/context-async").AsyncContextManager;
/**
 * Live runtime for runtime exports
 * @public
 */
export const liveRuntime: import("@cldmv/slothlet/handlers/context-live").LiveContextManager;
import { asyncContextManager } from "@cldmv/slothlet/handlers/context-async";
import { liveContextManager } from "@cldmv/slothlet/handlers/context-live";
export { asyncContextManager, liveContextManager };
//# sourceMappingURL=context.d.mts.map