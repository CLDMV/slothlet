/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/sanitize.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:27:58-08:00 (1794882478)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Advanced filename sanitization with rule-based transformation
 * @module @cldmv/slothlet/helpers/sanitize
 * @internal
 */

import { ComponentBase } from "#factories/component-base";
import {
	ArrayMethods,
	Boolean,
	concatLists,
	filterList,
	mapList,
	matchAllOf,
	RegExp,
	RegExpMethods,
	regExpReplace,
	regExpSplit,
	splitText,
	String,
	StringMethods,
	textReplace
} from "#helpers/intrinsics";

// ============================================================================
// Sanitize Component Class
// ============================================================================

/**
 * Advanced filename sanitization with rule-based transformation
 * @extends ComponentBase
 * @public
 */
// --- API-RULES condition markers (see docs/API-RULES/API-NAMING-CONDITIONS.md) ---
// Rule 16 (N01): Base name = filename minus extension (loader.mjs ~L533)
// Rule 16 (N02): All-uppercase preservation — ~L291
// Rule 16 (N03): All-lowercase preservation (no separators) — ~L294
// Rule 16 (N04): Primary-segment split (hyphen/non-identifier) — ~L302
// Rule 16 (N05): camelCase join (first lower / rest titlecase) — ~L392
// Rule 16 (N06): Configured naming-rule cascade — ~L108
// Rule 16 (N07): Underscore preserved within a segment — ~L320
// Rule 16 (N08): Illegal-character handling — ~L305 / ~L409

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
	 * @returns {RegExp} Compiled regex
	 */
	#compileGlobPattern(pattern, caseSensitive = true) {
		// **STRING** requires surrounding characters (positive lookbehind/ahead)
		if (StringMethods.startsWith(pattern, "**") && StringMethods.endsWith(pattern, "**") && pattern.length > 4) {
			const innerString = StringMethods.slice(pattern, 2, -2);
			const escapedString = regExpReplace(/[.+^${}()|[\]\\*?]/g, innerString, "\\$&");
			const flags = caseSensitive ? "" : "i";
			return new RegExp(`(?<=.)${escapedString}(?=.)`, flags);
		}

		// Standard glob: * → .*, ? → .
		const regexPattern = regExpReplace(/\?/g, regExpReplace(/\*/g, regExpReplace(/[.+^${}()|[\]\\]/g, pattern, "\\$&"), ".*"), ".");

		const flags = caseSensitive ? "" : "i";
		return new RegExp(`^${regexPattern}$`, flags);
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
		for (let ofIndex = 0, ofList = patterns; ofIndex < ofList.length; ofIndex++) {
			const pattern = ofList[ofIndex];
			if (StringMethods.includes(pattern, "*") || StringMethods.includes(pattern, "?")) {
				const regex = this.#compileGlobPattern(pattern, caseSensitive);
				if (regex && RegExpMethods.exec(regex, input) !== null) return true;
			} else {
				const match = caseSensitive ? input === pattern : StringMethods.toLowerCase(input) === StringMethods.toLowerCase(pattern);
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
		return filterList(regExpSplit(/[*?]+/, pattern), Boolean);
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
		if (
			preserveAllUpper &&
			segment === StringMethods.toUpperCase(segment) &&
			segment !== StringMethods.toLowerCase(segment) &&
			RegExpMethods.exec(/[A-Z]/, segment) !== null
		) {
			return segment;
		}

		// Rule 4: Preserve all-lowercase segments
		// Only applies to this specific segment, not requiring entire string to be lowercase
		if (
			preserveAllLower &&
			segment === StringMethods.toLowerCase(segment) &&
			segment !== StringMethods.toUpperCase(segment) &&
			RegExpMethods.exec(/[a-z]/, segment) !== null
		) {
			return segment;
		}

		// Rule 5: Pre-split pattern matching (original string context)
		// Check if segment is target of a pattern that matched the original string
		for (let ofIndex = 0, ofList = concatLists(upperRules, lowerRules); ofIndex < ofList.length; ofIndex++) {
			const pattern = ofList[ofIndex];
			if (StringMethods.includes(pattern, "*") || StringMethods.includes(pattern, "?")) {
				const regex = this.#compileGlobPattern(pattern, false);
				if (regex && RegExpMethods.exec(regex, originalString) !== null) {
					// Pattern matched original string - check if this segment is the target
					const literals = this.#extractPatternLiterals(pattern);
					for (let ofIndex = 0, ofList = literals; ofIndex < ofList.length; ofIndex++) {
						const literal = ofList[ofIndex];
						// Clean literal but also trim underscores at boundaries since we're matching sub-segments
						const cleanLiteral = regExpReplace(/^_+|_+$/g, regExpReplace(/[^A-Za-z0-9_$]/g, literal, ""), "");
						if (cleanLiteral && StringMethods.toLowerCase(segment) === StringMethods.toLowerCase(cleanLiteral)) {
							return ArrayMethods.includes(upperRules, pattern) ? StringMethods.toUpperCase(segment) : StringMethods.toLowerCase(segment);
						}
					}
				}
			} else {
				// Exact match on segment
				if (StringMethods.toLowerCase(segment) === StringMethods.toLowerCase(pattern)) {
					return ArrayMethods.includes(upperRules, pattern) ? StringMethods.toUpperCase(segment) : StringMethods.toLowerCase(segment);
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
			if (StringMethods.startsWith(pattern, "**") && StringMethods.endsWith(pattern, "**") && pattern.length > 4) {
				const innerString = StringMethods.slice(pattern, 2, -2);
				const innerRegex = new RegExp(regExpReplace(/[.+^${}()|[\]\\*?]/g, innerString, "\\$&"), "gi");
				const matches = matchAllOf(result, innerRegex);

				for (let ofIndex = 0, ofList = matches; ofIndex < ofList.length; ofIndex++) {
					const match = ofList[ofIndex];
					const startPos = match.index;
					const endPos = startPos + match[0].length;
					const hasCharBefore = startPos > 0;
					const hasCharAfter = endPos < result.length;

					if (hasCharBefore && hasCharAfter) {
						const replacement = toUpper ? StringMethods.toUpperCase(innerString) : StringMethods.toLowerCase(innerString);
						result = StringMethods.substring(result, 0, startPos) + replacement + StringMethods.substring(result, endPos);
						break;
					}
				}
			}
			// *STRING* matches anywhere within segment (glob pattern)
			else if (StringMethods.includes(pattern, "*") && !StringMethods.startsWith(pattern, "**")) {
				// Extract the literal part (remove asterisks)
				const literalParts = filterList(splitText(pattern, "*"), Boolean);
				for (let i = 0; i < literalParts.length; i++) {
					const literal = literalParts[i];
					const literalRegex = new RegExp(regExpReplace(/[.+^${}()|[\]\\]/g, literal, "\\$&"), "gi");
					const replacement = toUpper ? StringMethods.toUpperCase(literal) : StringMethods.toLowerCase(literal);
					result = regExpReplace(literalRegex, result, replacement);
				}
			}
		};

		ArrayMethods.forEach(upperRules, (pattern) => applyBoundaryPattern(pattern, true));
		ArrayMethods.forEach(lowerRules, (pattern) => applyBoundaryPattern(pattern, false));

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
	sanitizePropertyName(input, options) {
		// No explicit options: use the instance's `sanitize` config, so every name the loader derives from a
		// file or folder follows it (#814). The standalone export has no instance and falls back to defaults.
		const effective = options ?? this.slothlet?.config?.sanitize ?? {};
		const { first: lowerFirst = true, preserve = {}, rules = {} } = effective;
		const preserveAllUpper = preserve?.upper === true;
		const preserveAllLower = preserve?.lower === true;

		// Normalize rules to string arrays
		const leaveRules = mapList(rules.leave || [], (s) => String(s));
		const leaveInsensitiveRules = mapList(rules.nocase || [], (s) => String(s));
		const upperRules = mapList(rules.upper || [], (s) => String(s));
		const lowerRules = mapList(rules.lower || [], (s) => String(s));

		const originalString = StringMethods.trim(String(input));

		// Check if entire string matches the preserve criteria
		const isAllUpper =
			originalString === StringMethods.toUpperCase(originalString) &&
			originalString !== StringMethods.toLowerCase(originalString) &&
			RegExpMethods.exec(/[A-Z]/, originalString) !== null;
		const isAllLower =
			originalString === StringMethods.toLowerCase(originalString) &&
			originalString !== StringMethods.toUpperCase(originalString) &&
			RegExpMethods.exec(/[a-z]/, originalString) !== null;

		// Only return early when the string has NO hyphens/separators; a hyphenated all-caps name
		// (e.g. "FOO-BAR") must fall through to segment processing or it would return an invalid
		// identifier verbatim (#422). Mirrors the preserveAllLower guard below.
		if (preserveAllUpper && isAllUpper && !(RegExpMethods.exec(/-/, originalString) !== null)) {
			return originalString;
		}
		// For preserveAllLower, only return early if string has NO hyphens/separators
		// If it has separators, we need to process and remove them first
		if (preserveAllLower && isAllLower && !(RegExpMethods.exec(/-/, originalString) !== null)) {
			return originalString;
		}

		// Split into segments at hyphens and non-identifier characters (NOT underscores)
		// These are "primary segments" that will be camelCased together
		let primarySegments = filterList(regExpSplit(/[-]+|[^A-Za-z0-9_$]+/, originalString), Boolean);

		// Edge case: empty result
		if (primarySegments.length === 0) return "_";

		// Ensure first segment starts with valid identifier character
		while (primarySegments.length && !(RegExpMethods.exec(/^[A-Za-z_$]/, primarySegments[0][0]) !== null)) {
			primarySegments[0] = regExpReplace(/^[^A-Za-z_$]+/, primarySegments[0], "");
			if (!primarySegments[0]) ArrayMethods.shift(primarySegments);
		}
		if (primarySegments.length === 0) return "_";

		// Process each primary segment:
		// 1. Split by underscores into sub-segments (capturing separators to preserve underscore count)
		// 2. Apply rules to each sub-segment
		// 3. Rejoin with original separators
		// Track which segments had lower rules applied for camelCase processing
		const lowerRuleApplied = [];
		const processedPrimarySegments = mapList(primarySegments, (primarySeg, primaryIdx) => {
			// Split by underscores, capturing the separators to preserve exact count
			const parts = regExpSplit(/(_+)/, primarySeg);

			// Process only the non-separator parts (odd indices are separators)
			const processedParts = mapList(parts, (part, partIdx) => {
				// Keep separators as-is
				if (partIdx % 2 === 1) return part;
				if (!part) return part;

				// Clean and process sub-segment
				const cleanSeg = regExpReplace(/[^A-Za-z0-9_$]/g, part, "");

				// Apply segment rules (without camelCase - that happens at primary level)
				const config = { preserveAllUpper, preserveAllLower, leaveRules, leaveInsensitiveRules, upperRules, lowerRules };
				const result = this.#applySegmentRules(cleanSeg, 0, originalString, config);

				// Track if a lower rule was applied
				// Check if any lower rule pattern matches the original string
				const matchesLower = ArrayMethods.some(lowerRules, (pattern) => {
					if (StringMethods.includes(pattern, "*") || StringMethods.includes(pattern, "?")) {
						const regex = this.#compileGlobPattern(pattern, false);
						if (regex && RegExpMethods.exec(regex, originalString) !== null) {
							// Check if this segment is a target of the pattern
							const literals = this.#extractPatternLiterals(pattern);
							for (let ofIndex = 0, ofList = literals; ofIndex < ofList.length; ofIndex++) {
								const literal = ofList[ofIndex];
								const cleanLiteral = regExpReplace(/^_+|_+$/g, regExpReplace(/[^A-Za-z0-9_$]/g, literal, ""), "");
								if (cleanLiteral && StringMethods.toLowerCase(cleanSeg) === StringMethods.toLowerCase(cleanLiteral)) {
									return true;
								}
							}
						}
					} else {
						// Exact match on segment
						if (StringMethods.toLowerCase(cleanSeg) === StringMethods.toLowerCase(pattern)) {
							return true;
						}
					}
					return false;
				});

				if (matchesLower && result === StringMethods.toLowerCase(cleanSeg)) {
					lowerRuleApplied[primaryIdx] = true;
				}

				return result;
			});

			// Rejoin with original separators preserved
			return ArrayMethods.join(processedParts, "");
		});

		// Apply camelCase transformation to primary segments (unless rules prevent it)
		const camelCasedSegments = mapList(processedPrimarySegments, (seg, idx) => {
			// Check if this segment matches any rules that would prevent camelCase
			const matchesLeave = this.#matchesAnyPattern(seg, leaveRules, true);
			const matchesLeaveInsensitive = this.#matchesAnyPattern(seg, leaveInsensitiveRules, false);
			const matchesUpper = this.#matchesAnyPattern(seg, upperRules, false);
			// Only check preserveAllUpper/Lower if segment doesn't contain underscores
			// (underscore-separated parts were already handled individually)
			const hasUnderscores = StringMethods.includes(seg, "_");
			const isAllUpper =
				!hasUnderscores &&
				preserveAllUpper &&
				seg === StringMethods.toUpperCase(seg) &&
				seg !== StringMethods.toLowerCase(seg) &&
				RegExpMethods.exec(/[A-Z]/, seg) !== null;
			const isAllLower =
				!hasUnderscores &&
				preserveAllLower &&
				seg === StringMethods.toLowerCase(seg) &&
				seg !== StringMethods.toUpperCase(seg) &&
				RegExpMethods.exec(/[a-z]/, seg) !== null;

			// If any rule matches, preserve the segment as-is (don't apply camelCase)
			if (matchesLeave || matchesLeaveInsensitive || matchesUpper || isAllUpper || isAllLower) {
				return seg;
			}

			// V3: Apply camelCase at PRIMARY segment level only
			// CamelCase transformation based on segment position
			let transformed;
			if (idx === 0) {
				// First primary segment: lowercase first character
				transformed = lowerFirst ? StringMethods.toLowerCase(seg[0]) + StringMethods.slice(seg, 1) : seg;
			} else {
				// Subsequent primary segments: capitalize first character (unless lower rule applied)
				// Check if a lower rule was applied to this segment during processing
				if (lowerRuleApplied[idx]) {
					transformed = seg; // Keep lowercase from lower rule
				} else {
					transformed = StringMethods.toUpperCase(seg[0]) + StringMethods.slice(seg, 1);
				}
			}

			return transformed;
		});

		// Join primary segments (no delimiter - camelCase)
		let result = ArrayMethods.join(camelCasedSegments, "");
		result = regExpReplace(/[^A-Za-z0-9_$]/g, result, "");

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
		let relative = regExpReplace(/\\/g, textReplace(filePath, baseDir, ""), "/");
		relative = regExpReplace(/^\//, relative, ""); // Remove leading slash
		relative = regExpReplace(/\.(mjs|cjs|js)$/, relative, ""); // Remove extension

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

		return ArrayMethods.some(preservePatterns, (pattern) => RegExpMethods.exec(pattern, name) !== null);
	}
}

// ============================================================================
// Standalone function (public as `sanitize` from @cldmv/slothlet/sanitize)
// ============================================================================

/**
 * Turn a file or folder name into the api property name slothlet gives it. Consumers import it as `sanitize` from
 * `@cldmv/slothlet/sanitize`.
 * @param {string} input - Input string to sanitize
 * @param {object} options - Sanitization options
 * @returns {string} Sanitized property name
 * @public
 */
export function sanitizePropertyName(input, options = {}) {
	const sanitizer = new Sanitize(null); // No slothlet instance needed for this method
	return sanitizer.sanitizePropertyName(input, options);
}
