/**
 * Analyzes module files to detect multi-default and self-referential patterns.
 * @internal
 * @private
 * @param {Array<{name: string}>} moduleFiles - Array of module file objects with name property
 * @param {string} baseDir - Base directory path containing the modules
 * @param {boolean} [debug=false] - Enable debug logging
 * @returns {Promise<{
 *   totalDefaultExports: number,
 *   hasMultipleDefaultExports: boolean,
 *   selfReferentialFiles: Set<string>,
 *   rawModuleCache: Map<string, object>,
 *   defaultExportFiles: Array<{fileName: string, rawModule: object}>
 * }>} Analysis results
 * @example // Internal usage in slothlet modes
 * const analysis = await multidefault_analyzeModules(moduleFiles, categoryPath, config.debug);
 * if (analysis.hasMultipleDefaultExports) {
 *   // Handle multi-default context
 * }
 */
export function multidefault_analyzeModules(moduleFiles: Array<{
    name: string;
}>, baseDir: string, debug?: boolean): Promise<{
    totalDefaultExports: number;
    hasMultipleDefaultExports: boolean;
    selfReferentialFiles: Set<string>;
    rawModuleCache: Map<string, object>;
    defaultExportFiles: Array<{
        fileName: string;
        rawModule: object;
    }>;
}>;
/**
 * Checks if a raw module's default export is self-referential (points to a named export).
 * @internal
 * @private
 * @param {object} rawModule - Raw module object to check
 * @returns {boolean} True if default export points to a named export
 * @example // Internal usage
 * const isSelfRef = multidefault_isSelfReferential(rawModule);
 */
export function multidefault_isSelfReferential(rawModule: object): boolean;
/**
 * Determines auto-flattening behavior based on multi-default context and module structure.
 * @internal
 * @private
 * @param {object} options - Configuration options
 * @param {boolean} options.hasMultipleDefaultExports - Whether multiple default exports exist
 * @param {boolean} options.moduleHasDefault - Whether current module has default export
 * @param {boolean} options.isSelfReferential - Whether current module is self-referential
 * @param {Array<string>} options.moduleKeys - Named export keys from the module
 * @param {string} options.apiPathKey - API key for the module
 * @param {number} options.totalModuleCount - Total number of modules in directory
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {{
 *   shouldFlatten: boolean,
 *   flattenToRoot: boolean,
 *   preserveAsNamespace: boolean,
 *   reason: string
 * }} Flattening decision and reasoning
 * @example // Internal usage in processing logic
 * const decision = multidefault_getFlatteningDecision({
 *   hasMultipleDefaultExports: true,
 *   moduleHasDefault: false,
 *   isSelfReferential: false,
 *   moduleKeys: ["add", "subtract"],
 *   apiPathKey: "math",
 *   totalModuleCount: 3
 * });
 */
export function multidefault_getFlatteningDecision(options: {
    hasMultipleDefaultExports: boolean;
    moduleHasDefault: boolean;
    isSelfReferential: boolean;
    moduleKeys: Array<string>;
    apiPathKey: string;
    totalModuleCount: number;
    debug?: boolean;
}): {
    shouldFlatten: boolean;
    flattenToRoot: boolean;
    preserveAsNamespace: boolean;
    reason: string;
};
//# sourceMappingURL=multidefault.d.mts.map