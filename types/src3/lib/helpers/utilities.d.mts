/**
 * @fileoverview General utility functions
 * @module @cldmv/slothlet/helpers/utilities
 */
/**
 * Check if value is a plain object
 * @param {*} obj - Value to check
 * @returns {boolean} True if plain object
 * @public
 */
export function isPlainObject(obj: any): boolean;
/**
 * Deep merge objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 * @public
 */
export function deepMerge(target: any, source: any): any;
/**
 * Generate unique ID
 * @returns {string} Unique identifier
 * @public
 */
export function generateId(): string;
/**
 * Check if path is absolute
 * @param {string} path - Path to check
 * @returns {boolean} True if absolute path
 * @public
 */
export function isAbsolutePath(path: string): boolean;
//# sourceMappingURL=utilities.d.mts.map