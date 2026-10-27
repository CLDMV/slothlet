/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi_beside_self/lock/addapi.mjs
 *	@Date: 2026-10-12T03:04:40-07:00 (1791799480)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T03:42:04-07:00 (1791801724)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a frozen function addapi default with a named export, beside its folder's self-named file.
 * @module api_smart_flatten_addapi_beside_self.lock.addapi
 */

export default Object.freeze(function seal() {
	return "seal";
});

export const extra = 3;
