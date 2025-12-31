/**
 * Helper function to check if a value is likely serializable without calling JSON.stringify.
 * Used by toJSON methods to avoid expensive serialization attempts on complex objects.
 *
 * @internal
 * @private
 * @param {*} val - The value to check for serializability
 * @returns {boolean} True if the value is likely serializable, false otherwise
 */
export function isLikelySerializable(val: any): boolean;
/**
 * Analyzes a module and returns processing decisions that both eager and lazy modes can use.
 * This centralizes the module loading logic from _loadSingleModule while allowing each mode
 * to handle the results according to their strategy (immediate materialization vs proxy creation).
 *
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
 *
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
 *
 * @function processModuleFromAnalysis
 * @internal
 * @package
 * @param {object} analysis - Results from analyzeModule
 * @param {object} options - Processing options
 * @param {object} [options.instance] - Slothlet instance for accessing _toapiPathKey method
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {object} Processed module ready for API integration
 *
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
 *
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
 *
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
 *
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
 *
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
//# sourceMappingURL=api_builder_analysis.d.mts.map