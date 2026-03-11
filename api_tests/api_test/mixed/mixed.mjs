/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/mixed/mixed.mjs
 *	@Date: 2025-11-10T09:52:57-08:00 (1762797177)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-10 23:40:34 -07:00 (1773211234)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Mixed export test for Rule 8 Pattern B — filename matches folder, exports mixed default+named.
 * @module api_test.mixed
 * @memberof module:api_test
 */
/**
 * @namespace mixed
 * @memberof module:api_test
 */
/**
 * Default callable function for the mixed module.
 * Accessed as `api.mixed(message)` in the slothlet API.
 * Demonstrates Rule 8 Pattern B: filename matches folder with mixed default+named exports.
 * @function mixed
 * @alias module:api_test.mixed
 * @memberof module:api_test
 * @param {string} message - Message to process
 * @returns {string} Processed message string
 * @example
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.mixed('hello')); // 'Mixed default: hello'
 */
function mixedDefault(message) {
	return `Mixed default: ${message}`;
}

/**
 * Named function for mixed export test.
 * @param {string} value - Value to process
 * @returns {string} Processed value
 */
export function mixedNamed(value) {
	return `Mixed named: ${value}`;
}

/**
 * Another named function for mixed export test.
 * @param {number} num - Number to process
 * @returns {number} Processed number
 */
export function mixedAnother(num) {
	return num * 2;
}

export default mixedDefault;
