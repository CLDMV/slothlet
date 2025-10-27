/**
 * Analyzes a module and returns processing decisions that both eager and lazy modes can use.
 * This centralizes the module loading logic from _loadSingleModule while allowing each mode
 * to handle the results according to their strategy (immediate materialization vs proxy creation).
 * @function analyzeModule
 * @internal
 * @package
 * @param {string} modulePath - Absolute path to the module file
 * @param {object} options - Analysis options
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @param {object} [options.instance] - Slothlet instance for accessing config and methods
 * @returns {Promise<{
 *   rawModule: object,
 *   processedModule: object,
 *   isFunction: boolean,
 *   hasDefault: boolean,
 *   isCjs: boolean,
 *   exports: Array<[string, any]>,
 *   defaultExportType: 'function'|'object'|null,
 *   shouldWrapAsCallable: boolean,
 *   namedExports: object,
 *   metadata: object
 * }>} Module analysis results
 * @example
 * // Analyze a module file
 * const analysis = await analyzeModule("./api/math.mjs", { instance });
 * // Eager mode: use analysis.processedModule directly
 * // Lazy mode: create proxy based on analysis.isFunction, analysis.exports, etc.
 */
export function analyzeModule(modulePath: string, options?: {
    debug?: boolean;
    instance?: object;
}): Promise<{
    rawModule: object;
    processedModule: object;
    isFunction: boolean;
    hasDefault: boolean;
    isCjs: boolean;
    exports: Array<[string, any]>;
    defaultExportType: "function" | "object" | null;
    shouldWrapAsCallable: boolean;
    namedExports: object;
    metadata: object;
}>;
/**
 * Processes module analysis results into a final module object using slothlet's established patterns.
 * This centralizes the processing logic while allowing both modes to apply the results differently.
 * @function processModuleFromAnalysis
 * @internal
 * @package
 * @param {object} analysis - Results from analyzeModule
 * @param {object} options - Processing options
 * @param {object} [options.instance] - Slothlet instance for accessing _toapiPathKey method
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {object} Processed module ready for API integration
 * @example
 * // Process analyzed module
 * const analysis = await analyzeModule(modulePath, { instance });
 * const processed = processModuleFromAnalysis(analysis, { instance });
 * // Both modes can use 'processed' but integrate it differently
 */
export function processModuleFromAnalysis(analysis: object, options?: {
    instance?: object;
    debug?: boolean;
}): object;
/**
 * Analyzes a directory and returns structural decisions that both eager and lazy modes can use.
 * This provides the decision-making logic for directory handling without implementing the actual
 * loading strategy (allowing lazy mode to create proxies while eager mode materializes).
 * @function analyzeDirectoryStructure
 * @internal
 * @package
 * @param {string} categoryPath - Absolute path to the directory
 * @param {object} options - Analysis options
 * @param {object} options.instance - Slothlet instance for accessing config and methods
 * @param {number} [options.currentDepth=0] - Current traversal depth
 * @param {number} [options.maxDepth=Infinity] - Maximum traversal depth
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {Promise<{
 *   isSingleFile: boolean,
 *   shouldAutoFlatten: boolean,
 *   categoryName: string,
 *   moduleFiles: Array<import('fs').Dirent>,
 *   subDirs: Array<import('fs').Dirent>,
 *   multiDefaultAnalysis: object,
 *   processingStrategy: 'single-file'|'multi-file'|'empty',
 *   flatteningHints: object
 * }>} Directory structure analysis
 * @example
 * // Analyze directory structure
 * const analysis = await analyzeDirectoryStructure(categoryPath, { instance });
 * if (analysis.isSingleFile) {
 *   // Both modes: handle as single file (but differently)
 * } else {
 *   // Both modes: handle as multi-file (but differently)
 * }
 */
export function analyzeDirectoryStructure(categoryPath: string, options?: {
    instance: object;
    currentDepth?: number;
    maxDepth?: number;
    debug?: boolean;
}): Promise<{
    isSingleFile: boolean;
    shouldAutoFlatten: boolean;
    categoryName: string;
    moduleFiles: Array<import("fs").Dirent>;
    subDirs: Array<import("fs").Dirent>;
    multiDefaultAnalysis: object;
    processingStrategy: "single-file" | "multi-file" | "empty";
    flatteningHints: object;
}>;
/**
 * Returns category building decisions and processed modules that both eager and lazy modes can use.
 * This provides all the structural information needed to build a category but lets each mode
 * implement the actual building strategy (materialization vs proxy creation).
 * @function getCategoryBuildingDecisions
 * @internal
 * @package
 * @param {string} categoryPath - Absolute path to the directory
 * @param {object} options - Building options
 * @param {object} options.instance - Slothlet instance for accessing config and methods
 * @param {number} [options.currentDepth=0] - Current traversal depth
 * @param {number} [options.maxDepth=Infinity] - Maximum traversal depth
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {Promise<{
 *   processingStrategy: 'single-file'|'multi-file'|'empty',
 *   categoryName: string,
 *   shouldFlattenSingle: boolean,
 *   processedModules: Array<{file: import('fs').Dirent, moduleName: string, processedModule: any, flattening: object}>,
 *   subDirectories: Array<{dirEntry: import('fs').Dirent, apiPathKey: string}>,
 *   multiDefaultAnalysis: object,
 *   flatteningDecisions: object,
 *   upwardFlatteningCandidate: {shouldFlatten: boolean, apiPathKey: string}
 * }>} Complete category building information
 * @example
 * // Get category building decisions
 * const decisions = await getCategoryBuildingDecisions(categoryPath, { instance });
 * if (decisions.processingStrategy === "single-file") {
 *   // Both modes: handle single file differently
 *   // Eager: return decisions.processedModules[0].processedModule
 *   // Lazy: create proxy based on decisions.processedModules[0].flattening
 * }
 */
