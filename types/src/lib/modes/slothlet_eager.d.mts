/**
 * Creates the eager API for slothlet (mode: eager).
 * @async
 * @param {string} dir - Directory to load.
 * @param {boolean} [rootLevel=true] - Is this the root level?
 * @param {number} [maxDepth=Infinity] - Maximum depth to traverse
 * @param {number} [currentDepth=0] - Current traversal depth
 * @returns {Promise<object>} API object
 * @private
 * @internal
 *
 * @example
 * // Internal usage - called by slothlet core
 * const api = await create('./api_test', true, 3, 0);
 * // Returns: { math: { add: [Function], multiply: [Function] }, ... }
 *
 * @example
 * // Root-level processing with function exports
 * const api = await create('./api_test', true);
 * // If root has default function: api becomes that function with properties
 * // Otherwise: api is object with module properties
 */
export function create(dir: string, rootLevel?: boolean, maxDepth?: number, currentDepth?: number): Promise<object>;
/**
 * Builds a complete API object from raw modules in eager mode.
 * @param {object} apiModules - Raw API modules to build
 * @returns {object} Complete API object with callable functions
 * @private
 * @internal
 * @example
 * // Internal usage by eager mode
 * const completeApi = _buildCompleteApi(rawModules);
 * // Converts: { math: { default: fn, add: fn } }
 * // To: { math: callableFunction with .add property }
 */
export function _buildCompleteApi(apiModules: object): object;
//# sourceMappingURL=slothlet_eager.d.mts.map