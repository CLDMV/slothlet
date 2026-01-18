/**
 * Core flattening decision function.
 * Implements conditions C01-C07 from getFlatteningDecision().
 * @param {object} options - Decision options
 * @param {object} options.mod - Module exports
 * @param {string} options.moduleName - Sanitized module name
 * @param {string} options.categoryName - Category/folder name
 * @param {object} options.analysis - Export analysis
 * @param {boolean} options.hasMultipleDefaults - Multiple defaults in folder
 * @param {array} options.moduleKeys - Keys from module
 * @returns {object} Flattening decision
 * @public
 */
export function getFlatteningDecision(options: {
    mod: object;
    moduleName: string;
    categoryName: string;
    analysis: object;
    hasMultipleDefaults: boolean;
    moduleKeys: any[];
}): object;
/**
 * Process module for API assignment.
 * Implements conditions C08-C09b from processModuleForAPI().
 * @param {object} options - Processing options
 * @param {object} options.mod - Module exports
 * @param {object} options.decision - Flattening decision from getFlatteningDecision
 * @param {string} options.apiPathKey - API path key
 * @param {array} options.moduleKeys - Module export keys
 * @param {boolean} options.isSelfReferential - Whether module is self-referential
 * @returns {object} API assignments and metadata
 * @public
 */
export function processModuleForAPI(options: {
    mod: object;
    decision: object;
    apiPathKey: string;
    moduleKeys: any[];
    isSelfReferential: boolean;
}): object;
/**
 * Build category-level flattening decisions.
 * Implements conditions C10-C18 from buildCategoryDecisions().
 * @param {object} options - Category options
 * @param {string} options.categoryName - Category name
 * @param {object} options.mod - Module exports
 * @param {string} options.moduleName - Module name
 * @param {string} options.fileBaseName - File base name
 * @param {object} options.analysis - Export analysis
 * @param {array} options.moduleKeys - Module keys
 * @param {number} options.currentDepth - Current depth
 * @param {array} options.moduleFiles - Files in category
 * @returns {object} Category decision
 * @public
 */
export function buildCategoryDecisions(options: {
    categoryName: string;
    mod: object;
    moduleName: string;
    fileBaseName: string;
    analysis: object;
    moduleKeys: any[];
    currentDepth: number;
    moduleFiles: any[];
}): object;
//# sourceMappingURL=flatten.d.mts.map