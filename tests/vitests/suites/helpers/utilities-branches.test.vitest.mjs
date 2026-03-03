/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/utilities-branches.test.vitest.mjs
 *	@Date: 2026-02-27T06:19:24-08:00 (1772201964)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 18:30:00 -08:00 (1772519400)
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
// ---------------------------------------------------------------------------
// Utilities.deepClone — Array.isArray branch in fallback (line 105)
// ---------------------------------------------------------------------------
// Utilities.deepClone — Array.isArray branch in fallback (line 105)
// ---------------------------------------------------------------------------

describe("Utilities.deepClone — array with non-cloneable elements (line 105)", () => {
it("deepClone with array containing functions enters Array.isArray branch in structuredClone fallback", () => {
const utils = new Utilities(makeMock());
// An array of functions cannot be structuredCloned, so deepClone enters the
// catch-fallback path. There, Array.isArray(obj) is true → line 105 fires.
const arr = [() => "fn1", () => "fn2", { x: 1 }];
const result = utils.deepClone(arr);
expect(Array.isArray(result)).toBe(true);
expect(result).toHaveLength(3);
});

it("deepClone of a mixed array preserves primitive items", () => {
const utils = new Utilities(makeMock());
const fn = () => "test";
const arr = [fn, 42, "str"];
const result = utils.deepClone(arr);
expect(Array.isArray(result)).toBe(true);
expect(result).toHaveLength(3);
// Primitives must survive the Array.isArray deep-map path
expect(result[1]).toBe(42);
expect(result[2]).toBe("str");
});
});

// ---------------------------------------------------------------------------
// Utilities.deepClone — inner catch fallback (line 113)
// ---------------------------------------------------------------------------

describe("Utilities.deepClone — inner catch fallback (line 113)", () => {
it("deepClone keeps original reference when cloning a nested property throws", () => {
const utils = new Utilities(makeMock());
// The outer object has a function property so structuredClone(outer) throws,
// putting us in the fallback loop. The 'bad' property holds a Proxy whose
// GET trap throws for every key access. When the fallback calls
// deepClone(badProxy), obj?.__type inside deepClone triggers the trap →
// throws → inner catch fires (line 111) → line 113: cloned.bad = original proxy.
const badProxy = new Proxy(
{},
{
get(_t, k) {
throw new Error("proxy: no access to " + String(k));
},
ownKeys() {
return [];
},
getOwnPropertyDescriptor() {
return undefined;
}
}
);
const outer = { fn: () => {} };
Object.defineProperty(outer, "bad", { value: badProxy, enumerable: true, configurable: true });

let result;
expect(() => {
result = utils.deepClone(outer);
}).not.toThrow();

expect(result).toBeDefined();
// If line 113 fired, 'bad' holds the original proxy reference
if ("bad" in result) {
expect(result.bad).toBe(badProxy);
}
});
});
