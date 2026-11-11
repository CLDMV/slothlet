/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_identity/api/runner.mjs
 *	@Date: 2026-11-11T13:00:00-08:00 (1794430800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:00:00-08:00 (1794430800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for what a file starts while it loads: a second module allowed the vault, which runs what it
 * is handed.
 * @module api_test_load_identity.runner
 */

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
