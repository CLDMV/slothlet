/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_multi_default_ownership_revert/plugins/addapi.mjs
 *	@Date: 2026-09-14T15:15:27-07:00 (1789424127)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:27:54-07:00 (1791091674)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Fixture: an `addapi.mjs` alone in its folder (Rule 11 / C24). It composes as the folder's
 * self-named file, so its object default is the `plugins` node itself, and the default's own
 * `constructor` member is the node's `constructor`, as it is on the object in plain JavaScript.
 * The addApi/category-merge path's revert coverage uses `extensions/` instead.
 */

export default {
	constructor: "not-a-function",
	greeting: "hello"
};
