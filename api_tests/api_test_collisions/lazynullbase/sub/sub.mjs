/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/lazynullbase/sub/sub.mjs
 *	@Date: 2026-09-11 11:09:37 -07:00 (1789150177)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-11 11:23:22 -07:00 (1789151002)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Self-named single-file lazy folder whose default export is a legitimate `null`
 * value — "sub" materializes to `impl === null`, which is valid content, not an unmaterialized
 * placeholder. Used to reproduce syncWrapper's final bookkeeping misreading a real null export as
 * unmaterialized (PR #366 review, following the earlier callable-impl variant of the same bug).
 * @module api_test_collisions.lazynullbase.sub
 * @memberof module:api_test_collisions.lazynullbase
 */

export default null;
