/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_crossing_rules/reader/reader.mjs
 *	@Date: 2026-11-11T10:00:39-08:00 (1794420039)
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
 * @fileoverview Two functions of one module reading the same value of another module's: one a write rule names, one
 * it does not.
 * @module api_test_crossing_rules/reader
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * What one function of this module gets of the owner's held object, and how a write onto its instance's prototype ends.
 * @param {string} key - The member to write.
 * @returns {{wrapped: boolean, isHeld: boolean, write: string}} What it got.
 */
function probe(key) {
	const value = self.owner.getHeld();
	let write;
	try {
		Object.getPrototypeOf(value.inst)[key] = () => "planted";
		write = "written";
	} catch (error) {
		write = error?.code ?? String(error);
	}
	return { wrapped: self.slothlet.wrapped(value), isHeld: self.owner.isHeld(value), write };
}

export const plain = (key) => probe(key);
export const writer = (key) => probe(key);
