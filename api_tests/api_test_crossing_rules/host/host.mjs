/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_crossing_rules/host/host.mjs
 *	@Date: 2026-11-11T10:00:39-08:00 (1794420039)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T10:13:02-08:00 (1794420782)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The base module of the crossing rules fixture: the host's own leaf.
 * @module api_test_crossing_rules/host
 */

/**
 * Answer a call.
 * @returns {string} `"pong"`.
 */
export function ping() {
	return "pong";
}

/**
 * Take a value and say what it is: a call the host makes, for modules to hook.
 * @param {*} value - The value.
 * @returns {string} Its type.
 */
export function take(value) {
	return typeof value;
}
