/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_modes_debug/logger.mjs
 *	@Date: 2026-03-01 15:24:30 -08:00 (1772407470)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:14 -08:00 (1772425274)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Root-level logger module for modes-processor debug coverage testing.
 * @module api_test_modes_debug.logger
 * @memberof module:api_test_modes_debug
 */
/**
 * @namespace logger
 * @memberof module:api_test_modes_debug
 * @alias module:api_test_modes_debug.logger
 */

/**
 * Root-level logger.mjs: exists alongside the logger/ folder to create a
 * file-folder collision. Using NAMED exports only (no default) so the flattening
 * decision creates api["logger"] = wrapper, which the logger/ subdirectory
 * processFiles call then finds as an existingTarget with a wrapper → triggers:
 *   line 88: if (existingTarget && resolveWrapper(existingTarget))
 *   line 89: if (this.slothlet.config.debug?.modes)    ← uncovered (needs debug.modes=true)
 *   lines 90-96: debug log CATEGORY_REUSE_EXISTING_WRAPPER
 */

/**
 * @param {string} msg
 * @returns {string}
 */
export function log(msg) {
	return `[ROOT-LOG] ${msg}`;
}

/** @type {string} */
export const source = "root";
