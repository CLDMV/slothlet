/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_construct/lz/deep/maker.mjs
 *	@Date: 2026-11-01T09:37:45-08:00 (1793554665)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-01T10:20:34-08:00 (1793557234)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * A class reached through a folder that loads on first use.
 */
export class Maker {
	/**
	 * @param {*} x - Kept on the instance.
	 */
	constructor(x) {
		this.v = "made";
		this.x = x;
	}

	/** @returns {string} What the instance says. */
	say() {
		return `${this.v}:${this.x}`;
	}
}
