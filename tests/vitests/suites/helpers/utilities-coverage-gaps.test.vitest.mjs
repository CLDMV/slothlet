/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/utilities-coverage-gaps.test.vitest.mjs
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
 * @fileoverview Coverage for uncovered Utilities branches.
 *
 * @description
 * Covers:
 *   line 68   `deepMerge` — false branch of `if (Object.prototype.hasOwnProperty.call(source, key))`.
 *             Triggered when `source` has an inherited (prototype) property but not an own property
 *             for that key. Using `for...in` with `Object.create({inherited: 1})` as source causes
 *             the `hasOwnProperty` check to return false for the inherited key.
 *   line 104  `deepClone` — true branch of `if (Array.isArray(obj))` in the fallback path.
 *             `structuredClone` throws for arrays containing functions, falling through to the manual
 *             cloning code where `Array.isArray(obj)` evaluates to true.
 *
 * @module tests/vitests/suites/helpers/utilities-coverage-gaps
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect } from "vitest";
import { Utilities } from "@cldmv/slothlet/helpers/utilities";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * Build a minimal mock slothlet for Utilities construction.
 *
 * @returns {object} Minimal mock.
 *
 * @example
 * const u = new Utilities(makeMock());
 */
function makeMock() {
	return { config: {}, debug: () => {}, SlothletError, SlothletWarning };
}

// ─── deepMerge — hasOwnProperty false branch (line 68) ───────────────────────

describe("Utilities.deepMerge — inherited property skipped via hasOwnProperty false (line 68)", () => {
	it("skips inherited enumerable keys added via Object.prototype (line 68 false branch)", () => {
		const u = new Utilities(makeMock());

		// The false branch fires when `for...in` finds an inherited key that is NOT an own
		// property of `source`. For a plain object (required by isPlainObject), the only way
		// to produce an inherited enumerable key is via Object.prototype itself.
		// This is isolated to the forked vitest process so it is safe.
		const propKey = "__covTestDeepMergeGap__";
		Object.defineProperty(Object.prototype, propKey, {
			enumerable: true,
			writable: true,
			value: "should-not-merge",
			configurable: true
		});

		try {
			const target = { existing: 1 };
			const source = { ownProp: "should-merge" };

			// for...in will also yield propKey (inherited from Object.prototype),
			// but hasOwnProperty.call(source, propKey) → false → line 68 false branch
			const result = u.deepMerge(target, source);

			// Own property merged
			expect(result.ownProp).toBe("should-merge");
			// Inherited key NOT in result as own property (false branch was taken)
			expect(Object.prototype.hasOwnProperty.call(result, propKey)).toBe(false);
			// Existing target key preserved
			expect(result.existing).toBe(1);
		} finally {
			// Always clean up — remove the injected prototype property
			delete Object.prototype[propKey];
		}
	});
});

// ─── deepClone — Array.isArray true branch in fallback (line 104) ─────────────

describe("Utilities.deepClone — Array.isArray true branch in structuredClone fallback (line 104)", () => {
	it("clones an array containing a function via the fallback Array.isArray branch (line 104)", () => {
		const u = new Utilities(makeMock());

		// structuredClone throws DataCloneError for arrays containing functions.
		// The catch block falls through to the manual path where Array.isArray(obj) is true.
		const fn = () => "hello";
		const arr = [fn, 1, "two"];

		// Should not throw — deepClone maps over array items
		const result = u.deepClone(arr);

		expect(Array.isArray(result)).toBe(true);
		expect(result[1]).toBe(1);
		expect(result[2]).toBe("two");
		// Functions have no enumerable own properties so they clone to {}
		expect(typeof result[0]).toBe("object");
	});

	it("clones a nested array containing non-cloneable values (line 104 recursive)", () => {
		const u = new Utilities(makeMock());

		const sym = Symbol("test");
		const arr = [sym, [sym]];

		const result = u.deepClone(arr);
		expect(Array.isArray(result)).toBe(true);
		// Symbol is returned as-is (primitive fallback)
		expect(result[0]).toBe(sym);
	});
});
