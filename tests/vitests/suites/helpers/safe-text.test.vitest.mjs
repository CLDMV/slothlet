/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/safe-text.test.vitest.mjs
 *	@Date: 2026-11-16T02:14:26-08:00 (1794824066)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:29:55-08:00 (1794882595)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview slothlet renders values into its error text without running code the value carries: a `toJSON`, a
 * getter, a `toString` or `Symbol.toPrimitive` on the value is not read, and plain data renders as `String()` and
 * `JSON.stringify` render it.
 */

import { describe, it, expect } from "vitest";
import { stringOf, jsonOf } from "#helpers/intrinsics";
import { SlothletError } from "@cldmv/slothlet/errors";
import { translate } from "@cldmv/slothlet/i18n";

/**
 * An object that notes every read of code it carries.
 * @param {string[]} ran - Where the reads are noted.
 * @returns {object} The object.
 */
function carrier(ran) {
	return {
		a: 1,
		nested: { b: [1, "two", null] },
		toJSON() {
			ran.push("toJSON");
			return "steered";
		},
		toString() {
			ran.push("toString");
			return "steered";
		},
		[Symbol.toPrimitive]() {
			ran.push("toPrimitive");
			return "steered";
		},
		get c() {
			ran.push("getter");
			return 3;
		}
	};
}

describe("safe text of values", () => {
	it.each([["a"], [1], [true], [null], [undefined], [12n], [Symbol("s")], [["a", 1, null, [2, 3]]], [{ a: 1 }], [new TypeError("bad")]])(
		"stringOf(%s) is what String() gives for plain data",
		(value) => {
			expect(stringOf(value)).toBe(String(value));
		}
	);

	it.each([[{ a: 1, b: [1, { c: "d" }] }], [[1, "x", null]], ["s"], [3], [null]])(
		"jsonOf(%j) is what JSON.stringify gives for plain data",
		(value) => {
			expect(jsonOf(value)).toBe(JSON.stringify(value));
		}
	);

	it("reads no code a value carries", () => {
		const ran = [];
		const value = carrier(ran);
		expect(stringOf(value)).toBe("[object Object]");
		expect(jsonOf(value)).toBe('{"a":1,"nested":{"b":[1,"two",null]}}');
		expect(ran).toEqual([]);
	});

	it("an error made with a thrown value renders it without running its code", () => {
		const ran = [];
		const error = new SlothletError("INVALID_CONFIG", {}, { cause: carrier(ran) });
		expect(ran).toEqual([]);
		expect(error.message).not.toContain("steered");
	});

	it("a translated message renders a parameter without running its code", () => {
		const ran = [];
		const text = translate("PERMISSION_DENIED", { caller: carrier(ran), target: "x" });
		expect(ran).toEqual([]);
		expect(text).not.toContain("steered");
	});
});
