/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/pattern-matcher.mjs
 *	@Date: 2026-04-14T07:17:33-07:00 (1776176253)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:16:13-08:00 (1794874573)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
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
 * Compiles glob patterns (*, **, ?, {a,b}, !negation, !(a|b) scoped exclusion) into matcher
 * functions that test against dot-separated API paths.
 *
 * @example
 * import { compilePattern, expandBraces } from "#helpers/pattern-matcher";
 * const matcher = compilePattern("payments.**");
 * matcher("payments.charge");         // true
 * matcher("payments.stripe.webhook"); // true
 * matcher("admin.manage");            // false
 */

import { SlothletError } from "#errors";
import {
	appendList,
	ArrayMethods,
	filterList,
	listPush,
	mapList,
	RegExp,
	RegExpMethods,
	regExpReplace,
	splitText,
	StringMethods,
	textReplace
} from "#helpers/intrinsics";

/**
 * Compile a glob pattern into a matcher function.
 * Supports: * (any chars except .), ** (any number of segments, none included, when it is a whole segment: `payments.**`
 * matches `payments` itself, `**.charge` matches `charge`, `a.**.b` matches `a.b`; any chars including . inside a segment),
 * ? (single char),
 * {a,b} brace expansion, !pattern whole-pattern negation, and !(a|b) scoped exclusion —
 * a per-segment complement matching any single segment except the listed literal alternatives
 * (e.g. `admin.!(initialize)` matches `admin.start` but not `admin.initialize`).
 *
 * @param {string} pattern - Glob pattern
 * @param {object} [options={}] - Options
 * @param {Function} [options.onMaxDepth] - Called when brace expansion exceeds max depth.
 *   Should throw an error. If not provided, a SlothletError("BRACE_EXPANSION_MAX_DEPTH") is thrown.
 * @returns {function} Matcher function that takes a path and returns boolean
 * @example
 * const matcher = compilePattern("payments.**");
 * matcher("payments.charge"); // true
 * matcher("admin.users");     // false
 *
 * @example
 * compilePattern("payments.**")("payments"); // true
 */
export function compilePattern(pattern, options = {}) {
	// Handle whole-pattern negation (leading "!"), but NOT the scoped "!(...)" exclusion extglob,
	// which is a per-segment operator handled below.
	const isNegation = StringMethods.startsWith(pattern, "!") && !StringMethods.startsWith(pattern, "!(");
	if (isNegation) {
		pattern = StringMethods.slice(pattern, 1);
		const matcher = compilePattern(pattern, options);
		return (path) => !matcher(path);
	}

	// Expand brace patterns {a,b,c}
	const expanded = expandBraces(pattern, 0, 10, options);
	if (expanded.length > 1) {
		// Multiple patterns - match if ANY match
		const matchers = mapList(expanded, (p) => compilePattern(p, options));
		return (path) => ArrayMethods.some(matchers, (m) => m(path));
	}

	// Single pattern - convert to regex
	pattern = expanded[0];

	// Scoped exclusion extglob `!(a|b)`: match any single `.`-delimited segment that is NOT one of
	// the listed literal alternatives — a per-segment complement, unlike the whole-pattern `!` above.
	// Substitute each group with a placeholder before regex-escaping (so the `()`/`|` inside are not
	// escaped as literals), then restore it to a negative-lookahead segment matcher afterwards. The
	// alternatives are treated as literals (their regex specials are escaped); globs inside `!(...)`
	// are not supported.
	const extglobs = [];
	pattern = regExpReplace(/!\(([^()]*)\)/g, pattern, (_match, body) => {
		const alts = mapList(
			filterList(splitText(body, "|"), (alt) => alt.length > 0),
			(alt) => regExpReplace(/[.+^$()|[\]\\*?{}]/g, alt, "\\$&")
		);
		// `!()` (no alternatives) excludes nothing → any single segment matches.
		const guard = alts.length ? `(?!(?:${ArrayMethods.join(alts, "|")})(?:\\.|$))` : "";
		const token = `__EXTGLOB_${extglobs.length}__`;
		listPush(extglobs, `${guard}[^.]+`);
		return token;
	});

	// A `**` that is a whole segment stands for any number of segments, none included, and takes the `.` beside it
	// with it (#726). A run of them (`a.**.**`) says the same as one, so it is read as one.
	const segments = [];
	for (let ofIndex = 0, ofList = splitText(pattern, "."); ofIndex < ofList.length; ofIndex++) {
		const segment = ofList[ofIndex];
		if (segment === "**" && segments[segments.length - 1] === "**") continue;
		listPush(segments, segment);
	}
	let regexPattern = "";
	for (let index = 0; index < segments.length; index++) {
		const segment = segments[index];
		const first = index === 0;
		const last = index === segments.length - 1;
		if (segment === "**") {
			if (first && last) regexPattern += ".*";
			else if (first) regexPattern += "(?:.*\\.)?";
			else if (last) regexPattern += "(?:\\..*)?";
			else regexPattern += "\\.(?:.*\\.)?";
			continue;
		}
		// The `.` before this segment, unless a `**` before it already took it.
		if (!first && segments[index - 1] !== "**") regexPattern += "\\.";
		regexPattern += regExpReplace(
			/\?/g,
			regExpReplace(
				/__DOUBLESTAR__/g,
				regExpReplace(/\*/g, regExpReplace(/\*\*/g, regExpReplace(/[+^$()|[\]\\]/g, segment, "\\$&"), "__DOUBLESTAR__"), "[^.]*"),
				".*"
			),
			"."
		); // ? matches single char
	}

	// Restore scoped-exclusion segment matchers (function replacement avoids `$` in the lookahead
	// being read as a replacement token).
	ArrayMethods.forEach(extglobs, (re, i) => {
		regexPattern = textReplace(regexPattern, `__EXTGLOB_${i}__`, () => re);
	});

	regexPattern = `^${regexPattern}$`;
	const regex = new RegExp(regexPattern);

	return (path) => RegExpMethods.exec(regex, path) !== null;
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
		// Fallback throw: only reached when onMaxDepth is not supplied.
		throw new SlothletError("BRACE_EXPANSION_MAX_DEPTH", { maxDepth, validationError: true });
	}

	// Find first brace group
	const braceStart = StringMethods.indexOf(pattern, "{");
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
	const prefix = StringMethods.slice(pattern, 0, braceStart);
	const braceContent = StringMethods.slice(pattern, braceStart + 1, braceEnd);
	const suffix = StringMethods.slice(pattern, braceEnd + 1);

	// Split on commas (but not nested ones)
	const alternatives = splitBraceAlternatives(braceContent);

	// Generate expanded patterns
	const expanded = [];
	for (let ofIndex = 0, ofList = alternatives; ofIndex < ofList.length; ofIndex++) {
		const alt = ofList[ofIndex];
		const combined = prefix + alt + suffix;
		// Recursively expand nested braces
		const recursiveExpanded = expandBraces(combined, depth + 1, maxDepth, options);
		appendList(expanded, recursiveExpanded);
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
			listPush(alternatives, current);
			current = "";
		} else {
			current += char;
		}
	}

	if (current) {
		listPush(alternatives, current);
	}

	return alternatives;
}
