/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_unloaded_write/race/a/sub/z.mjs
 *	@Date: 2026-11-04T07:41:09-08:00 (1793806869)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T07:51:19-08:00 (1793807479)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module one folder below `a` (#653), loaded only once `a` has: a change queued on `a` for it moves
 * down to it. It exports a member with a getter only, so that change is refused.
 */

/**
 * An export with a getter and no setter: assigning the member is refused.
 * @type {{g: number}}
 */
export const getterOnly = {
	get g() {
		return 1;
	}
};
