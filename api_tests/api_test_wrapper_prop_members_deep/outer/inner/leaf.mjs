/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_wrapper_prop_members_deep/outer/inner/leaf.mjs
 *	@Date: 2026-10-07T00:00:00-07:00 (1791356400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-07T00:00:00-07:00 (1791356400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */
/**
 * @fileoverview Fixture (#571): a leaf two lazy folders deep, whose folders have no `name` member,
 * so a mount at `outer.inner.name` must classify `name` against `inner` itself.
 * @module api_test_wrapper_prop_members_deep.outer.inner.leaf
 */

/**
 * @returns {string} Marker naming this leaf.
 */
export function leaf() {
	return "outer.inner.leaf";
}
