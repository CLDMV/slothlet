/**
 * @function eager_wrapWithRunCtx
 * @internal
 * @package
 * @alias module:@cldmv/slothlet.modes.eager.eager_wrapWithRunCtx
 * @memberof module:@cldmv/slothlet.modes.eager
 * @param {*} obj - The object/function to wrap
 * @param {object} instance - The slothlet instance that will have boundapi.__ctx attached
 * @returns {*} The wrapped object/function
 *
 * @description
 * Recursively wraps all functions in an object with runWithCtx for eager mode.
 * This makes eager mode use the same call stack optimization as lazy mode.
 *
 * @example
 * // Wrapping a function
 * const wrappedFn = eager_wrapWithRunCtx(originalFunction, instance);
 *
 * @example
 * // Wrapping an object with nested functions
 * const wrappedObj = eager_wrapWithRunCtx({ method: fn }, instance);
 *
 * @example
 * // Wrapping a function
 * const wrappedFn = eager_wrapWithRunCtx(originalFunction, instance);
 *
 * @example
 * // Wrapping an object with nested functions
 * const wrappedObj = eager_wrapWithRunCtx({ method: fn }, instance);
 * const wrappedFn = eager_wrapWithRunCtx(originalFunction, instance);
 *
 * @example
 * // Wrapping an object with nested functions
 * const wrappedObj = eager_wrapWithRunCtx({ method: fn }, instance);
 */
/**
 * @function create
 * @internal
 * @package
 * @async
 * @alias module:@cldmv/slothlet.modes.eager.create
 * @memberof module:@cldmv/slothlet.modes.eager
 * @param {string} dir - Directory to load
 * @param {number} [maxDepth=Infinity] - Maximum depth to traverse
 * @param {number} [currentDepth=0] - Current traversal depth
 * @returns {Promise<object>} Complete API object with all modules loaded
 * @throws {Error} When module loading or directory traversal fails
 *
 * @description
 * Creates the eager API for slothlet (mode: eager).
 * Immediately loads all modules and constructs the complete API structure.
 *
 * @example
 * // Internal usage - called by slothlet core
 * const api = await create('./api_test', 3, 0);
 * // Returns: { math: { add: [Function], multiply: [Function] }, ... }
 *
 * @example
 * // Root-level processing with function exports
 * const api = await create('./api_test');
 * // If root has default function: api becomes that function with properties
 * // Otherwise: api is object with module properties
 */
export function create(dir: string, maxDepth?: number, currentDepth?: number): Promise<object>;
//# sourceMappingURL=slothlet_eager.d.mts.map