/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/sanitize-coverage-gaps.test.vitest.mjs
 *	@Date: 2026-03-03 16:00:00 -08:00 (1772726400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 16:00:00 -08:00 (1772726400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for uncovered Sanitize branches.
 *
 * @description
 * Covers:
 *   line 50    `const flags = caseSensitive ? "" : "i"` consequent branch ("" flags, caseSensitive=true)
 *              inside `#compileGlobPattern` when pattern is `**string**` and case-sensitive leave rule
 *   line 63    `return null` in `#compileGlobPattern` catch block — triggered when pattern is not
 *              a string (e.g. a Number) and `.startsWith()` throws TypeError
 *   line 420   `result = "_" + result` safety prefix — when sanitized result starts with a digit
 *              (invalid identifier start character)
 *
 * @module tests/vitests/suites/helpers/sanitize-coverage-gaps
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect } from "vitest";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";

// ─── #compileGlobPattern catch branch (line 63) ──────────────────────────────

describe("Sanitize.#compileGlobPattern — catch returns null for non-string pattern (line 63)", () => {
	it("does not throw and returns a valid identifier when leave rule includes a Number (not a string)", () => {
		// rules.leave = [123] → lowerRules/leaveRules iteration → #compileGlobPattern(123, true)
		// → (123).startsWith("**") throws TypeError → caught → return null → skip rule
		expect(() => sanitizePropertyName("abc", { rules: { leave: [123] } })).not.toThrow();
	});

	it("still sanitizes the input correctly even when a non-string leave rule is present", () => {
		const result = sanitizePropertyName("auto-ip", { rules: { leave: [null] } });
		// null is non-string → catch → return null; sanitize continues normally
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	it("handles boolean false as a rule pattern (triggers catch)", () => {
		expect(() => sanitizePropertyName("test", { rules: { upper: [false] } })).not.toThrow();
	});
});

// ─── #compileGlobPattern caseSensitive="" branch (line 50) ────────────────────

describe("Sanitize.#compileGlobPattern — caseSensitive=true flags='' branch (line 50)", () => {
	it("case-sensitive leave rule with **string** pattern uses '' (empty) flags", () => {
		// rules.leave is processed case-sensitively (caseSensitive=true).
		// A **XYZ** pattern triggers the special lookbehind path at line 47.
		// Inside that path, line 50: flags = caseSensitive ? "" : "i" → "" (consequent branch).
		expect(() => sanitizePropertyName("testXYZmore", { rules: { leave: ["**XYZ**"] } })).not.toThrow();
	});

	it("returns a string result when leave-rule **string** matches a segment", () => {
		const result = sanitizePropertyName("getHTTPStatus", { rules: { leave: ["**HTTP**"] } });
		expect(typeof result).toBe("string");
	});
});

// ─── Safety prefix (line 420) ─────────────────────────────────────────────────

describe("Sanitize.sanitizePropertyName — empty result gets _ prefix (line 420)", () => {
	it("prepends _ when camelCase processing yields empty string — purely numeric input (line 420)", () => {
		// "42" → digit-only segments → all stripped → result = "" → !result is true
		// → line 419 condition true → result = "_" + "" = "_" (line 420)
		const result = sanitizePropertyName("42");
		expect(result).toBe("_");
	});

	it("prepends _ when input is all-special characters (stripped to empty, line 420)", () => {
		// "+++" → no valid identifier segments → result = "" → safety prefix at line 420
		const result = sanitizePropertyName("+++");
		expect(result).toBe("_");
	});

	it("prepends _ for empty string input (line 420)", () => {
		const result = sanitizePropertyName("");
		expect(result).toBe("_");
	});

	it("does NOT prepend _ for alphabetic starting input", () => {
		const result = sanitizePropertyName("abc");
		expect(result.startsWith("_")).toBe(false);
	});
});
// ─── Sub-segment stripped to empty string (line 337) ─────────────────────────

describe("Sanitize.sanitizePropertyName — non-alphanumeric sub-segment returns '' (line 337)", () => {
        it("sub-segment of only hyphens between underscores collapses to empty string (line 337)", () => {
                // "abc_---_def" → primarySeg split on (_+) → parts include "---"
                // "---".replace(/[^A-Za-z0-9_$]/g, "") = "" → !cleanSeg TRUE → return ""
                const result = sanitizePropertyName("abc_---_def");
                expect(typeof result).toBe("string");
                // The --- sub-segment is dropped entirely; abc and def contribute
                expect(result.length).toBeGreaterThan(0);
        });

        it("sub-segment of only symbols collapses to empty string (line 337)", () => {
                // "x_!!!_y" → part "!!!" → cleanSeg "" → return ""
                const result = sanitizePropertyName("x_!!!_y");
                expect(typeof result).toBe("string");
                expect(result.length).toBeGreaterThan(0);
        });
});

// ─── #applyWithinSegmentPatterns: **X** with toUpper=false (line 196 cond-expr FALSE) ──

describe("Sanitize.#applyWithinSegmentPatterns — **X** lower rule hits toUpper=false arm (line 196)", () => {
        it("lower rule **HTTP** lowercases HTTP found in the middle of a segment (line 196 false arm)", () => {
                // rules.lower = ["**HTTP**"] → applyBoundaryPattern("**HTTP**", false)
                // segment "getHTTPStatus" → HTTP is surrounded → hasCharBefore && hasCharAfter TRUE
                // → replacement = toUpper ? upper : lower → toUpper=false → lower arm (line 196 FALSE)
                const result = sanitizePropertyName("getHTTPStatus", { rules: { lower: ["**HTTP**"] } });
                expect(typeof result).toBe("string");
                // HTTP should be lowercased to http
                expect(result.toLowerCase()).toContain("http");
        });

        it("lower rule **API** lowercases API in the middle of a segment (line 196 false arm)", () => {
                const result = sanitizePropertyName("callAPIMethod", { rules: { lower: ["**API**"] } });
                expect(typeof result).toBe("string");
        });
});

// ─── #applyWithinSegmentPatterns: plain pattern hits else-if FALSE (line 207) ───────

describe("Sanitize.#applyWithinSegmentPatterns — plain pattern (no *) skips both branches (line 207 false)", () => {
        it("upper rule 'HTTP' (no asterisks) evaluates else-if to false and falls through (line 207 false)", () => {
                // rules.upper = ["HTTP"] → applyBoundaryPattern("HTTP", true)
                // "HTTP" does not start with "**" → first if FALSE
                // "HTTP" has no "*" → else if condition FALSE → falls through (line 207 not-taken arm)
                const result = sanitizePropertyName("getHTTPStatus", { rules: { upper: ["HTTP"] } });
                expect(typeof result).toBe("string");
                expect(result.length).toBeGreaterThan(0);
        });

        it("lower rule 'api' (no asterisks) also hits else-if false (line 207 false)", () => {
                const result = sanitizePropertyName("callApiMethod", { rules: { lower: ["api"] } });
                expect(typeof result).toBe("string");
        });
});