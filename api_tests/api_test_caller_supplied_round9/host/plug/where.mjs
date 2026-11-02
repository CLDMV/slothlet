/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round9/host/plug/where.mjs
 *	@Date: 2026-10-18T12:34:35-07:00 (1792352075)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T12:52:01-07:00 (1792353121)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A folder of the same name beside the host entry, which the route does not name (#597).
 *
 * @module api_tests/api_test_caller_supplied_round9/host/plug/where
 */

/**
 * Which folder was added.
 * @returns {string} "host/plug".
 * @public
 * @example
 * api.p.where(); // "host/plug"
 */
export function where() {
	return "host/plug";
}
