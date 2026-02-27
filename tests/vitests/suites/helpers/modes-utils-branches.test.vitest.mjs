/**
 *      @Project: @cldmv/slothlet
 *      @Filename: /tests/vitests/suites/helpers/modes-utils-branches.test.vitest.mjs
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
 * @fileoverview Coverage tests for ModesUtils.cloneWrapperImpl — Array.isArray branch (line 57-58).
 *
 * @description
 * `cloneWrapperImpl` has three branches when mode is "eager":
 *   1. Value is falsy / not an object  → return value unchanged
 *   2. Value is an Array               → return value.slice()  ← line 57-58 (uncovered)
 *   3. Otherwise (plain/class object)  → return shallow-cloned object via descriptors
 *
 * The Array branch was never hit because the real loader only passes plain-object
 * module exports.  This test directly instantiates ModesUtils with a minimal mock.
 *
 * @module tests/vitests/suites/helpers/modes-utils-branches.test.vitest
 */

import { describe, it, expect } from "vitest";
import { ModesUtils } from "@cldmv/slothlet/helpers/modes-utils";

/**
 * Return a minimal slothlet mock sufficient for ComponentBase (stores reference only).
 * @returns {object} Minimal mock.
 */
function makeMock() {
	return { config: {}, debug: () => {} };
}

// ─── cloneWrapperImpl — Array branch (lines 57-58) ───────────────────────────

describe("ModesUtils.cloneWrapperImpl — Array branch (line 57-58)", () => {
	it("returns a shallow copy when value is an array and mode is 'eager' (line 57-58)", () => {
		const mu = new ModesUtils(makeMock());
		const arr = [1, 2, 3];

		const result = mu.cloneWrapperImpl(arr, "eager");

		// Must be a copy (not the same reference) but equal in value
		expect(result).not.toBe(arr);
		expect(result).toEqual([1, 2, 3]);
	});

	it("returns the original array when mode is 'lazy' (no-clone path)", () => {
		const mu = new ModesUtils(makeMock());
		const arr = [10, 20];

		const result = mu.cloneWrapperImpl(arr, "lazy");

		// Lazy mode must return the original reference
		expect(result).toBe(arr);
	});

	it("clones a nested array correctly in eager mode (line 57-58)", () => {
		const mu = new ModesUtils(makeMock());
		const arr = [{ a: 1 }, { b: 2 }];

		const result = mu.cloneWrapperImpl(arr, "eager");

		expect(result).not.toBe(arr);
		expect(result).toEqual(arr);
		// Shallow copy — nested objects are the same reference
		expect(result[0]).toBe(arr[0]);
	});
});
