/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round9/base/probe/ping.mjs
 *	@Date: 2026-10-18T12:34:35-07:00 (1792352075)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T12:51:59-07:00 (1792353119)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The base for the ninth round of caller-supplied-code tests (#597).
 *
 * @module api_tests/api_test_caller_supplied_round9/base/probe/ping
 */

/**
 * Answer.
 * @returns {string} "pong".
 * @public
 * @example
 * api.probe.ping.ping(); // "pong"
 */
export function ping() {
	return "pong";
}
