/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_quad_prefix/quadleaf.mjs
 *	@Date: 2026-06-18T00:00:00-00:00 (1750204800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-18 00:00:00 -00:00 (1750204800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Fixture leaf that exports a `____`-prefixed member alongside a normal export.
 *
 * @description
 * When slothlet adopts this module's exports, the `____weird` key becomes an own
 * enumerable property on the UnifiedWrapper (four-underscore prefix is not in
 * `internalKeys` and passes the `___adoptImplChildren` filter).  During
 * `api.shutdown()` → `_drainInFlightLoads()`, the child-walk iterates
 * `Object.keys(wrapper)` on the `quadleaf` wrapper and encounters `____weird`.
 * The guard `if (!key.startsWith("____"))` is FALSE — the skip arm fires.
 * This fixture exists solely to exercise that branch.
 *
 * @module api_test_quad_prefix.quadleaf
 * @memberof module:api_test_quad_prefix
 */

/**
 * A `____`-prefixed export. slothlet adopts it as an own enumerable child of the
 * wrapper, which causes the `startsWith("____")` skip arm in `_drainInFlightLoads`
 * to fire during shutdown.
 * @type {{sub: function(): number}}
 */
export const ____weird = {
	sub() {
		return 1;
	}
};

/**
 * An ordinary named export — ensures the wrapper is non-trivial and exercises the
 * normal (true) arm of the same guard for contrast.
 * @returns {number} Always 42.
 */
export function normal() {
	return 42;
}