export function getCategoryBuildingDecisions(categoryPath: string, options?: {
    instance: object;
    currentDepth?: number;
    maxDepth?: number;
    debug?: boolean;
}): Promise<{
    processingStrategy: "single-file" | "multi-file" | "empty";
    categoryName: string;
    shouldFlattenSingle: boolean;
    processedModules: Array<{
        file: import("fs").Dirent;
        moduleName: string;
        processedModule: any;
        flattening: object;
    }>;
    subDirectories: Array<{
        dirEntry: import("fs").Dirent;
        apiPathKey: string;
    }>;
    multiDefaultAnalysis: object;
    flatteningDecisions: object;
    upwardFlatteningCandidate: {
        shouldFlatten: boolean;
        apiPathKey: string;
    };
}>;
/**
 * Auto-flattening decision logic that determines whether a module should be flattened
 * based on filename matching, export patterns, and context.
 * @function getFlatteningDecision
 * @internal
 * @package
 * @param {object} options - Flattening analysis options
 * @param {object} options.mod - The loaded module object
 * @param {string} options.fileName - Original filename (without extension)
 * @param {string} options.apiPathKey - Sanitized API key for the module
 * @param {boolean} options.hasMultipleDefaultExports - Whether multiple default exports exist in the container
 * @param {boolean} options.isSelfReferential - Whether this is a self-referential export
 * @param {boolean} [options.moduleHasDefault] - Whether this specific module has a default export
 * @param {string} [options.categoryName] - Container/category name for context
 * @param {number} [options.totalModules=1] - Total number of modules in container
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {{
 *   shouldFlatten: boolean,
 *   flattenToRoot: boolean,
 *   flattenToCategory: boolean,
 *   preserveAsNamespace: boolean,
 *   useAutoFlattening: boolean,
 *   reason: string
 * }} Flattening decision result
 *
 * @description
 * Determines flattening behavior based on slothlet's established rules:
 *
 * 1. Self-referential exports: Never flatten (preserve as namespace)
 * 2. Multi-default context: Flatten modules WITHOUT defaults, preserve WITH defaults
 * 3. Single named export matching filename: Auto-flatten to use export directly
 * 4. Filename matches container: Flatten contents to container level
 * 5. Traditional context: Preserve as namespace unless auto-flattening applies
 *
 * @example
 * // Internal usage - single named export matching filename
 * const decision = getFlatteningDecision({
 *   mod: { math: { add: fn, multiply: fn } },
 *   fileName: "math", apiPathKey: "math",
 *   hasMultipleDefaultExports: false, isSelfReferential: false
 * });
 * // Returns: { shouldFlatten: true, useAutoFlattening: true, reason: "auto-flatten single named export" }
 */
export function getFlatteningDecision(options: {
    mod: object;
    fileName: string;
    apiPathKey: string;
    hasMultipleDefaultExports: boolean;
    isSelfReferential: boolean;
    moduleHasDefault?: boolean;
    categoryName?: string;
    totalModules?: number;
    debug?: boolean;
}): {
    shouldFlatten: boolean;
    flattenToRoot: boolean;
    flattenToCategory: boolean;
    preserveAsNamespace: boolean;
    useAutoFlattening: boolean;
    reason: string;
};
/**
 * Processes a single module and applies it to the target API object based on flattening decisions.
 * @function processModuleForAPI
 * @internal
 * @package
 * @param {object} options - Module processing options
 * @param {object} options.mod - The loaded module object
 * @param {string} options.fileName - Original filename (without extension)
 * @param {string} options.apiPathKey - Sanitized API key for the module
 * @param {boolean} options.hasMultipleDefaultExports - Whether multiple default exports exist
 * @param {boolean} options.isSelfReferential - Whether this is a self-referential export
 * @param {object} options.api - Target API object to modify (could be root api or categoryModules)
 * @param {function} [options.getRootDefault] - Function to get current root default function
 * @param {function} [options.setRootDefault] - Function to set the root default function
 * @param {object} [options.context] - Processing context
 * @param {boolean} [options.context.debug=false] - Enable debug logging
 * @param {string} [options.context.mode="unknown"] - Processing mode (root, subfolder, eager, lazy)
 * @param {string} [options.context.categoryName] - Container/category name
 * @param {number} [options.context.totalModules=1] - Total modules in container
 * @returns {{
 *   processed: boolean,
 *   rootDefaultSet: boolean,
 *   flattened: boolean,
 *   namespaced: boolean,
 *   apiAssignments: Record<string, any>
 * }} Processing result
 *
 * @description
 * Unified module processing logic that handles:
 * 1. Function default exports (multi-default, self-referential, traditional root contributor)
 * 2. Object/named exports with flattening decisions
 * 3. Export merging and namespace assignments
 * 4. Function name preference logic
 * 5. Root default function management
 *
 * @example
 * // Internal usage for root-level processing
 * const result = processModuleForAPI({
 *   mod, fileName, apiPathKey, hasMultipleDefaultExports, isSelfReferential, api,
 *   getRootDefault: () => rootDefaultFunction,
 *   setRootDefault: (fn) => { rootDefaultFunction = fn; },
 *   context: { debug: true, mode: "root", totalModules: 3 },
 *   originalAnalysis: { hasDefault: true, namedExportsCount: 2 }
 * });
 */
