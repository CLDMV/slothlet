/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_uwb_shapes/inst.mjs
 *	@Date: 2026-11-25T01:31:24-08:00 (1795599084)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:42:35-08:00 (1795599755)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module whose value is a class instance.
 */

/** A counter. */
class Counter {
	#count = 0;
	/** @returns {number} The incremented count. */
	inc() {
		this.#count++;
		return this.#count;
	}
	/** @returns {number} The count. */
	get value() {
		return this.#count;
	}
}

export default new Counter();
