/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_crossing_rules/pair/keeper.mjs
 *	@Date: 2026-11-11T10:10:16-08:00 (1794420616)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T10:13:03-08:00 (1794420783)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview One of two files loaded from one folder: holds a class no node exports and hands its instances to what
 * the other file passes in.
 * @module api_test_crossing_rules/pair/keeper
 */

/** A class no node exports. */
class Kept {
	hi() {
		return "hi";
	}
}

/** `Kept`'s method as it was written. */
const originalHi = Kept.prototype.hi;

export const each = (cb) => cb(new Kept());
export const fill = (box) => {
	box.inst = new Kept();
};
export const give = () => new Kept();

/**
 * Which members whose name starts with `prefix` `Kept.prototype` holds, removing each, and whether its method is still
 * the one written (putting it back).
 * @param {string} prefix - The prefix.
 * @returns {string[]} The rest of each key found, and `"hi"` when the method was replaced.
 */
export function landed(prefix) {
	const hit = [];
	for (const key of Reflect.ownKeys(Kept.prototype))
		if (typeof key === "string" && key.startsWith(prefix)) {
			hit.push(key.slice(prefix.length));
			delete Kept.prototype[key];
		}
	if (Kept.prototype.hi !== originalHi) {
		hit.push("hi");
		Kept.prototype.hi = originalHi;
	}
	return hit;
}
