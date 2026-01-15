/**
 * Converts a filename or folder name to camelCase for API property.
 * Extracted from slothlet._toapiPathKey for use in API building functions.
 *
 * @function toapiPathKey
 * @internal
 * @package
 * @param {string} name - The name to convert
 * @param {object} [sanitizeConfig={}] - Sanitization configuration
 * @returns {string} The camelCase version of the name
 *
 * @example
 * toapiPathKey('root-math') // 'rootMath'
 * toapiPathKey('auto-ip') // 'autoIP' (with proper config)
 */
export function toapiPathKey(name: string, sanitizeConfig?: object): string;
/**
 * Filters out files that should not be loaded by slothlet.
 * Extracted from slothlet._shouldIncludeFile for use in API building functions.
 *
 * @function shouldIncludeFile
 * @internal
 * @package
 * @param {object} entry - The directory entry to check
 * @returns {boolean} True if the file should be included, false if it should be excluded
 *
 * @example
 * const entries = await fs.readdir(dir, { withFileTypes: true });
 * const moduleFiles = entries.filter(e => shouldIncludeFile(e));
 */
export function shouldIncludeFile(entry: object): boolean;
/**
 * Comprehensive category/directory building function that replaces _buildCategory.
 * Handles complete directory structure processing with all flattening rules.
 *
 * @function buildCategoryStructure
 * @internal
 * @package
 * @async
 * @param {string} categoryPath - Absolute path to the category directory
 * @param {object} options - Building options
 * @param {number} [options.currentDepth=0] - Current recursion depth
 * @param {number} [options.maxDepth=Infinity] - Maximum recursion depth
 * @param {string} [options.mode="eager"] - Loading mode ("eager" or "lazy")
 * @param {function} [options.subdirHandler] - Custom subdirectory handler for lazy mode
 * @param {object} options.instance - Slothlet instance for access to helper methods
 * @returns {Promise<object>} Complete category API structure
 *
 * @description
 * Complete directory structure building pipeline that handles:
 * - Single-file vs multi-file directory processing
 * - Auto-flattening decisions for single files matching directory names
 * - Multi-default export detection and processing
 * - Self-referential export handling
 * - Recursive subdirectory traversal with depth control
 * - Function name preference over sanitized names
 * - All established slothlet flattening rules and conventions
 *
 * @example
 * // Internal usage - build complete category structure
 * const categoryApi = await buildCategoryStructure("/path/to/category", {
 *   currentDepth: 0, maxDepth: 3, mode: "eager", instance: slothletInstance
 * });
 */
export function buildCategoryStructure(categoryPath: string, options?: {
    currentDepth?: number;
    maxDepth?: number;
    mode?: string;
    subdirHandler?: Function;
    instance: object;
}): Promise<object>;
/**
 * Comprehensive root API building function that replaces eager/lazy create methods.
 * Handles complete root-level API construction with mode-specific optimizations.
 *
 * @function buildRootAPI
 * @internal
 * @package
 * @async
 * @param {string} dir - Root directory path to build API from
 * @param {object} options - Building options
 * @param {boolean} [options.lazy=false] - Whether to use lazy loading mode
 * @param {number} [options.maxDepth=Infinity] - Maximum recursion depth
 * @param {object} options.instance - Slothlet instance for access to helper methods
 * @returns {Promise<object|function>} Complete root API (object or function with properties)
 *
 * @description
 * Complete root API building pipeline that handles:
 * - Root-level module processing with multi-default detection
 * - Root contributor pattern (default function becomes callable API)
 * - Named export merging and flattening decisions
 * - Recursive directory structure building via buildCategoryStructure
 * - Mode-specific optimizations (eager vs lazy)
 * - All established slothlet API construction patterns
 *
 * @example
 * // Internal usage - build complete root API
 * const rootApi = await buildRootAPI("/path/to/api", {
 *   lazy: false, maxDepth: 3, instance: slothletInstance
 * });
 */
export function buildRootAPI(dir: string, options?: {
    lazy?: boolean;
    maxDepth?: number;
    instance: object;
}): Promise<object | Function>;
//# sourceMappingURL=construction.d.mts.map