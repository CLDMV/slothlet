/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round9/host/routes/plug/where.mjs
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
 * @fileoverview The folder the route's relative add names (#597).
 *
 * @module api_tests/api_test_caller_supplied_round9/host/routes/plug/where
 */

/**
 * Which folder was added.
 * @returns {string} "routes/plug".
 * @public
 * @example
 * api.p.where(); // "routes/plug"
 */
export function where() {
	return "routes/plug";
}
