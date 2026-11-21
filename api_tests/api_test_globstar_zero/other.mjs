/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_globstar_zero/other.mjs
 *	@Date: 2026-11-11T20:58:48-08:00 (1794459528)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:56:15-08:00 (1794477375)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file no pattern in the tests names.
 * @module api_test_globstar_zero.other
 * @memberof module:api_test_globstar_zero
 */

/**
 * A function no pattern in the tests names.
 * @function ping
 * @memberof module:api_test_globstar_zero.other
 * @returns {string} "pong"
 * @example
 * api.other.ping(); // "pong"
 */
export function ping() {
	(globalThis.__slothletGlobstarLog ??= []).push("other.ping");
	return "pong";
}
