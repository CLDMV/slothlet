/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/overwrite-test-2.mjs
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
 * @fileoverview Second file in overwrite test — loaded second, tests api.mutations.reload overwrite behavior.
 * @module api_test.overwriteTest2
 * @memberof module:api_test
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

