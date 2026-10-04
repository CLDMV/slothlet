/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions_owner/ext/main.mjs
 *	@Date: 2026-09-28 12:00:00 -07:00 (1790622000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:59 -07:00 (1791082979)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Entry leaf of the owner-grant extension (#509).
 *
 * @description
 * Mounted with one `api.add(..., { moduleID })`, so every leaf of this folder is owned by that one
 * module even though its files sit in different directories. Each export calls or reads a leaf in a
 * SUBDIRECTORY, which is its own permission module — a cross-directory call that `defaultPolicy:
 * "deny"` refuses unless `permissions.owner` grants it.
 *
 * @module api_tests/api_test_permissions_owner/ext/main
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Call the module's own leaf in `session/store.mjs`.
 * @returns {string} The store's result.
 * @public
 * @example
 * api.launcher.main.activate(); // "created"
 */
export function activate() {
	return self.launcher.session.store.create();
}

/**
 * Call the module's own leaf that an explicit deny rule covers in the owner tests.
 * @returns {string} The store's result.
 * @public
 * @example
 * api.launcher.main.teardown();
 */
export function teardown() {
	return self.launcher.session.store.destroy();
}

/**
 * Read the module's own data leaf in `settings/data.mjs`.
 * @returns {number} The configured limit.
 * @public
 * @example
 * api.launcher.main.limit(); // 5
 */
export function limit() {
	return self.launcher.settings.data.limit;
}

/**
 * Call a leaf of the base-loaded tree, which this module does not own.
 * @returns {string} The base leaf's result.
 * @public
 * @example
 * api.launcher.main.reachBase();
 */
export function reachBase() {
	return self.core.sub.beta.ping();
}
