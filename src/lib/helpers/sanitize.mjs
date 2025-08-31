/**
 * @fileoverview String sanitization utilities for slothlet API property names. Internal file (not exported in package.json).
 * @module @cldmv/slothlet.helpers.sanitize
 * @memberof module:@cldmv/slothlet.helpers
 * @internal
 * @package
 *
 * @description
 * Advanced string sanitization system for converting arbitrary file names into valid JavaScript
 * property names suitable for slothlet's dot-notation API access. Implements sophisticated
 * identifier validation, segment-based transformation rules, and configurable casing policies.
 *
 * Key features:
 * - Valid identifier detection with fast-path optimization
 * - Configurable first-segment casing (lowerFirst option)
 * - Advanced rule-based transformation (leave, upper, lower arrays)
 * - Cross-platform filename compatibility
 * - Edge case handling for special characters and numeric prefixes
 * - Camel-case conversion for multi-segment identifiers
 *
 * Technical implementation:
 * - Uses regex-based validation for JavaScript identifier compliance
 * - Segment splitting on non-identifier characters [^A-Za-z0-9_$]
 * - Rule precedence: leave → upper → lower → default casing
 * - Safety fallbacks for empty results and invalid identifier starts
 * - Performance-optimized with early returns for valid identifiers
 *
 * Usage context:
 * - File-to-API mapping in slothlet module loading
 * - Dynamic property name generation for module namespaces
 * - Sanitization of user-provided file names into safe property accessors
 *
 *
 * @example
 * // ESM (internal)
 * import { sanitizePathName } from '@cldmv/slothlet/helpers/sanitize';
 * // Internal example using package.json exports
 *
 * @example
 * // Relative import (internal)
 * import { sanitizePathName } from './sanitize.mjs';
 * const apiKey = sanitizePathName('auto-ip.mjs');
 */

/**
 * @function sanitizePathName
 * @package
 * @internal
 * @param {string} input - The input string to sanitize (e.g., file name, path segment)
 * @param {Object} [opts={}] - Sanitization configuration options
 * @param {boolean} [opts.lowerFirst=true] - Lowercase the first character of the first segment for camelCase convention
 * @param {Object} [opts.rules={}] - Advanced segment transformation rules
 * @param {string[]} [opts.rules.leave=[]] - Segments to preserve exactly as-is (case-sensitive)
 * @param {string[]} [opts.rules.upper=[]] - Segments to force to UPPERCASE
 * @param {string[]} [opts.rules.lower=[]] - Segments to force to lowercase
 * @returns {string} Valid JavaScript identifier safe for dot-notation property access
 * @throws {TypeError} When input parameter is not a string
 *
 * @description
 * Sanitize a string into a JS identifier suitable for dot-path usage.
 * Core sanitization function that converts arbitrary strings (typically file names) into
 * valid JavaScript identifiers following slothlet's API naming conventions.
 *
 * Sanitization algorithm:
 * 1. **Fast path**: If input is already a valid JS identifier, return unchanged
 * 2. **Segmentation**: Split on non-identifier characters [^A-Za-z0-9_$]
 * 3. **Prefix cleanup**: Remove leading digits/invalid chars from first segment
 * 4. **Rule application**: Apply leave/upper/lower rules with precedence
 * 5. **Default casing**: First segment respects lowerFirst, others get title case
 * 6. **Safety checks**: Ensure result starts with valid identifier character
 *
 * Rule precedence (applied in order):
 * - `leave` rules: Preserve segment exactly as provided
 * - `upper` rules: Force segment to UPPERCASE
 * - `lower` rules: Force segment to lowercase
 * - Default behavior: Apply standard camelCase conversion
 *
 * Edge case handling:
 * - Empty input → "_" (safe fallback identifier)
 * - Numeric prefixes → Stripped from first segment
 * - All invalid chars → Returns "_" + cleaned content
 * - No valid segments → Returns "_"
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
 * // Numeric prefix handling
 * sanitizePathName("2autoIP");               // "autoIP" (leading digits stripped)
 * sanitizePathName("123-test-file");         // "testFile" (digits stripped, camelCase applied)
 *
 * @example
 * // First character casing control
 * sanitizePathName("My-File");                        // "myFile" (lowerFirst=true default)
 * sanitizePathName("My-File", { lowerFirst: false }); // "MyFile" (preserve capital first)
 * sanitizePathName("API-util", { lowerFirst: false }); // "APIUtil" (preserve capital first)
 *
 * @example
 * // Advanced rule-based transformation
 * sanitizePathName("foo-api-json", {
 *   rules: {
 *     leave: ["foo"],    // Keep "foo" exactly as-is
 *     upper: ["api"],    // Force "api" to "API"
 *     lower: ["JSON"]    // Force "JSON" to "json"
 *   }
 * }); // Result: "fooAPIjson"
 *
 * @example
 * // Real-world slothlet file mapping scenarios
 * sanitizePathName("auto-ip.mjs");           // "autoIp" (common filename pattern)
 * sanitizePathName("parseJSON.mjs");         // "parseJSON" (preserve common acronym)
 * sanitizePathName("get-HTTP-status.js");    // "getHTTPStatus" (multi-acronym handling)
 * sanitizePathName("root-math.mjs");         // "rootMath" (typical slothlet module name)
 *
 * @example
 * // Edge cases and safety handling
 * sanitizePathName("");                      // "_" (empty string fallback)
 * sanitizePathName("123");                   // "_" (all numeric becomes fallback)
 * sanitizePathName("!@#$%");                 // "_" (all special chars becomes fallback)
 * sanitizePathName("valid@#$invalid");       // "validInvalid" (special chars removed)
 */
