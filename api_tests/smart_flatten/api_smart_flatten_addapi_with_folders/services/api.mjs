/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi_with_folders/services/api.mjs
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
 * @fileoverview Services/api subfolder fixture for api_smart_flatten_addapi_with_folders.
 * @module api_smart_flatten_addapi_with_folders.services.api
 */
export function getPluginApiService() {
	return "plugin-api-service";
}

export function pluginApiMethod(action) {
	return `plugin-api-${action}`;
}
