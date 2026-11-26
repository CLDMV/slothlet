/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_node_shape_plain_js/inst.mjs
 *	@Date: 2026-11-25T02:36:53-08:00 (1795603013)
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
class Counter {
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

export default new Counter();
