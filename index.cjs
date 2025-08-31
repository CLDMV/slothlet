/**
 * @fileoverview CommonJS entry point for @cldmv/slothlet with automatic source/dist detection and live-binding context.
 * @module @cldmv/slothlet
 */

const runtimePromise = import("@cldmv/slothlet/runtime");
const modPromise = import("@cldmv/slothlet/slothlet");

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
 * @example // CJS
 * const slothlet = require('@cldmv/slothlet');
 * const api = await slothlet({ dir: './api', context: { user: 'alice' } });
 * console.log(api.config.username); // Access configuration
 */
async function slothlet(options = {}) {
	const [runtime, mod] = await Promise.all([runtimePromise, modPromise]);
	const { makeWrapper } = runtime;
	const build = mod.slothlet ?? mod.default;

	const api = await build(options);

	// Prefer an explicit instance context the internal attached to the API (api.__ctx),
	// else fall back to module-level pieces if you expose them.
	const ctx = api?.__ctx ?? { self: mod.self, context: mod.context, reference: mod.reference };

	// console.log("[DEBUG index.cjs] Context setup:", {
	// 	hasApiCtx: !!api?.__ctx,
	// 	ctxSelfType: typeof ctx.self,
	// 	ctxSelfKeys: Object.keys(ctx.self || {}),
	// 	ctxContextType: typeof ctx.context,
	// 	ctxContextKeys: Object.keys(ctx.context || {}),
	// 	ctxReferenceType: typeof ctx.reference,
	// 	ctxReferenceKeys: Object.keys(ctx.reference || {}),
	// 	fallbackToMod: !api?.__ctx
	// });

	return makeWrapper(ctx)(api);
}

/**
 * CommonJS default export of the slothlet function.
 * @public
 */
module.exports = slothlet;

/**
 * Named export alias for the slothlet function.
 * Provides the same functionality as the default export.
 * @public
 * @type {Function}
 *
 * @example // CJS named destructuring
 * const { slothlet } = require('@cldmv/slothlet');
 * const api = await slothlet({ dir: './api' });
 */
module.exports.slothlet = slothlet; // optional named alias
