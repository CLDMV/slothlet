/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/sanitize.mjs
 *	@Date: 2025-09-09 08:06:19 -07:00 (1725890779)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 00:00:00 -08:00 (1770192000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Advanced filename sanitization with rule-based transformation
 * @module @cldmv/slothlet/helpers/sanitize
 */

import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

// ============================================================================
// Sanitize Component Class
// ============================================================================

/**
 * Advanced filename sanitization with rule-based transformation
 * @extends ComponentBase
 * @public
 */
export class Sanitize extends ComponentBase {
	static slothletProperty = "sanitize";

	// ========================================================================
	// Pattern Matching Utilities (Private Methods)
	// ========================================================================

	/**
	 * Convert glob pattern to RegExp, supporting *, ?, and **STRING** boundary patterns
	 * @private
	 * @param {string} pattern - Glob pattern
	 * @param {boolean} caseSensitive - Case sensitivity flag
	 * @returns {RegExp|null} Compiled regex or null if invalid
	 */
	#compileGlobPattern(pattern, caseSensitive = true) {
		try {
			// **STRING** requires surrounding characters (positive lookbehind/ahead)
			if (pattern.startsWith("**") && pattern.endsWith("**") && pattern.length > 4) {
				const innerString = pattern.slice(2, -2);
				const escapedString = innerString.replace(/[.+^${}()|[\]\\*?]/g, "\\$&");
				const flags = caseSensitive ? "" : "i";
				return new RegExp(`(?<=.)${escapedString}(?=.)`, flags);
			}

			// Standard glob: * → .*, ? → .
			const regexPattern = pattern
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
	 * Check if input matches any pattern in the rule array
	 * @private
	 * @param {string} input - String to test
	 * @param {string[]} patterns - Array of literal strings or glob patterns
	 * @param {boolean} caseSensitive - Case sensitivity flag
	 * @returns {boolean} True if any pattern matches
	 */
	#matchesAnyPattern(input, patterns, caseSensitive = false) {
		for (const pattern of patterns) {
			if (pattern.includes("*") || pattern.includes("?")) {
				const regex = this.#compileGlobPattern(pattern, caseSensitive);
				if (regex && regex.test(input)) return true;
			} else {
				const match = caseSensitive ? input === pattern : input.toLowerCase() === pattern.toLowerCase();
				if (match) return true;
			}
		}
		return false;
	}

	/**
	 * Extract literal segments from glob pattern for segment-level matching
	 * @private
	 * @param {string} pattern - Glob pattern
	 * @returns {string[]} Array of literal segments
	 */
	#extractPatternLiterals(pattern) {
		return pattern.split(/[*?]+/).filter(Boolean);
	}

	// ========================================================================
	// Segment Transformation Logic (Private Methods)
	// ========================================================================

	/**
	 * Apply transformation rules to a single segment within context of original string
	 * @private
	 * @param {string} segment - Current segment being processed
	 * @param {number} index - Segment index (0-based)
	 * @param {string} originalString - Original input before splitting
	 * @param {Object} config - Transformation configuration
	 * @returns {string} Transformed segment
	 */
	#applySegmentRules(segment, index, originalString, config) {
		const { preserveAllUpper, preserveAllLower, leaveRules, leaveInsensitiveRules, upperRules, lowerRules } = config;

		// Rule 1: Exact preservation (case-sensitive)
		if (this.#matchesAnyPattern(segment, leaveRules, true)) {
			return segment;
		}

		// Rule 2: Exact preservation (case-insensitive)
		if (this.#matchesAnyPattern(segment, leaveInsensitiveRules, false)) {
			return segment;
		}

		// Rule 3: Preserve all-uppercase segments
		// Only applies to this specific segment, not requiring entire string to be uppercase
		if (preserveAllUpper && segment === segment.toUpperCase() && segment !== segment.toLowerCase() && /[A-Z]/.test(segment)) {
			return segment;
		}

		// Rule 4: Preserve all-lowercase segments
		// Only applies to this specific segment, not requiring entire string to be lowercase
		if (preserveAllLower && segment === segment.toLowerCase() && segment !== segment.toUpperCase() && /[a-z]/.test(segment)) {
			return segment;
		}

		// Rule 5: Pre-split pattern matching (original string context)
		// Check if segment is target of a pattern that matched the original string
		for (const pattern of [...upperRules, ...lowerRules]) {
			if (pattern.includes("*") || pattern.includes("?")) {
				const regex = this.#compileGlobPattern(pattern, false);
				if (regex && regex.test(originalString)) {
					// Pattern matched original string - check if this segment is the target
					const literals = this.#extractPatternLiterals(pattern);
					for (const literal of literals) {
						// Clean literal but also trim underscores at boundaries since we're matching sub-segments
						const cleanLiteral = literal.replace(/[^A-Za-z0-9_$]/g, "").replace(/^_+|_+$/g, "");
						if (cleanLiteral && segment.toLowerCase() === cleanLiteral.toLowerCase()) {
							return upperRules.includes(pattern) ? segment.toUpperCase() : segment.toLowerCase();
						}
					}
				}
			} else {
				// Exact match on segment
				if (segment.toLowerCase() === pattern.toLowerCase()) {
					return upperRules.includes(pattern) ? segment.toUpperCase() : segment.toLowerCase();
				}
			}
		}

		// Rule 6: Within-segment pattern-based transformation
		let transformed = this.#applyWithinSegmentPatterns(segment, upperRules, lowerRules);
		if (transformed !== segment) {
			return transformed;
		}

		// Rule 7: Default behavior - preserve segment case
		// (camelCase transformation happens at primary segment level, not here)
		return segment;
	}

	/**
	 * Apply pattern-based transformations within a segment (for **STRING** patterns)
	 * @private
	 * @param {string} segment - Segment to transform
	 * @param {string[]} upperRules - Patterns requiring uppercase
	 * @param {string[]} lowerRules - Patterns requiring lowercase
	 * @returns {string} Transformed segment
	 */
	#applyWithinSegmentPatterns(segment, upperRules, lowerRules) {
		let result = segment;

		const applyBoundaryPattern = (pattern, toUpper) => {
			// **STRING** requires surrounding characters (positive lookbehind/ahead)
			if (pattern.startsWith("**") && pattern.endsWith("**") && pattern.length > 4) {
				const innerString = pattern.slice(2, -2);
				const innerRegex = new RegExp(innerString.replace(/[.+^${}()|[\]\\*?]/g, "\\$&"), "gi");
				const matches = [...result.matchAll(innerRegex)];

				for (const match of matches) {
					const startPos = match.index;
					const endPos = startPos + match[0].length;
					const hasCharBefore = startPos > 0;
					const hasCharAfter = endPos < result.length;

					if (hasCharBefore && hasCharAfter) {
						const replacement = toUpper ? innerString.toUpperCase() : innerString.toLowerCase();
						result = result.substring(0, startPos) + replacement + result.substring(endPos);
						break;
					}
				}
			}
			// *STRING* matches anywhere within segment (glob pattern)
			else if (pattern.includes("*") && !pattern.startsWith("**")) {
				// Extract the literal part (remove asterisks)
				const literalParts = pattern.split("*").filter(Boolean);
				for (const literal of literalParts) {
					if (literal) {
						const literalRegex = new RegExp(literal.replace(/[.+^${}()|[\]\\]/g, "\\$&"), "gi");
						const replacement = toUpper ? literal.toUpperCase() : literal.toLowerCase();
						result = result.replace(literalRegex, replacement);
					}
				}
			}
		};

		upperRules.forEach((pattern) => applyBoundaryPattern(pattern, true));
		lowerRules.forEach((pattern) => applyBoundaryPattern(pattern, false));

		return result;
	}

	// ========================================================================
	// Public Methods
	// ========================================================================

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
	sanitizePropertyName(input, options = {}) {
		const { lowerFirst = true, preserveAllUpper = false, preserveAllLower = false, rules = {} } = options;

		// Normalize rules to string arrays
		const leaveRules = (rules.leave || []).map((s) => String(s));
		const leaveInsensitiveRules = (rules.leaveInsensitive || []).map((s) => String(s));
		const upperRules = (rules.upper || []).map((s) => String(s));
		const lowerRules = (rules.lower || []).map((s) => String(s));

		const originalString = String(input).trim();

		// Check if entire string matches the preserve criteria
		const isAllUpper =
			originalString === originalString.toUpperCase() && originalString !== originalString.toLowerCase() && /[A-Z]/.test(originalString);
		const isAllLower =
			originalString === originalString.toLowerCase() && originalString !== originalString.toUpperCase() && /[a-z]/.test(originalString);

		if (preserveAllUpper && isAllUpper) {
			return originalString;
		}
		if (preserveAllLower && isAllLower) {
			return originalString;
		}

		// Split into segments at hyphens and non-identifier characters (NOT underscores)
		// These are "primary segments" that will be camelCased together
		let primarySegments = originalString.split(/[-]+|[^A-Za-z0-9_$]+/).filter(Boolean);

		// Edge case: empty result
		if (primarySegments.length === 0) return "_";

		// Ensure first segment starts with valid identifier character
		while (primarySegments.length && !/^[A-Za-z_$]/.test(primarySegments[0][0])) {
			primarySegments[0] = primarySegments[0].replace(/^[^A-Za-z_$]+/, "");
			if (!primarySegments[0]) primarySegments.shift();
		}
		if (primarySegments.length === 0) return "_";

		// Process each primary segment:
		// 1. Split by underscores into sub-segments (capturing separators to preserve underscore count)
		// 2. Apply rules to each sub-segment
		// 3. Rejoin with original separators
		const processedPrimarySegments = primarySegments.map((primarySeg) => {
			// Split by underscores, capturing the separators to preserve exact count
			const parts = primarySeg.split(/(_+)/);

			// Process only the non-separator parts (odd indices are separators)
			const processedParts = parts.map((part, partIdx) => {
				// Keep separators as-is
				if (partIdx % 2 === 1) return part;
				if (!part) return part;

				// Clean and process sub-segment
				const cleanSeg = part.replace(/[^A-Za-z0-9_$]/g, "");
				if (!cleanSeg) return "";

				// Apply segment rules (without camelCase - that happens at primary level)
				const config = { preserveAllUpper, preserveAllLower, leaveRules, leaveInsensitiveRules, upperRules, lowerRules };
				return this.#applySegmentRules(cleanSeg, 0, originalString, config);
			});

			// Rejoin with original separators preserved
			return processedParts.join("");
		});

		// Apply camelCase transformation to primary segments (unless rules prevent it)
		const camelCasedSegments = processedPrimarySegments.map((seg, idx) => {
			// Check if this segment matches any rules that would prevent camelCase
			const matchesLeave = this.#matchesAnyPattern(seg, leaveRules, true);
			const matchesLeaveInsensitive = this.#matchesAnyPattern(seg, leaveInsensitiveRules, false);
			const matchesUpper = this.#matchesAnyPattern(seg, upperRules, false);
			const matchesLower = this.#matchesAnyPattern(seg, lowerRules, false);
			// Only check preserveAllUpper/Lower if segment doesn't contain underscores
			// (underscore-separated parts were already handled individually)
			const hasUnderscores = seg.includes("_");
			const isAllUpper = !hasUnderscores && preserveAllUpper && seg === seg.toUpperCase() && seg !== seg.toLowerCase() && /[A-Z]/.test(seg);
			const isAllLower = !hasUnderscores && preserveAllLower && seg === seg.toLowerCase() && seg !== seg.toUpperCase() && /[a-z]/.test(seg);

			// If any rule matches, preserve the segment as-is (don't apply camelCase)
			if (matchesLeave || matchesLeaveInsensitive || matchesUpper || matchesLower || isAllUpper || isAllLower) {
				return seg;
			}

			// V3: Apply camelCase at PRIMARY segment level only
			// CamelCase transformation based on segment position
			let transformed;
			if (idx === 0) {
				// First primary segment: lowercase first character
				transformed = lowerFirst ? seg[0].toLowerCase() + seg.slice(1) : seg;
			} else {
				// Subsequent primary segments: capitalize first character
				transformed = seg[0].toUpperCase() + seg.slice(1);
			}

			return transformed;
		});

		// Join primary segments (no delimiter - camelCase)
		let result = camelCasedSegments.join("");
		result = result.replace(/[^A-Za-z0-9_$]/g, "");

		// Safety: ensure valid identifier start
		if (!result || !/^[A-Za-z_$]/.test(result[0])) {
			result = "_" + result;
		}

		return result;
	}

	/**
	 * Get module ID from file path
	 * @param {string} filePath - Full file path
	 * @param {string} baseDir - Base directory
	 * @returns {string} Module ID
	 * @public
	 */
	getModuleId(filePath, baseDir) {
		// Remove base directory and extension
		let relative = filePath.replace(baseDir, "").replace(/\\/g, "/");
		relative = relative.replace(/^\//, ""); // Remove leading slash
		relative = relative.replace(/\.(mjs|cjs|js)$/, ""); // Remove extension

		return relative;
	}

	/**
	 * Check if filename represents a special function name that should preserve case
	 * @param {string} name - Name to check
	 * @returns {boolean} True if special case should be preserved
	 * @public
	 */
	shouldPreserveFunctionCase(name) {
		const preservePatterns = [
			/^[A-Z]{2,}$/, // All caps (IP, HTTP, API, JSON, etc.)
			/[A-Z]{2,}/ // Contains multiple consecutive caps
		];

		return preservePatterns.some((pattern) => pattern.test(name));
	}
}

// ============================================================================
// Standalone Function Export (for backward compatibility)
// ============================================================================

/**
 * Standalone sanitizePropertyName function for backward compatibility
 * @param {string} input - Input string to sanitize
 * @param {object} options - Sanitization options
 * @returns {string} Sanitized property name
 * @public
 */
export function sanitizePropertyName(input, options = {}) {
	const sanitizer = new Sanitize(null); // No slothlet instance needed for this method
	return sanitizer.sanitizePropertyName(input, options);
}
