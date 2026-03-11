/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi_with_folders/addapi.mjs
 *	@Date: 2026-01-04T16:31:08-08:00 (1767573068)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-10 21:07:57 -07:00 (1773202077)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview AddApi fixture with sibling subfolders — object default with named exports.
 * Tests that the addapi eager path works correctly when the root dir also contains subfolders.
 * @module api_smart_flatten_addapi_with_folders.addapi
 */
export function initializeMainPlugin() {
	return "Main plugin initialized from addapi.mjs";
}

export function pluginGlobalMethod() {
	return "Global plugin method from addapi.mjs";
}

export const pluginVersion = "1.0.0";
