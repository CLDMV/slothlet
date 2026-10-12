/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_self_value_siblings/dial/dial.mjs
 *	@Date: 2026-10-11T22:30:00-07:00 (1791789000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T22:30:00-07:00 (1791789000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a self-named file whose default object has a getter.
 * @module api_smart_flatten_self_value_siblings.dial.dial
 */

export default {
	level: 1,
	/**
	 * @returns {number} Twice the level, read on every access.
	 */
	get double() {
		return this.level * 2;
	}
};
