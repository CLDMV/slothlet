/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_returned_instances_lib/util.mjs
 *	@Date: 2026-11-10T20:53:39-08:00 (1794372819)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-10T21:27:11-08:00 (1794374831)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper file that is no api file: `maker` imports it, and its functions read the runtime `self` and
 * `context` for the leaf that calls them.
 * @module api_test_returned_instances_lib/util
 */

import { self, context } from "@cldmv/slothlet/runtime";

/**
 * Call another module through `self`.
 * @returns {*} What `other.ping` returns.
 */
export const viaHelperSelf = () => self.other.ping();

/**
 * Read the runtime context.
 * @returns {*} The context's user.
 */
export const viaHelperContext = () => context.user;
