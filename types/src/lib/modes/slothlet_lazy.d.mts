/**
 * Creates a lazy API that materializes paths on demand using look-ahead strategy.
 * @async
 * @param {string} dir - Directory path.
 * @param {boolean} [rootLevel=true] - Is this the root level?
 * @param {number} [maxDepth=Infinity] - Maximum depth to traverse
 * @param {number} [currentDepth=0] - Current traversal depth
 * @returns {object} Lazy API that materializes on access.
 * @private
 * @internal
 *
 * @example
 * // Basic slothlet usage with lazy loading
 * import slothlet from '@cldmv/slothlet';
 * const api = await slothlet({ dir: './api_test', lazy: true });
 *
 * // Initial API structure - modules are lazy-loaded proxies
 * console.log(typeof api.math); // 'function' (proxy function)
 * console.log(api.math.name);   // 'lazyFolder_math'
 *
 * @example
 * // Accessing a function triggers materialization
 * const result = await api.math.add(2, 3); // Materializes math module
 * console.log(result); // 5
 *
 * // After materialization - proxy is replaced with actual module
 * console.log(typeof api.math); // 'object'
 * console.log(Object.keys(api.math)); // ['add', 'multiply']
 */
export function create(dir: string, rootLevel?: boolean, maxDepth?: number, currentDepth?: number): object;
//# sourceMappingURL=slothlet_lazy.d.mts.map