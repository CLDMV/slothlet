/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_quad_prefix/quadleaf.mjs
 *	@Date: 2026-06-18T00:00:00+00:00 (1781740800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:42-07:00 (1791090882)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture leaf that exports a `__`-prefixed member alongside a normal export.
 *
 * @description
 * When slothlet adopts this module's exports, the `__weird` key becomes an own
 * enumerable property on the UnifiedWrapper (a two-underscore prefix passes the
 * `___adoptImplChildren` filter).  During
 * `api.shutdown()` → `_drainInFlightLoads()`, the child-walk iterates
 * `Object.keys(wrapper)` on the `quadleaf` wrapper and encounters `__weird`.
 * The drain walk must pass over it without error.
 * This fixture exists solely to exercise that path.
 *
 * @module api_test_quad_prefix.quadleaf
 * @memberof module:api_test_quad_prefix
 */

/**
 * A `__`-prefixed export. slothlet adopts it as an own enumerable child of the
 * wrapper, which the drain walk in `_drainInFlightLoads`
 * meets during shutdown.
 * @type {{sub: function(): number}}
 */
export const __weird = {
	sub() {
		return 1;
	}
};

/**
 * An ordinary named export — ensures the wrapper is non-trivial and exercises the
 * ordinary key for contrast.
 * @returns {number} Always 42.
 */
export function normal() {
	return 42;
}
