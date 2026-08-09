/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reserved_nested/buy.mjs
 *	@Date: 2026-08-08 22:00:00 -07:00 (1786251600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-08 22:49:59 -07:00 (1786254599)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

// A public sibling so the mount is a normal directory with a nested reserved-name namespace.

/**
 * Public callable leaf.
 * @returns {number} Marker.
 */
export function buy() {
	return 1;
}