export function processModuleForAPI(options: {
    mod: object;
    fileName: string;
    apiPathKey: string;
    hasMultipleDefaultExports: boolean;
    isSelfReferential: boolean;
    api: object;
    getRootDefault?: Function;
    setRootDefault?: Function;
    context?: {
        debug?: boolean;
        mode?: string;
        categoryName?: string;
        totalModules?: number;
    };
}): {
    processed: boolean;
    rootDefaultSet: boolean;
    flattened: boolean;
    namespaced: boolean;
    apiAssignments: Record<string, any>;
};
/**
 * Handles function name preference logic for better API naming.
 * @function applyFunctionNamePreference
 * @internal
 * @package
 * @param {object} options - Name preference options
 * @param {object} options.mod - The loaded module object
 * @param {string} options.fileName - Original filename (without extension)
 * @param {string} options.apiPathKey - Sanitized API key
 * @param {object} options.categoryModules - Target category modules object
 * @param {function} options.toapiPathKey - Function to sanitize names to API keys
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {{hasPreferredName: boolean, preferredKey: string}} Name preference result
 *
 * @description
 * Implements slothlet's function name preference logic where the original function name
 * is preferred over the sanitized filename when they represent the same semantic meaning
 * but have different capitalization (e.g., autoIP vs autoIp, parseJSON vs parseJson).
 *
 * @example
 * // Internal usage in _buildCategory
 * const preference = applyFunctionNamePreference({
 *   mod: { autoIP: function autoIP() {} },
 *   fileName: "auto-ip", apiPathKey: "autoIp",
 *   categoryModules, toapiPathKey: this._toapiPathKey, debug: true
 * });
 * // Returns: { hasPreferredName: true, preferredKey: "autoIP" }
 */
export function applyFunctionNamePreference(options: {
    mod: object;
    fileName: string;
    apiPathKey: string;
    categoryModules: object;
    toapiPathKey: Function;
    debug?: boolean;
}): {
    hasPreferredName: boolean;
    preferredKey: string;
};
/**
 * Comprehensive category/directory building function that replaces _buildCategory.
 * Handles complete directory structure processing with all flattening rules.
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
/**
 * Centralized category building decisions - contains ALL logic for directory/category processing.
 * This function analyzes a directory and returns decisions about how to structure the API,
 * but doesn't actually build the API (allowing eager/lazy modes to implement differently).
 *
 * @function buildCategoryDecisions
 * @param {string} categoryPath - Path to the category directory
 * @param {object} options - Configuration options
 * @param {number} [options.currentDepth=0] - Current nesting depth
 * @param {number} [options.maxDepth=Infinity] - Maximum nesting depth
 * @param {string} [options.mode="eager"] - Loading mode ("eager" or "lazy")
 * @param {Function} [options.subdirHandler] - Handler for subdirectories (lazy mode)
 * @param {object} options.instance - Slothlet instance with _toapiPathKey, _shouldIncludeFile, config
 * @returns {Promise<object>} Category building decisions and data
 *
 * @example // ESM usage
 * import { buildCategoryDecisions } from "@cldmv/slothlet/helpers/api_builder";
 * const decisions = await buildCategoryDecisions("/path/to/category", {
 *   currentDepth: 1,
 *   instance: slothletInstance
 * });
 *
 * @example // CJS usage
 * const { buildCategoryDecisions } = require("@cldmv/slothlet/helpers/api_builder");
 * const decisions = await buildCategoryDecisions("/path/to/category", {
 *   currentDepth: 1,
 *   instance: slothletInstance
 * });
 */
export function buildCategoryDecisions(categoryPath: string, options?: {
    currentDepth?: number;
    maxDepth?: number;
    mode?: string;
    subdirHandler?: Function;
    instance: object;
}): Promise<object>;
//# sourceMappingURL=api_builder.d.mts.map