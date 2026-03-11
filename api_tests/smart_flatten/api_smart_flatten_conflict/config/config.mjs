/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_conflict/config/config.mjs
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
 * @fileoverview Subfolder config/config.mjs fixture for smart-flatten conflict testing.
 * Provides a same-name file-in-folder scenario alongside the root config.mjs.
 * @module api_smart_flatten_conflict.config
 */
// Subdirectory config/config.mjs file
export function getSubConfig() {
	return "sub-config-value";
}

export function setSubConfig() {
	return "sub-config-set";
}
