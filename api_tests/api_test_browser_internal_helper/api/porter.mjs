/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_browser_internal_helper/api/porter.mjs
 *	@Date: 2026-11-15T09:00:00-08:00 (1794762000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:04:59-08:00 (1795536299)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A browser api leaf whose helper files import slothlet's internal files by URL and use their exports.
 * @module api_test_browser_internal_helper.porter
 */
import { useInternal as inside } from "./__door.mjs";
import { useInternal as outside } from "../lib/door.mjs";

/**
 * Have the helper inside the module's folder use one of slothlet's internal exports.
 * @function viaInside
 * @memberof module:api_test_browser_internal_helper.porter
 * @param {string} lib - The URL of slothlet's `lib/` folder as the page serves it.
 * @returns {Promise<string>} The outcome.
 * @example
 * await api.porter.viaInside("/src/lib/"); // "MODULE_INTERNAL_NOT_IMPORTABLE"
 */
export const viaInside = (lib) => inside(lib);

/**
 * Have the helper outside every module's folder use one of slothlet's internal exports.
 * @function viaOutside
 * @memberof module:api_test_browser_internal_helper.porter
 * @param {string} lib - The URL of slothlet's `lib/` folder as the page serves it.
 * @returns {Promise<string>} The outcome.
 * @example
 * await api.porter.viaOutside("/src/lib/");
 */
export const viaOutside = (lib) => outside(lib);