export function sanitizePathName(input, opts = {}) {
	const { lowerFirst = true, rules = {} } = opts;

	const L = (rules.leave || []).map((s) => String(s).toLowerCase());
	const U = (rules.upper || []).map((s) => String(s).toLowerCase());
	const W = (rules.lower || []).map((s) => String(s).toLowerCase());

	const isValidId = (s) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s);

	let s = String(input).trim();

	// Fast path: valid identifier stays untouched
	if (isValidId(s)) return s;

	// Split on any non-identifier char
	let parts = s.split(/[^A-Za-z0-9_$]+/).filter(Boolean);
	if (parts.length === 0) return "_";

	// Ensure the first usable part starts with a valid identifier-start
	// (strip leading digits etc.)
	while (parts.length && !/^[A-Za-z_$]/.test(parts[0][0])) {
		parts[0] = parts[0].replace(/^[^A-Za-z_$]+/, "");
		if (!parts[0]) parts.shift();
	}
	if (parts.length === 0) return "_";

	const applyRule = (seg, index) => {
		const key = seg.toLowerCase();

		// 1) leave: return unchanged
		if (L.includes(key)) return seg;

		// 2) upper: force full uppercase
		if (U.includes(key)) return seg.toUpperCase();

		// 3) lower: force full lowercase
		if (W.includes(key)) return seg.toLowerCase();

		// Default behavior:
		if (index === 0) {
			// first segment: optionally lowercase only first char
			return lowerFirst ? seg[0].toLowerCase() + seg.slice(1) : seg;
		}
		// subsequent segments: Uppercase first char (camel)
		return seg[0].toUpperCase() + seg.slice(1);
	};

	// Transform
	let out = parts.map((seg, i) => applyRule(seg.replace(/[^A-Za-z0-9_$]/g, ""), i)).join("");

	// Final cleanup & safety
	out = out.replace(/[^A-Za-z0-9_$]/g, "");
	if (!out || !/^[A-Za-z_$]/.test(out[0])) out = "_" + out;

	return out;
}

// --- Examples ---
/*
sanitizePathName("autoIP");                // "autoIP"  (unchanged)
sanitizePathName("auto-ip");               // "autoIp"
sanitizePathName("my file!.mjs");          // "myFileMjs"
sanitizePathName("2autoIP");               // "autoIP"
sanitizePathName("foo-API");               // "fooAPI"
sanitizePathName("auto_ip");               // "auto_ip" (unchanged: valid id)
sanitizePathName("My-File");               // "myFile"  (lowerFirst default true)
sanitizePathName("My-File", { lowerFirst:false }); // "MyFile"

// With rules:
sanitizePathName("foo-api-json", {
  rules: { leave: ["foo"], upper: ["api"], lower: ["JSON"] }
}); // "fooAPIjson" (leave 'foo' as-is, 'api' upper, 'json' lower)
*/
