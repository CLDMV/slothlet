/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/lazybase/sub/test-func.mjs
 *	@Date: 2026-09-09 19:03:16 -07:00 (1789005796)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-09 19:03:16 -07:00 (1789005796)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test function module for lazy-mode untouched-collision testing: lives one level
 * below the mount's own top level ("sub"), so it stays a genuinely unmaterialized lazy leaf until
 * individually touched — unlike dir1/dir2's bare top-level `testFunc.mjs`, which is always eager as
 * the mount's own top level, and unlike anything mounted via `api.slothlet.api.add()`, which is
 * always eager regardless of the instance's overall lazy/eager mode.
 * @module api_test_collisions.lazybase.sub.testFunc
 * @memberof module:api_test_collisions
 */
/**
 * @namespace sub
 * @memberof module:api_test_collisions.lazybase
 * @alias module:api_test_collisions.lazybase.sub
 */
/**
 * @namespace testFunc
 * @memberof module:api_test_collisions.lazybase.sub
 * @alias module:api_test_collisions.lazybase.sub.testFunc
 */

export function testFunc() {
	return "from-lazybase-sub";
}
