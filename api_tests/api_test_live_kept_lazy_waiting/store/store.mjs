/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_kept_lazy_waiting/store/store.mjs
 *	@Date: 2026-10-25T02:50:59-07:00 (1792921859)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T03:12:48-07:00 (1792923168)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#661): a module whose `sub` folder loads separately in lazy mode.
 */

/**
 * An async function.
 * @returns {Promise<string>} "W".
 */
export async function work() {
	return "W";
}
