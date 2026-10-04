/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_typegen_mixed/math.mjs
 *	@Date: 2026-09-28T00:01:45-07:00 (1790578905)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:46-07:00 (1791090886)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Named-export functions typed with JSDoc (typegen mixed-tree fixture, #484).
 * @module api_test_typegen_mixed.math
 */

/**
 * Add two numbers.
 * @param {number} a - First addend.
 * @param {number} b - Second addend.
 * @returns {number} The sum.
 */
export function add(a, b) {
	return a + b;
}

/**
 * Repeat a string.
 * @param {string} text - Text to repeat.
 * @param {number} [times=2] - Repeat count.
 * @returns {string} The repeated text.
 */
export function repeat(text, times = 2) {
	return text.repeat(times);
}
