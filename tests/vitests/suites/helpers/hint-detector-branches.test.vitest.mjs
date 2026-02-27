/**
 *      @Project: @cldmv/slothlet
 *      @Filename: /tests/vitests/suites/helpers/hint-detector-branches.test.vitest.mjs
 *      @Date: 2026-07-17T00:00:00-07:00 (1752739200)
 *      @Author: Nate Hyson <CLDMV>
 *      @Email: <Shinrai@users.noreply.github.com>
 *      -----
 *      @Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *      @Last modified time: 2026-07-17 00:00:00 -07:00 (1752739200)
 *      -----
 *      @Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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

import { describe, it, expect } from "vitest";
import { detectHint } from "@cldmv/slothlet/helpers/hint-detector";

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

        it("uses error.toString() when error has no .message (line 59 — toString fallback)", () => {
                // error.message is undefined (falsy) → error.message || error.toString() hits toString path
                const fakeError = { toString: () => "Cannot find module 'missing'" };
                const result = detectHint(fakeError, "SOME_CODE");
                expect(result).toBe("HINT_MODULE_NOT_FOUND");
        });

        it("uses error.toString() for a matching pattern when .message is empty string (line 59)", () => {
                const fakeError = { message: "", toString: () => "Unexpected token '}' in JSON" };
                const result = detectHint(fakeError, "PARSE_CODE");
                // Empty string is falsy → falls back to toString()
                expect(result).toBe("HINT_SYNTAX_ERROR");
        });
});
