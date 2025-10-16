/**
 * @function sanitizePathName
 * @package
 * @internal
 * @param {string} input - The input string to sanitize (e.g., file name, path segment)
 * @param {Object} [opts={}] - Sanitization configuration options
 * @param {boolean} [opts.lowerFirst=true] - Lowercase the first character of the first segment for camelCase convention
 * @param {boolean} [opts.preserveAllUpper=false] - Automatically preserve any identifier that is already in all-uppercase format
 * @param {boolean} [opts.preserveAllLower=false] - Automatically preserve any identifier that is already in all-lowercase format
 * @param {Object} [opts.rules={}] - Advanced segment transformation rules (supports glob patterns: *, ?, **STRING**)
 * @param {string[]} [opts.rules.leave=[]] - Segments to preserve exactly as-is (case-sensitive, supports globs)
 * @param {string[]} [opts.rules.leaveInsensitive=[]] - Segments to preserve exactly as-is (case-insensitive, supports globs)
 * @param {string[]} [opts.rules.upper=[]] - Segments to force to UPPERCASE (supports globs and **STRING** boundary patterns)
 * @param {string[]} [opts.rules.lower=[]] - Segments to force to lowercase (supports globs and **STRING** boundary patterns)
 * @returns {string} Valid JavaScript identifier safe for dot-notation property access
 * @throws {TypeError} When input parameter is not a string
 *
 * @description
 * Sanitize a string into a JS identifier suitable for dot-path usage.
 * Advanced sanitization function that applies rules intelligently before splitting while
 * maintaining proper camelCase transformation. Uses sophisticated tracking to ensure
 * rule-matched segments are preserved correctly through the transformation process.
 *
 * @example
 * // Basic sanitization (already valid identifiers unchanged)
 * sanitizePathName("autoIP");                // "autoIP"  (no change needed)
 * sanitizePathName("validIdentifier");       // "validIdentifier" (no change needed)
 * sanitizePathName("auto_ip");               // "auto_ip" (valid identifier preserved)
 *
 * @example
 * // Standard camelCase conversion
 * sanitizePathName("auto-ip");               // "autoIp" (dash becomes camelCase)
 * sanitizePathName("my file!.mjs");          // "myFileMjs" (spaces and special chars removed)
 * sanitizePathName("foo-bar-baz");           // "fooBarBaz" (multi-segment camelCase)
 *
 * @example
 * // Pre-split pattern matching (matches original filename patterns)
 * sanitizePathName("auto-ip", {
 *   rules: {
 *     upper: ["*-ip"]  // Matches before splitting
 *   }
 * }); // Result: "autoIP" (ip becomes IP due to *-ip pattern)
 *
 * @example
 * // Complex pattern matching with intelligent tracking
 * sanitizePathName("get-api-status", {
 *   rules: {
 *     upper: ["*-api-*"]  // Matches api in middle of filename
 *   }
 * }); // Result: "getAPIStatus" (api becomes API due to pattern)
 *
 * @example
 * // Boundary-requiring patterns with **STRING** syntax
 * sanitizePathName("buildUrlWithParams", {
 *   rules: {
 *     upper: ["**url**"]  // Only matches "url" when surrounded by other characters
 *   }
 * }); // Result: "buildURLWithParams" (url becomes URL, surrounded by other chars)
 *
 * sanitizePathName("url", {
 *   rules: {
 *     upper: ["**url**"]  // Does NOT match standalone "url" (no surrounding chars)
 *   }
 * }); // Result: "url" (unchanged - no surrounding characters)
 *
 * sanitizePathName("parseJsonData", {
 *   rules: {
 *     upper: ["**json**"]  // Matches "json" surrounded by other characters
 *   }
 * }); // Result: "parseJSONData" (json becomes JSON)
 */
export function sanitizePathName(
	input: string,
	opts?: {
		lowerFirst?: boolean;
		preserveAllUpper?: boolean;
		preserveAllLower?: boolean;
		rules?: {
			leave?: string[];
			leaveInsensitive?: string[];
			upper?: string[];
			lower?: string[];
		};
	}
): string;
//# sourceMappingURL=sanitize.d.mts.map
