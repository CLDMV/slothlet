/**
 * Auto-flattening decision logic that determines whether a module should be flattened
 * based on filename matching, export patterns, and context.
 *
 * @function getFlatteningDecision
 * @internal
 * @package
 * @param {object} options - Flattening analysis options
 * @param {object} options.mod - The loaded module object
 * @param {string} options.fileName - Original filename (without extension)
 * @param {string} options.apiPathKey - Sanitized API key for the module
 * @param {boolean} options.hasMultipleDefaultExports - Whether multiple default exports exist in the container
 * @param {boolean} options.isSelfReferential - Whether this is a self-referential export
 * @param {boolean} [options.moduleHasDefault] - Whether this specific module has a default export.
 *   Should use originalAnalysis.hasDefault when available for accuracy, as !!mod.default
 *   may be inaccurate after processModuleFromAnalysis modifies module structure.
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
 * Handles function name preference logic for better API naming.
 *
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
 * Processes a single module and applies it to the target API object based on flattening decisions.
 *
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
 * Centralized category building decisions - contains ALL logic for directory/category processing.
 * This function analyzes a directory and returns decisions about how to structure the API,
 * but doesn't actually build the API (allowing eager/lazy modes to implement differently).
 *
 * @function buildCategoryDecisions
 * @internal
 * @package
 * @param {string} categoryPath - Path to the category directory
 * @param {object} options - Configuration options
 * @param {number} [options.currentDepth=0] - Current nesting depth
 * @param {number} [options.maxDepth=Infinity] - Maximum nesting depth
 * @param {string} [options.mode="eager"] - Loading mode ("eager" or "lazy")
 * @param {Function} [options.subdirHandler] - Handler for subdirectories (lazy mode)
 * @param {object} options.instance - Slothlet instance with _toapiPathKey, _shouldIncludeFile, config
 * @returns {Promise<object>} Category building decisions and data
 *
 * @example
 * // ESM usage
 * import { buildCategoryDecisions } from "@cldmv/slothlet/helpers/api_builder_decisions";
 * const decisions = await buildCategoryDecisions("/path/to/category", {
 *   currentDepth: 1,
 *   instance: slothletInstance
 * });
 *
 * @example
 * // CJS usage
 * const { buildCategoryDecisions } = require("@cldmv/slothlet/helpers/api_builder_decisions");
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
//# sourceMappingURL=api_builder_decisions.d.mts.map