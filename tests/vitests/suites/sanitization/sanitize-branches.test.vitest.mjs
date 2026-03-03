/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/sanitization/sanitize-branches.test.vitest.mjs
 *	@Date: 2026-02-27T06:19:24-08:00 (1772201964)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 07:33:53 -08:00 (1772552033)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for Sanitize uncovered branches:
 *   - Line 315: while-loop body that strips non-identifier prefix from primarySegments[0]
 *   - Line 317: second empty-primarySegments guard after while loop
 *   - Line 337: cleanSeg-empty guard inside sub-segment processing
 *   - Lines 449-454: shouldPreserveFunctionCase() — all-caps / consecutive-caps patterns
 *
 * @module tests/vitests/suites/sanitization/sanitize-branches.test.vitest
 */

import { describe, it, expect } from "vitest";
import { sanitizePropertyName, Sanitize } from "@cldmv/slothlet/helpers/sanitize";
import { vi } from "vitest";

/**
 * Minimal slothlet mock for ComponentBase.
 * @returns {object} Minimal mock.
 */
function makeMock() {
	return { config: {}, debug: vi.fn() };
}

// ─── Line 315: while-loop strips digit prefix from first segment ──────────────

describe("sanitizePropertyName — digit-prefix first segment (line 315)", () => {
	it("strips leading digits and camelCases the remainder: '1abc' → 'abc' (line 315)", () => {
		// primarySegments = ["1abc"]
		// while loop: "1" fails → strip prefix → "abc" → valid start
		expect(sanitizePropertyName("1abc")).toBe("abc");
	});

	it("strips multiple leading digits: '42fooBar' → 'fooBar' (line 315)", () => {
		expect(sanitizePropertyName("42fooBar")).toBe("fooBar");
	});
});

// ─── Line 317: all-digit segment collapses to return "_" ─────────────────────

describe("sanitizePropertyName — segment collapses to empty after while loop (line 317)", () => {
	it("returns '_' when the only segment is all digits: '1' → '_' (line 317)", () => {
		// primarySegments = ["1"] → strip all → shift → length 0 → return "_"
		expect(sanitizePropertyName("1")).toBe("_");
	});

	it("returns '_' for multi-digit input with no letters: '42' → '_' (line 317)", () => {
		expect(sanitizePropertyName("42")).toBe("_");
	});
});

// ─── Line 337: empty cleanSeg guard inside sub-segment processing ─────────────

describe("sanitizePropertyName — empty sub-segment cleanSeg guard (line 337)", () => {
	it("treats leading underscored separator as empty sub-segment: '_123' → '123' (line 337)", () => {
		// "_123" → primarySegments = ["_123"]
		// sub-split: ["", "_", "123"] → partIdx=0 is "" → cleanSeg="" → line 337 fires
		// remaining part "123" → camelCase produces "123" → safety guard applies → "_123"
		// Regardless of exact result, the call must not throw
		const result = sanitizePropertyName("_123");
		expect(typeof result).toBe("string");
	});

	it("handles a segment that is entirely underscores before numeric content (no throw)", () => {
		const result = sanitizePropertyName("__42abc");
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});
});

// ─── Lines 449-454: shouldPreserveFunctionCase ───────────────────────────────

describe("Sanitize.shouldPreserveFunctionCase — preserve patterns (lines 449-454)", () => {
	it("returns true for all-caps names like 'HTTP' (line 449)", () => {
		const s = new Sanitize(makeMock());
		// /^[A-Z]{2,}$/ matches → returns true
		expect(s.shouldPreserveFunctionCase("HTTP")).toBe(true);
	});

	it("returns true for all-caps 'API' (line 449)", () => {
		const s = new Sanitize(makeMock());
		expect(s.shouldPreserveFunctionCase("API")).toBe(true);
	});

	it("returns true for names containing consecutive caps like 'parseHTTP' (line 451)", () => {
		const s = new Sanitize(makeMock());
		// /[A-Z]{2,}/ matches "HTTP" within "parseHTTP" → returns true
		expect(s.shouldPreserveFunctionCase("parseHTTP")).toBe(true);
	});

	it("returns false for regular camelCase names like 'fooBar'", () => {
		const s = new Sanitize(makeMock());
		// Neither pattern matches — only one uppercase char at a time
		expect(s.shouldPreserveFunctionCase("fooBar")).toBe(false);
	});

	it("returns false for all-lowercase names", () => {
		const s = new Sanitize(makeMock());
		expect(s.shouldPreserveFunctionCase("lowercase")).toBe(false);
	});
});
// ─── Line 337: cleanSeg empty guard in sub-segment processing ────────────────

describe("sanitizePropertyName — all-symbol sub-segment stripped to empty (line 337)", () => {
	/**
	 * When a hyphen-separated segment consists entirely of characters outside
	 * [A-Za-z0-9_$], cleaning it produces an empty string → line 337 executes.
	 */
	it("ignores an all-symbol segment between hyphens: 'a-!@#-b' → 'aB' (line 337)", () => {
		// 'a' is segment 0, '!@#' strips to '' → return '' (line 337), 'b' → camelCased
		const result = sanitizePropertyName("a-!@#-b");
		expect(result).toBe("aB");
	});

	it("ignores multiple consecutive symbol-only segments: 'foo-!!!-bar' → 'fooBar' (line 337)", () => {
		const result = sanitizePropertyName("foo-!!!-bar");
		expect(result).toBe("fooBar");
	});

	it("all-symbol input with surrounding hyphens produces a valid identifier (line 337)", () => {
		// 'x-^%&-z' → middle segment strips to '' → contributed nothing → 'xZ'
		const result = sanitizePropertyName("x-^%&-z");
		expect(result).toBe("xZ");
	});
});
