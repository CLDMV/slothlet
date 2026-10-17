/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi_beside_self/latch/addapi.mjs
 *	@Date: 2026-10-12T10:57:33-07:00 (1791827853)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T11:33:24-07:00 (1791830004)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): an addapi getter merged in before its folder's self-named function takes the slot.
 * @module api_smart_flatten_addapi_beside_self.latch.addapi
 */

export default {
	level: 1,
	get double() {
		return this.level * 2;
	}
};
