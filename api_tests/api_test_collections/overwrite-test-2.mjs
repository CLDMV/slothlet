/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collections/overwrite-test-2.mjs
 *	@Date: 2026-02-16T17:50:31-08:00 (1771293031)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-21 15:36:31 -08:00 (1771716991)
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

