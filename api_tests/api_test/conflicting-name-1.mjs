/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/overwrite-test-1.mjs
 *	@Date: 2026-01-20T20:25:54-08:00 (1768969554)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-10 18:02:01 -08:00 (1770775321)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
	* Named export that will be overwritten
	* @returns {string} Version identifier
	*/
export function conflictingName() {
	return "from-file-1";
}

