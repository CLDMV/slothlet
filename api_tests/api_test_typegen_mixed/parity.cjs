/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_typegen_mixed/parity.cjs
 *	@Date: 2026-09-28 00:01:45 -07:00 (1790578905)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 00:49:33 -07:00 (1790581773)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview CommonJS function export via `module.exports = function` (typegen mixed-tree fixture, #484).
 * @module api_test_typegen_mixed.parity
 */

/**
 * Whether a number is even.
 * @param {number} n - Number to test.
 * @returns {boolean} True when even.
 */
module.exports = function parity(n) {
	return n % 2 === 0;
};
