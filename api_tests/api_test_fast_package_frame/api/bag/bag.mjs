/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_fast_package_frame/api/bag/bag.mjs
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
 * @fileoverview A module that hands out functions calling the vault: through the package, and directly.
 * @module api_test_fast_package_frame.bag
 * @memberof module:api_test_fast_package_frame
 */
import { self } from "@cldmv/slothlet/runtime";
import { descend } from "callback-walker";

/**
 * A function that has the package call the vault's node from `depth` frames of its own.
 * @function viaPackage
 * @memberof module:api_test_fast_package_frame.bag
 * @param {number} depth - How deep the package recurses.
 * @returns {function(): string} The function.
 * @example
 * (await api.bag.viaPackage(5))(); // "SECRET"
 */
export const viaPackage = (depth) => () => descend(depth, self.vault.get);

/**
 * A function that calls the vault's node itself.
 * @function direct
 * @memberof module:api_test_fast_package_frame.bag
 * @returns {function(): string} The function.
 * @example
 * (await api.bag.direct())(); // "SECRET"
 */
export const direct = () => () => self.vault.get();
