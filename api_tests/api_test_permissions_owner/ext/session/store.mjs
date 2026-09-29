/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions_owner/ext/session/store.mjs
 *	@Date: 2026-09-28 12:00:00 -07:00 (1790622000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 12:00:00 -07:00 (1790622000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Session store of the owner-grant extension (#509) — a subdirectory of the module.
 * @module api_tests/api_test_permissions_owner/ext/session/store
 */

/**
 * Create a session.
 * @returns {string} Marker.
 * @public
 * @example
 * api.launcher.session.store.create(); // "created"
 */
export function create() {
	return "created";
}

/**
 * Destroy a session.
 * @returns {string} Marker.
 * @public
 * @example
 * api.launcher.session.store.destroy(); // "destroyed"
 */
export function destroy() {
	return "destroyed";
}
