/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/util/get-http-status.mjs
 *	@Date: 2025-11-10T09:52:57-08:00 (1762797177)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:12 -08:00 (1772425272)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

function getHTTPStatus(statusCode) {
	const statusMessages = {
		200: "OK",
		404: "Not Found",
		500: "Internal Server Error",
		403: "Forbidden",
		401: "Unauthorized"
	};

	return `${statusCode} ${statusMessages[statusCode] || "Unknown"}`;
}

// Named export to test function name preference
export { getHTTPStatus };

