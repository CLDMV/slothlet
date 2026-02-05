/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/overwrite-test-2.mjs
 *	@Date: 2026-01-20T20:25:54-08:00 (1768969554)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:40:07 -08:00 (1770266407)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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







