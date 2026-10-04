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
 * Fixture for #366 ownership-revert coverage on the addApi/category-merge path (Rule 11 /
 * C33): a default-export-only `addapi.mjs` (no other named exports) merges its object
 * default's own keys directly into the `plugins` category namespace.
 *
 * `constructor` collides with the `plugins` namespace wrapper's own inherited
 * `Object.prototype.constructor` (see helperA.mjs's doc comment for the identical
 * mechanism) — always rejected under `collision: "skip"`, exercising the
 * `modes_addapiOneAssigned` false arm. `greeting` has no such collision and succeeds.
 */

export default {
	constructor: "not-a-function",
	greeting: "hello"
};
