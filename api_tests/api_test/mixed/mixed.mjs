/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/mixed/mixed.mjs
 *	@Date: 2025-11-10T09:52:57-08:00 (1762797177)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:10 -08:00 (1772425270)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Mixed export test for Rule 8 Pattern B — filename matches folder, exports mixed default+named.
 * @module api_test.mixed
 * @memberof module:api_test
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

