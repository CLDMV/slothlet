/**
 * Turn a file or folder name into the api property name slothlet gives it. Consumers import it as `sanitize` from
 * `@cldmv/slothlet/sanitize`.
 * @param {string} input - Input string to sanitize
 * @param {object} options - Sanitization options
 * @returns {string} Sanitized property name
 * @public
 */
export function sanitizePropertyName(input: string, options?: object): string;
/**
 * Advanced filename sanitization with rule-based transformation
 * @extends ComponentBase
 * @public
 */
export class Sanitize extends ComponentBase {
    static slothletProperty: string;
    /**
     * Advanced sanitization function with configurable rule-based transformation
     *
     * @description
     * Converts arbitrary strings (filenames, path segments) into valid JavaScript identifiers
     * suitable for dot-notation property access. Supports sophisticated rule-based transformation
     * with glob patterns, case preservation, and intelligent segment handling.
     *
     * @param {string} input - String to sanitize
     * @param {Object} [options] - Sanitization configuration. Omit it to use the instance's `sanitize` config (defaults when there is none)
     * @param {boolean} [options.first=true] - Lowercase first character of first segment
     * @param {Object} [options.preserve={}] - Names kept as they are
     * @param {boolean} [options.preserve.upper=false] - Preserve all-uppercase identifiers
     * @param {boolean} [options.preserve.lower=false] - Preserve all-lowercase identifiers
     * @param {Object} [options.rules={}] - Transformation rules
     * @param {string[]} [options.rules.leave=[]] - Preserve exactly (case-sensitive, supports globs)
     * @param {string[]} [options.rules.nocase=[]] - Preserve exactly (case-insensitive, supports globs)
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
     *   preserve: { upper: true }
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
    public sanitizePropertyName(input: string, options?: {
        first?: boolean | undefined;
        preserve?: {
            upper?: boolean | undefined;
            lower?: boolean | undefined;
        } | undefined;
        rules?: {
            leave?: string[] | undefined;
            nocase?: string[] | undefined;
            upper?: string[] | undefined;
            lower?: string[] | undefined;
        } | undefined;
    }): string;
    /**
     * Get module ID from file path
     * @param {string} filePath - Full file path
     * @param {string} baseDir - Base directory
     * @returns {string} Module ID
     * @public
     */
    public getModuleId(filePath: string, baseDir: string): string;
    /**
     * Check if filename represents a special function name that should preserve case
     * @param {string} name - Name to check
     * @returns {boolean} True if special case should be preserved
     * @public
     */
    public shouldPreserveFunctionCase(name: string): boolean;
    #private;
}
import { ComponentBase } from "#factories/component-base";
//# sourceMappingURL=sanitize.d.mts.map