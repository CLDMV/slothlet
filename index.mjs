/**
 * @fileoverview ESM entry point for @cldmv/slothlet with automatic source/dist detection and live-binding context.
 * @module @cldmv/slothlet
 */

/**
 * Normalize runtime input to internal standard format.
 * @function normalizeRuntimeType
 * @param {string} runtime - Input runtime type (various formats accepted)
 * @returns {string} Normalized runtime type ("async" or "live")
 * @internal
 * @private
 */
function normalizeRuntimeType(runtime) {
	if (!runtime || typeof runtime !== "string") {
		return "async"; // Default to AsyncLocalStorage
	}

	const normalized = runtime.toLowerCase().trim();

	// AsyncLocalStorage runtime variants
	if (normalized === "async" || normalized === "asynclocal" || normalized === "asynclocalstorage") {
		return "async";
	}

	// Live bindings runtime variants
	if (normalized === "live" || normalized === "livebindings" || normalized === "experimental") {
		return "live";
	}

	// Default to async for unknown values
	return "async";
}

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
	// Dynamic imports after environment check
	const mod = await import("@cldmv/slothlet/slothlet");

	const build = mod.slothlet ?? mod.default;

	const api = await build(options);

	// Use the same runtime selection logic as slothlet.mjs
	const normalizedRuntime = normalizeRuntimeType(options.runtime);
	let runtimeModule;
	if (normalizedRuntime === "live") {
		runtimeModule = await import("@cldmv/slothlet/runtime/live");
	} else {
		// Default to AsyncLocalStorage runtime (original master branch implementation)
		runtimeModule = await import("@cldmv/slothlet/runtime/async");
	}
	const { makeWrapper } = runtimeModule;

	// Prefer an explicit instance context the internal attached to the API (api.__ctx),
	// else fall back to module-level pieces if you expose them.
	const ctx = api?.__ctx ?? { self: mod.self, context: mod.context, reference: mod.reference };

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
