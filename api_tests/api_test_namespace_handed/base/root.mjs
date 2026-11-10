/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_namespace_handed/base/root.mjs
 *	@Date: 2026-11-08T00:56:22-08:00 (1794128182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T01:00:32-08:00 (1794128432)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The base the handed-namespace tests mount their module onto.
 * @module api_test_namespace_handed/base
 */

/**
 * A member so the base has something to load.
 * @returns {string} Marker.
 * @example
 * ping(); // "root"
 */
export function ping() {
	return "root";
}
