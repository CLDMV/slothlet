/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/helpers/hint-detector-branches.test.vitest.mjs
 *	@Date: 2026-02-27T08:32:05-08:00 (1772209925)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:48-08:00 (1795869108)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Coverage tests for hint-detector.mjs — pattern-match branch (line 62).
 *
 * @description
 * `detectHint(error, errorCode)` has two paths:
 *
 * - **Pattern match (line 62):** When `error` is truthy and `error.message` matches one of
 *   the known `HINT_RULES` patterns, the matching rule's `hintKey` is returned immediately.
 *
 * - **Convention fallback (line 69):** When nothing matches (or error is falsy), returns
 *   `HINT_${errorCode}` — already covered by existing tests.
 *
 * @module tests/vitests/suites/helpers/hint-detector-branches.test.vitest
 */

import { describe, it, expect, vi } from "vitest";
import { detectHint } from "#helpers/hint-detector";

describe("HintDetector.detectHint — HINT_RULES pattern-match returns rule hintKey (line 62)", () => {
	it("returns HINT_MODULE_NOT_FOUND for an error matching /Cannot find module/i (line 62)", () => {
		const result = detectHint(new Error("Cannot find module 'xyz'"), "SOME_CODE");
		expect(result).toBe("HINT_MODULE_NOT_FOUND");
	});

	it("returns HINT_REFERENCE_REMOVED for an error matching reference export pattern (line 62)", () => {
		const result = detectHint(new Error("does not provide an export named 'reference'"), "OTHER_CODE");
		expect(result).toBe("HINT_REFERENCE_REMOVED");
	});

	it("returns HINT_SYNTAX_ERROR for an error matching /Unexpected token/i (line 62)", () => {
		const result = detectHint(new Error("Unexpected token '}'"), "SOME_CODE");
		expect(result).toBe("HINT_SYNTAX_ERROR");
	});

	it("falls through to convention key when no pattern matches (line 69)", () => {
		const result = detectHint(new Error("totally unrecognised message"), "MY_CODE");
		expect(result).toBe("HINT_MY_CODE");
	});

	it("returns convention key when error is null (line 69 — falsy guard)", () => {
		const result = detectHint(null, "MY_CODE");
		expect(result).toBe("HINT_MY_CODE");
	});

	it("does not run a thrown object's own toString (no message)", () => {
		const toString = vi.fn(() => "Cannot find module 'missing'");
		const result = detectHint({ toString }, "SOME_CODE");
		// no rule matches, so it falls back to the convention key rather than the toString text
		expect(result).toBe("HINT_SOME_CODE");
		expect(toString).not.toHaveBeenCalled();
	});

	it("does not run a thrown object's own toString (empty message)", () => {
		const toString = vi.fn(() => "Unexpected token '}' in JSON");
		const result = detectHint({ message: "", toString }, "PARSE_CODE");
		expect(result).toBe("HINT_PARSE_CODE");
		expect(toString).not.toHaveBeenCalled();
	});
});
