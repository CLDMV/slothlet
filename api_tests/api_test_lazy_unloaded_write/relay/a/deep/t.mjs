/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_unloaded_write/relay/a/deep/t.mjs
 *	@Date: 2026-11-04T08:12:26-08:00 (1793808746)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T08:22:55-08:00 (1793809375)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module one folder below `a` (#653), loaded only once reached. It exports a member with a getter
 * only, so a change queued for it is refused.
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
