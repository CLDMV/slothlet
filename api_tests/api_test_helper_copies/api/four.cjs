/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_copies/api/four.cjs
 *	@Date: 2026-11-12T00:24:01-08:00 (1794471841)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T00:24:01-08:00 (1794471841)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS api file requiring the helper file `tally.cjs`, which other api files load too.
 * @module api_test_helper_copies.four
 */
const tally = require("../helpers/tally.cjs");

/**
 * Count one up in the CommonJS helper this file requires.
 * @returns {number} The count so far in the copy of the helper this file got.
 * @example
 * await api.four.bumpCjs(); // 1
 */
function bumpCjs() {
	return tally.bump();
}

/**
 * Answer a ping.
 * @returns {string} "pong".
 * @example
 * await api.four.ping(); // "pong"
 */
function ping() {
	return "pong";
}

module.exports = { bumpCjs, ping };
