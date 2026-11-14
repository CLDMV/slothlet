/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_detached_flow/api/alpha.mjs
 *	@Date: 2026-11-13T08:00:00-08:00 (1794585600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T08:00:00-08:00 (1794585600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that hands out the helper's async function: returned as it is, and nested in plain data.
 * @module api_test_live_detached_flow.alpha
 * @memberof module:api_test_live_detached_flow
 */
import { readLater } from "../helpers/shared.mjs";

/**
 * Hand out the helper's function.
 * @function giveLater
 * @memberof module:api_test_live_detached_flow.alpha
 * @returns {function(): Promise<string>} The function.
 * @example
 * await (await api.alpha.giveLater())(); // "SECRET"
 */
export const giveLater = () => readLater;

/**
 * Hand out the helper's function nested in plain data.
 * @function box
 * @memberof module:api_test_live_detached_flow.alpha
 * @returns {{run: function(): Promise<string>}} The data.
 * @example
 * await (await api.alpha.box()).run(); // "SECRET"
 */
export const box = () => ({ run: readLater });
