/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi/addapi.mjs
 *	@Date: 2026-01-04T16:31:08-08:00 (1767573068)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:20 -08:00 (1772425280)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview AddApi fixture — object default with named exports.
 * Exercises the addapi eager single-file folder path (modes-processor lines 874-877).
 * @module api_smart_flatten_addapi.addapi
 */
export function initializePlugin() {
	return "Plugin initialized";
}

export function pluginMethod() {
	return "Plugin method called";
}

export function cleanup() {
	return "Plugin cleaned up";
}

export default {
	special: "addapi-file",
	autoFlatten: true
};

