/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer: string): object;
/**
 * Default context manager (async)
 * @type {import("#handlers/context-async").AsyncContextManager}
 * @public
 */
export const contextManager: import("#handlers/context-async").AsyncContextManager;
/**
 * Async runtime for runtime exports
 * @type {import("#handlers/context-async").AsyncContextManager}
 * @public
 */
export const asyncRuntime: import("#handlers/context-async").AsyncContextManager;
/**
 * Live runtime for runtime exports
 * @type {import("#handlers/context-live").LiveContextManager}
 * @public
 */
export const liveRuntime: import("#handlers/context-live").LiveContextManager;
/**
 * Get context manager for specified runtime type: the guarded manager (see `guardInternal`).
 * @param {string} runtime - Runtime type ("async" or "live")
 * @returns {Object} Context manager instance
 * @public
 * @type {typeof getContextManager}
 */
declare const guarded_getContextManager: typeof getContextManager;
/**
 * Get context manager for specified runtime type
 * @param {string} runtime - Runtime type ("async" or "live")
 * @returns {Object} Context manager instance
 * @public
 */
declare function getContextManager(runtime?: string): Object;
export { guarded_getContextManager as getContextManager, asyncRuntime as asyncContextManager, liveRuntime as liveContextManager };
//# sourceMappingURL=context.d.mts.map