/**
 * @fileoverview Context management - exports appropriate manager based on runtime
 * @module @cldmv/slothlet/handlers/context
 */
import { asyncContextManager } from "@cldmv/slothlet/handlers/context-async";
import { liveContextManager } from "@cldmv/slothlet/handlers/context-live";

/**
 * Get context manager for specified runtime type
 * @param {string} runtime - Runtime type ("async" or "live")
 * @returns {Object} Context manager instance
 * @public
 */
export function getContextManager(runtime = "async") {
	return runtime === "live" ? liveContextManager : asyncContextManager;
}

/**
 * Default context manager (async)
 * @public
 */
export const contextManager = asyncContextManager;

/**
 * Async runtime for runtime exports
 * @public
 */
export const asyncRuntime = asyncContextManager;

/**
 * Live runtime for runtime exports
 * @public
 */
export const liveRuntime = liveContextManager;

/**
 * Export both managers
 * @public
 */
export { asyncContextManager, liveContextManager };
