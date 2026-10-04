/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions_owner/base/core/alpha.mjs
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
 * @fileoverview Base-loaded leaf that calls into a subdirectory (#509).
 *
 * @description
 * Everything the initial load composes is owned by the base module, so this cross-directory call is
 * an own call under `permissions.owner`.
 *
 * @module api_tests/api_test_permissions_owner/base/core/alpha
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Call the base tree's own leaf in `core/sub/beta.mjs`.
 * @returns {string} The beta leaf's result.
 * @public
 * @example
 * api.core.alpha.callBeta(); // "pong"
 */
export function callBeta() {
	return self.core.sub.beta.ping();
}

/**
 * Call a leaf of the added extension, which the base module does not own.
 * @returns {string} The store's result.
 * @public
 * @example
 * api.core.alpha.reachExt();
 */
export function reachExt() {
	return self.launcher.session.store.create();
}
