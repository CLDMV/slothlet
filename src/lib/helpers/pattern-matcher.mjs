/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/pattern-matcher.mjs
 *	@Date: 2026-04-14 07:17:33 -07:00 (1776176253)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:12:47 -07:00 (1776211967)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Shared glob pattern compilation for API path matching.
 * Used by HookManager, PermissionManager, and any component that needs
 * glob-to-regex compilation for dot-separated API paths.
 *
 * @module @cldmv/slothlet/helpers/pattern-matcher
 * @internal
 * @package
 *
 * @description
 * Compiles glob patterns (*, **, ?, {a,b}, !negation) into matcher functions
 * that test against dot-separated API paths.
 *
 * @example
 * import { compilePattern, expandBraces } from "@cldmv/slothlet/helpers/pattern-matcher";
 * const matcher = compilePattern("payments.**");
 * matcher("payments.charge");         // true
 * matcher("payments.stripe.webhook"); // true
 * matcher("admin.manage");            // false
 */

import { SlothletError } from "@cldmv/slothlet/errors";
import { translate } from "@cldmv/slothlet/i18n";

/**
 * Compile a glob pattern into a matcher function.
 * Supports: * (any chars except .), ** (any chars including .), ? (single char),
 * {a,b} brace expansion, !pattern negation
 *
 * @param {string} pattern - Glob pattern
 * @param {object} [options={}] - Options
 * @param {Function} [options.onMaxDepth] - Called when brace expansion exceeds max depth.
 *   Should throw an error. If not provided, a generic Error is thrown.
 * @returns {function} Matcher function that takes a path and returns boolean
 * @example
 * const matcher = compilePattern("payments.**");
 * matcher("payments.charge"); // true
 * matcher("admin.users");     // false
 */
export function compilePattern(pattern, options = {}) {
	// Handle negation patterns
	const isNegation = pattern.startsWith("!");
	if (isNegation) {
		pattern = pattern.slice(1);
		const matcher = compilePattern(pattern, options);
		return (path) => !matcher(path);
	}

	// Expand brace patterns {a,b,c}
	const expanded = expandBraces(pattern, 0, 10, options);
	if (expanded.length > 1) {
		// Multiple patterns - match if ANY match
		const matchers = expanded.map((p) => compilePattern(p, options));
		return (path) => matchers.some((m) => m(path));
	}

	// Single pattern - convert to regex
	pattern = expanded[0];

	// Escape special regex characters except *, ?, and .
	let regexPattern = pattern
		.replace(/[+^$()|[\]\\]/g, "\\$&") // Don't escape {} - already expanded
		.replace(/\*\*/g, "__DOUBLESTAR__") // Placeholder for **
		.replace(/\*/g, "[^.]*") // * matches any chars except .
		.replace(/__DOUBLESTAR__/g, ".*") // ** matches any chars including .
		.replace(/\?/g, "."); // ? matches single char

	regexPattern = `^${regexPattern}$`;
	const regex = new RegExp(regexPattern);

	return (path) => regex.test(path);
}

/**
 * Expand brace patterns {a,b,c} into multiple patterns.
 * Supports nested braces with configurable depth limit.
 *
 * @param {string} pattern - Pattern with braces to expand
 * @param {number} [depth=0] - Current recursion depth
 * @param {number} [maxDepth=10] - Maximum nesting depth
 * @param {object} [options={}] - Options
 * @param {Function} [options.onMaxDepth] - Called when max depth exceeded. Should throw.
 * @returns {string[]} Array of expanded patterns
 * @example
 * expandBraces("{a,b}.path"); // ["a.path", "b.path"]
 */
export function expandBraces(pattern, depth = 0, maxDepth = 10, options = {}) {
	// Check depth limit (>=depth allows 0-9, i.e. 10 levels)
	if (depth >= maxDepth) {
		if (options.onMaxDepth) {
			options.onMaxDepth(maxDepth);
		}
		// All callers (hook-manager, permission-manager) always supply onMaxDepth which throws,
		// making this fallback throw unreachable in normal usage.
		/* v8 ignore next */
		throw new SlothletError("BRACE_EXPANSION_MAX_DEPTH", { maxDepth, validationError: true });
	}

	// Find first brace group
	const braceStart = pattern.indexOf("{");
	if (braceStart === -1) {
		return [pattern]; // No braces to expand
	}

	// Find matching closing brace
	let braceEnd = -1;
	let depthCount = 1;
	for (let i = braceStart + 1; i < pattern.length; i++) {
		if (pattern[i] === "{") depthCount++;
		if (pattern[i] === "}") {
			depthCount--;
			if (depthCount === 0) {
				braceEnd = i;
				break;
			}
		}
	}

	if (braceEnd === -1) {
		return [pattern]; // Unmatched brace - treat as literal
	}

	// Extract parts
	const prefix = pattern.slice(0, braceStart);
	const braceContent = pattern.slice(braceStart + 1, braceEnd);
	const suffix = pattern.slice(braceEnd + 1);

	// Split on commas (but not nested ones)
	const alternatives = splitBraceAlternatives(braceContent);

	// Generate expanded patterns
	const expanded = [];
	for (const alt of alternatives) {
		const combined = prefix + alt + suffix;
		// Recursively expand nested braces
		const recursiveExpanded = expandBraces(combined, depth + 1, maxDepth, options);
		expanded.push(...recursiveExpanded);
	}

	return expanded;
}

/**
 * Split brace alternatives on commas, respecting nested braces.
 *
 * @param {string} content - Content inside braces
 * @returns {string[]} Array of alternatives
 * @example
 * splitBraceAlternatives("a,b,c"); // ["a", "b", "c"]
 */
export function splitBraceAlternatives(content) {
	const alternatives = [];
	let current = "";
	let depth = 0;

	for (let i = 0; i < content.length; i++) {
		const char = content[i];

		if (char === "{") {
			depth++;
			current += char;
		} else if (char === "}") {
			depth--;
			current += char;
		} else if (char === "," && depth === 0) {
			alternatives.push(current);
			current = "";
		} else {
			current += char;
		}
	}

	if (current) {
		alternatives.push(current);
	}

	return alternatives;
}
