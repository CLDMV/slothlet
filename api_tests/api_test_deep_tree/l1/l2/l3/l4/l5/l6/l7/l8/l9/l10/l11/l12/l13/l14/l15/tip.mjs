/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_deep_tree/l1/l2/l3/l4/l5/l6/l7/l8/l9/l10/l11/l12/l13/l14/l15/tip.mjs
 *	@Date: 2026-08-04 12:00:00 -07:00 (1785870000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-04 12:00:00 -07:00 (1785870000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview The single leaf of a directory tree nested deeper than any fixed traversal cutoff.
 *
 * @description
 * `apiDepth` is unbounded by default, so enumeration must reach this file no matter how deep it
 * sits. A hard-coded settle depth returns a silently incomplete answer instead of failing, which
 * is the worst shape for an API whose whole job is to list what exists.
 * @module api_test_deep_tree.tip
 */

/**
 * Marker leaf at the bottom of the chain.
 * @returns {string} Fixed marker.
 * @public
 */
export function tip() {
	return "bottom";
}
