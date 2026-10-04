/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_scoped/admin/deep/leaf.mjs
 *	@Date: 2026-09-09T00:00:00-07:00 (1788937200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:28:03-07:00 (1791091683)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A leaf nested two levels below the mount's own top level (#341), under `admin` —
 * used to prove a `**`-suffixed routine name (e.g. `"admin.**"`) reaches arbitrary depth WITHIN the
 * branch its own literal prefix narrows to, while the unrelated `quiet` sibling stays untouched.
 * @module api_test_routines_scoped.admin.deep.leaf
 * @memberof module:api_test_routines_scoped.admin.deep
 */

/**
 * @function leaf
 * @memberof module:api_test_routines_scoped.admin.deep
 * @returns {number} `1`.
 */
export default function leaf() {
	return 1;
}
