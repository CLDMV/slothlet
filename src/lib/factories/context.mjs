/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/factories/context.mjs
 *	@Date: 2026-01-24T09:09:08-08:00 (1769274548)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:51-07:00 (1791090891)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Context management factory - selects appropriate manager based on runtime
 * @module @cldmv/slothlet/factories/context
 * @internal
 */
import { asyncContextManager } from "#handlers/context-async";
import { liveContextManager } from "#handlers/context-live";

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
