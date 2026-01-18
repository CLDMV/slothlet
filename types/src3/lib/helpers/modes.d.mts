/**
 * Process root files and detect root contributor pattern
 * @param {Object} api - API object being built
 * @param {Array} files - Root files from scanner
 * @param {Object} ownership - Ownership manager
 * @param {Object} config - Configuration
 * @param {string} mode - Mode name for debug messages
 * @returns {Promise<Function|null>} Root contributor function if found
 * @public
 */
export function processRootFiles(api: any, files: any[], ownership: any, config: any, mode: string): Promise<Function | null>;
/**
 * Apply root contributor pattern - merge API into root function
 * @param {Object} api - API object with properties
 * @param {Function|null} rootFunction - Root contributor function
 * @param {Object} config - Configuration
 * @param {string} mode - Mode name for debug messages
 * @returns {Promise<Object|Function>} Final API (function if root contributor, object otherwise)
 * @public
 */
export function applyRootContributor(api: any, rootFunction: Function | null, config: any, mode: string): Promise<any | Function>;
//# sourceMappingURL=modes.d.mts.map