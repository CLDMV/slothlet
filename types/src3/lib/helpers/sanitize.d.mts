/**
 * Advanced sanitization function with configurable rule-based transformation
 *
 * @description
 * Converts arbitrary strings (filenames, path segments) into valid JavaScript identifiers
 * suitable for dot-notation property access. Supports sophisticated rule-based transformation
 * with glob patterns, case preservation, and intelligent segment handling.
 *
 * @param {string} input - String to sanitize
 * @param {Object} [options={}] - Sanitization configuration
 * @param {boolean} [options.lowerFirst=true] - Lowercase first character of first segment
 * @param {boolean} [options.preserveAllUpper=false] - Preserve all-uppercase identifiers
 * @param {boolean} [options.preserveAllLower=false] - Preserve all-lowercase identifiers
 * @param {Object} [options.rules={}] - Transformation rules
 * @param {string[]} [options.rules.leave=[]] - Preserve exactly (case-sensitive, supports globs)
 * @param {string[]} [options.rules.leaveInsensitive=[]] - Preserve exactly (case-insensitive, supports globs)
 * @param {string[]} [options.rules.upper=[]] - Force UPPERCASE (supports globs and **STRING**)
 * @param {string[]} [options.rules.lower=[]] - Force lowercase (supports globs and **STRING**)
 * @returns {string} Valid JavaScript identifier
 * @public
 *
 * @example
 * // Basic usage
 * sanitizePropertyName("auto-ip"); // "autoIp"
 * sanitizePropertyName("root-math"); // "rootMath"
 *
 * @example
 * // Rule-based transformation
 * sanitizePropertyName("auto-ip", {
 *   rules: { upper: ["*-ip"] }
 * }); // "autoIP"
 *
 * @example
 * // Boundary-requiring patterns
 * sanitizePropertyName("parseJsonData", {
 *   rules: { upper: ["**json**"] }
 * }); // "parseJSONData"
 *
 * @example
 * // Case preservation
 * sanitizePropertyName("COMMON_APPS", {
 *   preserveAllUpper: true
 * }); // "COMMON_APPS"
 *
 * @example
 * // Multiple rules
 * sanitizePropertyName("get-api-status", {
 *   rules: {
 *     upper: ["*-api-*", "http"],
 *     lower: ["xml"]
 *   }
 * }); // "getAPIStatus"
 */
export function sanitizePropertyName(input: string, options?: {
    lowerFirst?: boolean;
    preserveAllUpper?: boolean;
    preserveAllLower?: boolean;
    rules?: {
        leave?: string[];
        leaveInsensitive?: string[];
        upper?: string[];
        lower?: string[];
    };
}): string;
/**
 * Get module ID from file path
 * @param {string} filePath - Full file path
 * @param {string} baseDir - Base directory
 * @returns {string} Module ID
 * @public
 */
export function getModuleId(filePath: string, baseDir: string): string;
/**
 * Check if filename represents a special function name that should preserve case
 * @param {string} name - Name to check
 * @returns {boolean} True if special case should be preserved
 * @private
 */
export function shouldPreserveFunctionCase(name: string): boolean;
//# sourceMappingURL=sanitize.d.mts.map