/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_multi_default_ownership_revert/extensions/addapi.mjs
 *	@Date: 2026-10-11T23:45:00-07:00 (1791793500)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T23:45:00-07:00 (1791793500)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Fixture for #366 ownership-revert coverage on the addApi/category-merge path (Rule 11 /
 * C24): beside the folder's own self-named file, an `addapi.mjs` merges its object default's
 * own keys into the `extensions` node.
 *
 * `constructor` collides with the node's own inherited `Object.prototype.constructor` (see
 * helperA.mjs's doc comment for the identical mechanism) and is always rejected under
 * `collision: "skip"`, exercising the `modes_addapiOneAssigned` false arm. `greeting` has no
 * such collision and succeeds.
 */

export default {
	constructor: "not-a-function",
	greeting: "hello"
};
