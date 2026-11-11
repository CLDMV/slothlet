/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_identity/api/runner.mjs
 *	@Date: 2026-11-11T11:44:49-08:00 (1794426289)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:13:00-08:00 (1794431580)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for what a file starts while it loads: a second module allowed the vault, which runs what it
 * is handed.
 * @module api_test_load_identity.runner
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run what it is handed.
 * @param {Function} fn - The function.
 * @returns {*} What it returned.
 */
export const call = (fn) => fn();

/**
 * Map an array with what it is handed.
 * @param {Array<*>} list - The array.
 * @param {Function} fn - The function.
 * @returns {Array<*>} The results.
 */
export const map = (list, fn) => list.map(fn);

/**
 * Run a closure it asked `bag` for itself, handed nothing by its caller.
 * @returns {Promise<*>} What the closure returned.
 */
export const own = async () => (await self.bag.make())();

/**
 * Run a closure it asked `bag` for itself, inside a call that was handed a callback.
 * @param {Function} callback - A callback, which is not run.
 * @returns {Promise<*>} What the closure returned.
 */
export const ownWith = async (callback) => (typeof callback === "function" ? (await self.bag.make())() : undefined);
