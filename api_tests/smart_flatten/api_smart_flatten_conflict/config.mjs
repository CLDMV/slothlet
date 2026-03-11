/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_conflict/config.mjs
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
 * @fileoverview Root-level config.mjs fixture for smart-flatten conflict testing.
 * Collides with the config/ subfolder to test flatten conflict resolution.
 * @module api_smart_flatten_conflict.configFile
 */
// Root-level config.mjs file
export function getRootConfig() {
	return "root-config-value";
}

export function setRootConfig() {
	return "root-config-set";
}
