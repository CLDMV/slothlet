/**
 * @function create
 * @internal
 * @package
 * @async
 * @alias module:@cldmv/slothlet.modes.lazy.create
 * @memberof module:@cldmv/slothlet.modes.lazy
 * @param {string} dir - Root directory
 * @param {number} [maxDepth=Infinity] - Maximum depth to traverse
 * @param {number} [currentDepth=0] - Current depth (for internal recursion only)
 * @returns {Promise<function|object>} Root API object or function (if default export)
 * @throws {Error} When module loading or directory traversal fails
 *
 * @description
 * Creates a lazy API structure. Root-level files are loaded immediately (mirrors eager).
 * Directories become lazy proxies. Nested directories remain lazy after materialization
 * via _buildCategory recursion with subdirHandler.
 *
 * @example
 * // Internal usage - called by slothlet core
 * const api = await create('./api_test', 3, 0);
 * // Returns: { math: [Function: lazyFolder_math], ... } (lazy proxies)
 *
 * @example
 * // Root-level processing with function exports
 * const api = await create('./api_test');
 * // If root has default function: api becomes that function with properties
 * // Otherwise: api is object with lazy proxy properties
 */
export function create(dir: string, maxDepth?: number, currentDepth?: number): Promise<Function | object>;
//# sourceMappingURL=slothlet_lazy.d.mts.map