/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/intrinsics-index-writes.test.vitest.mjs
 *	@Date: 2026-11-17T07:55:00-08:00 (1794930900)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T08:17:06-08:00 (1794932226)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The array helpers slothlet builds its own lists with write each element without running a setter module
 * code put at that index on `Array.prototype`, as `listPush` already does.
 */

import { describe, it, expect } from "vitest";
import { listUnshift, listSplice } from "#helpers/intrinsics";

/**
 * Run `fn` with a setter at each of `indexes` on `Array.prototype` that counts the writes reaching it and defines the
 * element on the array written to, so arrays the process makes meanwhile keep working. The setters are removed before
 * this returns.
 * @param {number[]} indexes - The indexes.
 * @param {function(): *} fn - What to run.
 * @returns {{writes: number, result: *}} How many writes reached a setter, and what `fn` returned.
 */
function withIndexSetters(indexes, fn) {
	const counter = { writes: 0 };
	for (const index of indexes) {
		const key = String(index);
		Object.defineProperty(Array.prototype, key, {
			configurable: true,
			set(value) {
				counter.writes++;
				Object.defineProperty(this, key, { value, writable: true, enumerable: true, configurable: true });
			}
		});
	}
	let result;
	try {
		result = fn();
	} finally {
		for (const index of indexes) delete Array.prototype[String(index)];
	}
	return { writes: counter.writes, result };
}

describe("intrinsics list helpers and a setter on Array.prototype", () => {
	it("listUnshift defines the inserted elements when the list is shorter than the values", () => {
		const list = [];
		const { writes, result } = withIndexSetters([0, 1], () => listUnshift(list, "a", "b"));
		expect(writes).toBe(0);
		expect(result).toBe(2);
		expect(Object.getOwnPropertyNames(list)).toEqual(["0", "1", "length"]);
		expect(list).toEqual(["a", "b"]);
	});

	it("listUnshift moves existing elements and defines the inserted ones", () => {
		const list = ["x"];
		const { writes, result } = withIndexSetters([0, 1, 2], () => listUnshift(list, "a", "b"));
		expect(writes).toBe(0);
		expect(result).toBe(3);
		expect(list).toEqual(["a", "b", "x"]);
	});

	it("listSplice fills a hole it moves an element into without running the setter", () => {
		const list = ["a", "b", "c", "d"];
		delete list[1];
		// Removing "a" moves every later slot down by one: index 0 takes the hole, index 1 (a hole) takes "c".
		const { writes } = withIndexSetters([1], () => listSplice(list, 0, 1));
		expect(writes).toBe(0);
		expect(list.length).toBe(3);
		expect(Object.hasOwn(list, 1)).toBe(true);
		expect([list[1], list[2]]).toEqual(["c", "d"]);
	});
});
