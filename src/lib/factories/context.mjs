/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/factories/context.mjs
 *	@Date: 2026-01-24T09:09:08-08:00 (1769274548)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:37-08:00 (1795869037)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Context management factory - selects appropriate manager based on runtime
 * @module @cldmv/slothlet/factories/context
 * @internal
 */
import { internals as contextAsyncInternals } from "#handlers/context-async";
import { internals as contextLiveInternals } from "#handlers/context-live";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "#helpers/instance-imports";
const contextAsyncOwn = contextAsyncInternals("lib/factories/context");
const contextLiveOwn = contextLiveInternals("lib/factories/context");

/**
 * Get context manager for specified runtime type
 * @param {string} runtime - Runtime type ("async" or "live")
 * @returns {Object} Context manager instance
 * @public
 */
function getContextManager(runtime = "async") {
	return runtime === "live" ? contextLiveOwn.liveContextManager : contextAsyncOwn.asyncContextManager;
}

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (
		!mayTakeInternals(consumer, [
			"lib/runtime/runtime",
			"lib/runtime/runtime-asynclocalstorage",
			"lib/runtime/runtime-livebindings",
			"slothlet"
		])
	)
		throw ownBindingsRefusal("lib/factories/context", import.meta.url);
	return { getContextManager, asyncRuntime: contextAsyncOwn.asyncContextManager, liveRuntime: contextLiveOwn.liveContextManager };
}

/**
 * The files of slothlet's own that took this file's bindings (see {@link internals}). A `var` with no initializer, so a
 * file can take them before this file's top level has run (a cycle of slothlet's own files), and that run does not reset
 * what was taken.
 * @type {object|undefined}
 * @private
 */
var internalsTaken;

/**
 * Whether a file may take this file's bindings: it is one of those listed, and has not taken them yet. Reads no import
 * and no built-in a module can replace, so it answers the same before this file's imports are ready and after.
 * @param {string} consumer - The file asking.
 * @param {string[]} consumers - The files that take them.
 * @returns {boolean} True, once, for each file listed.
 * @private
 */
function mayTakeInternals(consumer, consumers) {
	if (internalsTaken === undefined) internalsTaken = { __proto__: null };
	let listed = false;
	for (let i = 0; i < consumers.length; i++) if (consumers[i] === consumer) listed = true;
	if (!listed || typeof consumer !== "string") return false;
	// Taken already: only a second evaluation of that very file, at its own top level, takes them again.
	if (internalsTaken[consumer] === true) return isOwnTopLevelOf(consumer);
	internalsTaken[consumer] = true;
	return true;
}

// The exports below answer slothlet's own files and the host only (see `guardInternal` in `helpers/instance-imports`):
// the managers are the same guarded objects `handlers/context-async` and `handlers/context-live` export.

/**
 * Get context manager for specified runtime type: the guarded manager (see `guardInternal`).
 * @param {string} runtime - Runtime type ("async" or "live")
 * @returns {Object} Context manager instance
 * @public
 * @type {typeof getContextManager}
 */
const guarded_getContextManager = guardInternal(
	(runtime = "async") =>
		guardInternal(getContextManager(runtime), runtime === "live" ? "liveContextManager" : "asyncContextManager", import.meta.url),
	"getContextManager",
	import.meta.url
);

/**
 * Default context manager (async)
 * @type {import("#handlers/context-async").AsyncContextManager}
 * @public
 */
export const contextManager = guardInternal(contextAsyncOwn.asyncContextManager, "asyncContextManager", import.meta.url);

/**
 * Async runtime for runtime exports
 * @type {import("#handlers/context-async").AsyncContextManager}
 * @public
 */
export const asyncRuntime = contextManager;

/**
 * Live runtime for runtime exports
 * @type {import("#handlers/context-live").LiveContextManager}
 * @public
 */
export const liveRuntime = guardInternal(contextLiveOwn.liveContextManager, "liveContextManager", import.meta.url);

/**
 * Export both managers
 * @public
 */
export { guarded_getContextManager as getContextManager, asyncRuntime as asyncContextManager, liveRuntime as liveContextManager };
