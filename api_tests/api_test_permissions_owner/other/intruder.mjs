/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions_owner/other/intruder.mjs
 *	@Date: 2026-09-28T12:00:00-07:00 (1790622000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:41-07:00 (1791090881)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A second module mounted into the extension's namespace (#509).
 *
 * @description
 * Shares the extension's mount path but is added under its own moduleID, so it owns none of the
 * extension's leaves: the owner grant must not reach across to it.
 *
 * @module api_tests/api_test_permissions_owner/other/intruder
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Call the extension's store leaf.
 * @returns {string} The store's result.
 * @public
 * @example
 * api.launcher.intruder.poke();
 */
export function poke() {
	return self.launcher.session.store.create();
}

/**
 * Read the extension's data leaf.
 * @returns {number} The limit.
 * @public
 * @example
 * api.launcher.intruder.peek();
 */
export function peek() {
	return self.launcher.settings.data.limit;
}
