/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_resumed_runs_code/bag/bag.mjs
 *	@Date: 2026-11-11T22:41:29-08:00 (1794465689)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:58:06-08:00 (1794477486)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that hands out a function which reads the vault.
 * @module api_test_resumed_runs_code.bag
 * @memberof module:api_test_resumed_runs_code
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * A function of this module's that reads the vault.
 * @function make
 * @memberof module:api_test_resumed_runs_code.bag
 * @returns {function(): string} The function.
 * @example
 * const fn = await api.bag.make();
 */
export const make = () => () => self.vault.get();
