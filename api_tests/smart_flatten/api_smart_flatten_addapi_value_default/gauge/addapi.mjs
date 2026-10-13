/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi_value_default/gauge/addapi.mjs
 *	@Date: 2026-10-11T21:38:05-07:00 (1791779885)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T22:03:06-07:00 (1791781386)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): an addapi file whose default object has a getter.
 * @module api_smart_flatten_addapi_value_default.gauge.addapi
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
