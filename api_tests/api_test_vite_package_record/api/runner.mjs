/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_vite_package_record/api/runner.mjs
 *	@Date: 2026-11-15T14:56:32-08:00 (1794783392)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:08-08:00 (1795869008)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that runs a function it is handed, giving it `self`.
 * @module api_test_vite_package_record.runner
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a function with `self`.
 * @param {function(object): *} fn - The function.
 * @returns {*} What it returned.
 * @example
 * api.runner.run((api) => api.vault.get()); // "SECRET"
 */
export function run(fn) {
	return fn(self);
}
