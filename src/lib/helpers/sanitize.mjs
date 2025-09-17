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
 * - Advanced rule-based transformation (leave, leaveInsensitive, upper, lower arrays) with glob pattern support
 * - Cross-platform filename compatibility
 * - Edge case handling for special characters and numeric prefixes
 * - Camel-case conversion for multi-segment identifiers
 *
 * Technical implementation:
 * - Uses regex-based validation for JavaScript identifier compliance
 * - Segment splitting on non-identifier characters [^A-Za-z0-9_$]
 * - Rule precedence: exact matches → glob patterns → default casing
 * - Lightweight glob matching using simple wildcard patterns
 * - Safety fallbacks for empty results and invalid identifier starts
 *
 * Usage context:
 * - File-to-API mapping in slothlet module loading
 * - Dynamic property name generation for module namespaces
 */

/**
 * Convert a glob pattern to a regular expression.
 * Supports * (zero or more characters) and ? (single character).
 * @private
 * @param {string} pattern - Glob pattern
 * @param {boolean} caseSensitive - Whether to be case sensitive (default: true)
 * @returns {RegExp|null} Regular expression or null if invalid
 */
function globToRegex(pattern, caseSensitive = true) {
	try {
		// Escape special regex chars except * and ?
		let regexPattern = pattern
			.replace(/[.+^${}()|[\]\\]/g, "\\$&")
			.replace(/\*/g, ".*")
			.replace(/\?/g, ".");

		const flags = caseSensitive ? "" : "i";
		return new RegExp(`^${regexPattern}$`, flags);
	} catch (_) {
		return null;
	}
}

/**
 * @function sanitizePathName
 * @package
 * @internal
 * @param {string} input - The input string to sanitize (e.g., file name, path segment)
 * @param {Object} [opts={}] - Sanitization configuration options
 * @param {boolean} [opts.lowerFirst=true] - Lowercase the first character of the first segment for camelCase convention
 * @param {Object} [opts.rules={}] - Advanced segment transformation rules (supports glob patterns with * and ?)
 * @param {string[]} [opts.rules.leave=[]] - Segments to preserve exactly as-is (case-sensitive, supports globs)
 * @param {string[]} [opts.rules.leaveInsensitive=[]] - Segments to preserve exactly as-is (case-insensitive, supports globs)
 * @param {string[]} [opts.rules.upper=[]] - Segments to force to UPPERCASE (supports globs)
 * @param {string[]} [opts.rules.lower=[]] - Segments to force to lowercase (supports globs)
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
 */
export function sanitizePathName(input, opts = {}) {
	const { lowerFirst = true, rules = {} } = opts;

	const leaveRules = (rules.leave || []).map((s) => String(s));
	const leaveInsensitiveRules = (rules.leaveInsensitive || []).map((s) => String(s));
	const upperRules = (rules.upper || []).map((s) => String(s));
	const lowerRules = (rules.lower || []).map((s) => String(s));

	let s = String(input).trim();

	// Always apply rules - don't skip for valid identifiers
	// Users expect rules to work on valid identifiers too

	// Split the string into segments
	let parts = s.split(/[^A-Za-z0-9_$]+/).filter(Boolean);
	if (parts.length === 0) return "_";

	// Ensure the first usable part starts with a valid identifier-start
	while (parts.length && !/^[A-Za-z_$]/.test(parts[0][0])) {
		parts[0] = parts[0].replace(/^[^A-Za-z_$]+/, "");
		if (!parts[0]) parts.shift();
	}
	if (parts.length === 0) return "_";

	// Helper function to check if a pattern matches the original string and affects a specific segment
	const segmentMatchesPreSplitPattern = (segment, patterns, caseSensitive = false) => {
		for (const pattern of patterns) {
			// For patterns like "*-ip", "*-api-*", check if:
			// 1. The pattern matches the original string
			// 2. The segment is the relevant part of that pattern

			if (pattern.includes("*") || pattern.includes("?")) {
				const regex = globToRegex(pattern, caseSensitive);
				if (regex && regex.test(s)) {
					// Pattern matches original string, now check if this segment is the target
					// Extract the literal parts from the pattern
					const literalParts = pattern.split(/[*?]+/).filter(Boolean);

					for (const literal of literalParts) {
						// Remove non-alphanumeric separators for comparison
						const cleanLiteral = literal.replace(/[^A-Za-z0-9_$]/g, "");
						if (cleanLiteral) {
							const match = caseSensitive ? segment === cleanLiteral : segment.toLowerCase() === cleanLiteral.toLowerCase();
							if (match) {
								return true;
							}
						}
					}
				}
			} else {
				// Exact pattern match
				const match = caseSensitive ? segment === pattern : segment.toLowerCase() === pattern.toLowerCase();
				if (match) {
					return true;
				}
			}
		}
		return false;
	};

	const applyRule = (seg, index) => {
		// 1) leave: return unchanged (case-sensitive matching)
		if (segmentMatchesPreSplitPattern(seg, leaveRules, true)) {
			return seg;
		}

		// 2) leaveInsensitive: return unchanged (case-insensitive matching)
		if (segmentMatchesPreSplitPattern(seg, leaveInsensitiveRules, false)) {
			return seg;
		}

		// 3) upper: force full uppercase
		if (segmentMatchesPreSplitPattern(seg, upperRules, false)) {
			return seg.toUpperCase();
		}

		// 4) lower: force full lowercase
		if (segmentMatchesPreSplitPattern(seg, lowerRules, false)) {
			return seg.toLowerCase();
		}

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

// With exact rules:
sanitizePathName("foo-api-json", {
  rules: { leave: ["foo"], upper: ["api"], lower: ["JSON"] }
}); // "fooAPIjson" (leave 'foo' as-is, 'api' upper, 'json' lower)

// With glob patterns:
sanitizePathName("parseJSONData", {
  rules: { leave: ["*JSON*"] }
}); // "parseJSONData" (preserved due to *JSON* glob)

sanitizePathName("getHTTPStatus", {
  rules: { upper: ["http*", "*api*"] }
}); // "getHTTPStatus" (HTTP matched by http* glob)

sanitizePathName("validateUserId", {
  rules: { lower: ["*id", "uuid*"] }
}); // "validateUserid" (Id matched by *id glob)
*/
