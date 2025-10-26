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
export default function slothlet(options?: {
    dir?: string;
    lazy?: boolean;
    apiDepth?: number;
    debug?: boolean;
    mode?: string;
    api_mode?: string;
    context?: object;
    reference?: object;
}): Promise<Function | object>;
//# sourceMappingURL=index.d.mts.map