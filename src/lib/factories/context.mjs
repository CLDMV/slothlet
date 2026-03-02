/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/factories/context.mjs
 *	@Date: 2026-01-24 09:09:08 -08:00 (1737733748)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:36 -08:00 (1772425296)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Context management factory - selects appropriate manager based on runtime
 * @module @cldmv/slothlet/factories/context
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
