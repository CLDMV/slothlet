/**
 * Load a single module
 * @param {string} filePath - Path to module file
 * @returns {Promise<Object>} Loaded module
 * @public
 */
export function loadModule(filePath: string): Promise<any>;
/**
 * Scan directory for module files
 * @param {string} dir - Directory to scan
 * @param {Object} [options={}] - Scan options
 * @returns {Promise<Object>} Directory structure
 * @public
 */
export function scanDirectory(dir: string, options?: any): Promise<any>;
/**
 * Check if module has valid exports
 * @param {Object} module - Loaded module
 * @returns {boolean} True if module has exports
 * @public
 */
export function hasValidExports(module: any): boolean;
/**
 * Extract exports from module
 * @param {Object} module - Loaded module
 * @returns {Object} Extracted exports
 * @public
 */
export function extractExports(module: any): any;
/**
 * Merge extracted exports into an API object with smart flattening.
 * Handles the common pattern where export name matches module name.
 * @param {Object} target - Target API object to merge into
 * @param {Object} exports - Extracted exports from module
 * @param {string} propertyName - Property name to assign to (sanitized module name)
 * @returns {void}
 * @public
 */
export function mergeExportsIntoAPI(target: any, exports: any, propertyName: string): void;
//# sourceMappingURL=loader.d.mts.map