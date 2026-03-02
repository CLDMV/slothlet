/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/task/parse-json.mjs
 *	@Date: 2025-11-10T09:52:57-08:00 (1762797177)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:11 -08:00 (1772425271)
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

