/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_typegen_mixed/text.cjs
 *	@Date: 2026-09-28 00:01:45 -07:00 (1790578905)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:03:23 -07:00 (1791083003)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview CommonJS object export: a function and an object leaf (typegen mixed-tree fixture, #484).
 * @module api_test_typegen_mixed.text
 */

/**
 * Upper-case a string.
 * @param {string} value - Text to shout.
 * @returns {string} The upper-cased text.
 */
function shout(value) {
	return value.toUpperCase();
}

const stats = {
	/**
	 * Count the words in a string.
	 * @param {string} value - Text to count.
	 * @returns {number} Word count.
	 */
	words(value) {
		return value.split(/\s+/).filter(Boolean).length;
	}
};

module.exports = { shout, stats };
