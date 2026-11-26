/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_node_shape_plain_js/shapes.mjs
 *	@Date: 2026-11-25T02:41:09-08:00 (1795603269)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T03:23:17-08:00 (1795605797)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/** A class the module keeps to itself: only its instance is exported. */
class Kept {
	constructor() {
		this.count = 1;
	}
	/**
	 * Count one more.
	 * @returns {number} The new count.
	 */
	increment() {
		return ++this.count;
	}
}

/** An instance of a class the module keeps to itself. */
export const kept = new Kept();

/** A plain object. */
export const plain = { a: 1 };
