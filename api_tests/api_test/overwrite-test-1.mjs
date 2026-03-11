/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/overwrite-test-1.mjs
 *	@Date: 2026-01-20T20:25:54-08:00 (1768969554)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:11 -08:00 (1772425271)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview First file in overwrite test — loaded first alphabetically.
 * @module api_test.overwriteTest1
 * @memberof module:api_test
 */
/**
 * @namespace overwriteTest1
 * @memberof module:api_test
 */

export function overwriteTest() {
	return "overwrite-test-1";
}

/**
	* Named export that will be overwritten
	* @returns {string} Version identifier
	*/
export function conflictingName() {
	return "from-file-1";
}

