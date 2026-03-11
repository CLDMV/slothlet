/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_multiple_roots/overwrite-test-2.mjs
 *	@Date: 2026-01-23T17:35:04-08:00 (1769218504)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:15 -08:00 (1772425275)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Second overwrite test module for api_test_multiple_roots testing.
 * @module api_test_multiple_roots.overwriteTest2
 * @memberof module:api_test_multiple_roots
 */

export function overwriteTest() {
	return "overwrite-test-2";
}

/**
 * Named export attempting to overwrite the one from file 1
 * @returns {string} Version identifier
 */
export function conflictingName() {
	return "from-file-2";
}

