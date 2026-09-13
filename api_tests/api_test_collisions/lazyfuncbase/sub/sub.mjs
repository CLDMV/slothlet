/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/lazyfuncbase/sub/sub.mjs
 *	@Date: 2026-09-11 10:22:00 -07:00 (1789147320)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-11 10:23:29 -07:00 (1789147409)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Self-named single-file lazy folder: "sub" contains only "sub.mjs", so its default
 * export hoists to become the folder wrapper's OWN callable content (smart-flatten case 2) — used to
 * reproduce a lazy wrapper whose materialized `impl` is itself a function, the exact shape
 * syncWrapper's final bookkeeping misreads as "not materialized" (see PR #364 review).
 * @module api_test_collisions.lazyfuncbase.sub
 * @memberof module:api_test_collisions.lazyfuncbase
 */

export default function sub(x) {
	return `from-lazyfuncbase-sub:${x}`;
}
