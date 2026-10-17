/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi_beside_self/dial/addapi.mjs
 *	@Date: 2026-10-12T02:05:41-07:00 (1791795941)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T02:38:09-07:00 (1791797889)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): an addapi object default with a getter, beside its folder's self-named file.
 * @module api_smart_flatten_addapi_beside_self.dial.addapi
 */

export default {
	level: 1,
	get double() {
		return this.level * 2;
	}
};
