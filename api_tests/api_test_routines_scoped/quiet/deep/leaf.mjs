/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_scoped/quiet/deep/leaf.mjs
 *	@Date: 2026-09-09 00:00:00 -07:00 (1788937200)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:03:16 -07:00 (1791082996)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A leaf nested two levels below the mount's own top level (#341), under the
 * unrelated `quiet` folder — used to prove a bounded-glob routine name (e.g. `"admin.*"`) never
 * force-materializes a sibling subtree its own segments don't name.
 * @module api_test_routines_scoped.quiet.deep.leaf
 * @memberof module:api_test_routines_scoped.quiet.deep
 */

/**
 * @function leaf
 * @memberof module:api_test_routines_scoped.quiet.deep
 * @returns {number} `1`.
 */
export default function leaf() {
	return 1;
}
