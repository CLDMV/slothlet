/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_generator_steps/owner/owner.mjs
 *	@Date: 2026-11-13T10:00:00-08:00 (1794592800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T10:00:00-08:00 (1794592800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module whose generators another module steps through.
 * @module api_test_generator_steps/owner
 */

/** A class of this module's, whose instances the generators yield. */
class Item {
	/**
	 * @param {number} n - A number.
	 */
	constructor(n) {
		this.n = n;
	}
}

/**
 * A generator yielding a number and an instance, then returning a number.
 * @returns {Generator<number|Item, number>} The generator.
 */
export function* steps() {
	yield 1;
	yield new Item(2);
	return 3;
}

/**
 * An async generator yielding a number and an instance, then returning a number.
 * @returns {AsyncGenerator<number|Item, number>} The generator.
 */
export async function* asyncSteps() {
	yield 1;
	yield new Item(2);
	return 3;
}

/**
 * The member names on the prototype of this module's class, as the module reads them.
 * @returns {string[]} Its own keys besides `constructor`.
 */
export const itemPrototype = () => Object.getOwnPropertyNames(Item.prototype).filter((key) => key !== "constructor");
