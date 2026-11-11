/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_crossing_rules/owner/owner.mjs
 *	@Date: 2026-11-11T10:00:39-08:00 (1794420039)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T10:13:02-08:00 (1794420782)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Holds a class no node exports and hands its instances, and data holding them, to other modules.
 * @module api_test_crossing_rules/owner
 */

/** A class no node exports. */
class Foo {
	hi() {
		return "hi";
	}
}

/** One object this module holds. */
const held = { n: 1, inst: new Foo() };

/** `Foo`'s method as it was written. */
const originalHi = Foo.prototype.hi;

export const getHeld = () => held;
export const isHeld = (value) => value === held;

/**
 * Which members whose name starts with `prefix` `Foo.prototype` holds, removing each, and whether its method is still
 * the one written (putting it back).
 * @param {string} prefix - The prefix.
 * @returns {string[]} The rest of each key found, and `"hi"` when the method was replaced.
 */
export function landed(prefix) {
	const hit = [];
	for (const key of Reflect.ownKeys(Foo.prototype))
		if (typeof key === "string" && key.startsWith(prefix)) {
			hit.push(key.slice(prefix.length));
			delete Foo.prototype[key];
		}
	if (Foo.prototype.hi !== originalHi) {
		hit.push("hi");
		Foo.prototype.hi = originalHi;
	}
	return hit;
}
