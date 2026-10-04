/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collision_events/pkg_b/shared/alpha.mjs
 *	@Date: 2026-09-21 08:00:12 -07:00 (1790002812)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:34 -07:00 (1791082954)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Value leaf → `shared.alpha`. Collides with package A's; dropped under merge.
 * @module api_test_collision_events.pkg_b.shared.alpha
 */
/** @returns {string} Identifier. */
export function alpha() {
	return "B:alpha";
}
