/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/task/parse-json.mjs
 *	@Date: 2025-11-10T09:52:57-08:00 (1762797177)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-10 18:02:02 -08:00 (1770775322)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

function parseJSON(jsonString) {
	try {
		return JSON.parse(jsonString);
	} catch (error) {
		console.error("Invalid JSON:", error.message);
		return null;
	}
}

// Named export to test function name preference
export { parseJSON };

