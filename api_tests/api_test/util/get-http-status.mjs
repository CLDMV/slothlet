/**
 * @fileoverview Function name preference test for getHTTPStatus.
 * Tests Rule 9 - Function Name Preference Over Sanitization.
 * File: get-http-status.mjs, Function: getHTTPStatus (preserves HTTP capitalization)
 */

/**
 * Gets HTTP status message for status code.
 * @param {number} statusCode - HTTP status code
 * @returns {string} Status message
 * @example
 * api.util.getHTTPStatus(200); // → "200 OK"
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
