/**
 * @fileoverview ESM entry point for @cldmv/slothlet with automatic source/dist detection and live-binding context.
 * @module @cldmv/slothlet
 */

// Development environment check (must happen before slothlet imports)
(async () => {
	try {
		await import("@cldmv/slothlet/devcheck");
	} catch {
		// ignore
	}
})();

/**
 * Creates a slothlet API instance with live-binding context and AsyncLocalStorage support.
 * Automatically wraps all API functions with context isolation for multi-instance support.
 * @public
 * @async
 *
 * @param {object} [options={}] - Configuration options for the slothlet instance
 * @param {string} [options.dir="api"] - Directory to load API modules from
 * @param {boolean} [options.lazy=false] - Use lazy loading (true) or eager loading (false)
 * @param {number} [options.apiDepth=Infinity] - Maximum directory depth to scan
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @param {string} [options.mode="singleton"] - Execution mode (singleton, vm, worker, fork)
 * @param {string} [options.api_mode="auto"] - API structure mode (auto, function, object)
 * @param {object} [options.context={}] - Context data for live bindings
 * @param {object} [options.reference={}] - Reference objects to merge into API root
 * @returns {Promise<function|object>} The bound API object with live-binding context
 *
 * @example // ESM
 * import slothlet from "@cldmv/slothlet";
 * const api = await slothlet({ dir: './api', lazy: true });
 * const result = await api.math.add(2, 3); // 5
 *
 */
export default async function slothlet(options = {}) {
	// Dynamic imports after environment check
	const [runtime, mod] = await Promise.all([import("@cldmv/slothlet/runtime"), import("@cldmv/slothlet/slothlet")]);

	const { makeWrapper } = runtime;
	const build = mod.slothlet ?? mod.default;

	const api = await build(options);

	// Prefer an explicit instance context the internal attached to the API (api.__ctx),
	// else fall back to module-level pieces if you expose them.
	const ctx = api?.__ctx ?? { self: mod.self, context: mod.context, reference: mod.reference };

	// console.log("[DEBUG index.mjs] Context setup:", {
	// 	hasApiCtx: !!api?.__ctx,
	// 	ctxSelfType: typeof ctx.self,
	// 	ctxSelfKeys: Object.keys(ctx.self || {}),
	// 	ctxContextType: typeof ctx.context,
	// 	ctxContextKeys: Object.keys(ctx.context || {}),
	// 	ctxReferenceType: typeof ctx.reference,
	// 	ctxReferenceKeys: Object.keys(ctx.reference || {}),
	// 	fallbackToMod: !api?.__ctx
	// });
	// return api;
	return makeWrapper(ctx)(api);
}

/**
 * Named export alias for the default slothlet function.
 * Provides the same functionality as the default export.
 * @public
 * @type {Function}
 *
 * @example // ESM named import
 * import { slothlet } from "@cldmv/slothlet";
 * const api = await slothlet({ dir: './api' });
 */
// Optional named alias
export { slothlet };
