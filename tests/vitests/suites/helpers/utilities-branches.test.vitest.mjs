/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/utilities-branches.test.vitest.mjs
 *	@Date: 2026-02-27T06:19:24-08:00 (1772201964)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-28 13:16:46 -08:00 (1772313406)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for Utilities.deepMerge — non-plain-object fast path (line 62).
 *
 * @description
 * `deepMerge(target, source)` has an early-return when either argument is not a
 * plain object (line 61-62):
 *
 *   if (!this.isPlainObject(target) || !this.isPlainObject(source)) {
 *       return source;    ← line 62  (uncovered)
 *   }
 *
 * In production code this branch fires when merging config defaults where one side
 * is an array, class instance, or primitive — all skipped in the integration test
 * path.  Directly instantiating Utilities lets us exercise it cleanly.
 *
 * @module tests/vitests/suites/helpers/utilities-branches.test.vitest
 */

import { describe, it, expect } from "vitest";
import { Utilities } from "@cldmv/slothlet/helpers/utilities";

/**
 * Return a minimal slothlet mock sufficient for ComponentBase.
 * @returns {object} Minimal mock.
 */
function makeMock() {
	return { config: {}, debug: () => {} };
}

// ─── deepMerge — non-plain-object fast path (line 62) ────────────────────────

describe("Utilities.deepMerge — non-plain-object early return (line 62)", () => {
	it("returns source when target is a Date (not a plain object)", () => {
		const utils = new Utilities(makeMock());
		const target = new Date("2024-01-01");
		const source = { a: 1 };

		// target is a class instance → isPlainObject(target) = false → return source
		const result = utils.deepMerge(target, source);
		expect(result).toBe(source);
	});

	it("returns source when source is an array (not a plain object)", () => {
		const utils = new Utilities(makeMock());
		const target = { a: 1 };
		const source = [1, 2, 3];

		// source is an Array → isPlainObject(source) = false → return source
		const result = utils.deepMerge(target, source);
		expect(result).toBe(source);
	});

	it("returns source when target is null", () => {
		const utils = new Utilities(makeMock());
		const source = { x: 99 };

		const result = utils.deepMerge(null, source);
		expect(result).toBe(source);
	});

	it("returns source when target is a string primitive", () => {
		const utils = new Utilities(makeMock());
		const source = { ok: true };

		const result = utils.deepMerge("not-an-object", source);
		expect(result).toBe(source);
	});
});
