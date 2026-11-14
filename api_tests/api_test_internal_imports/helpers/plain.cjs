/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_internal_imports/helpers/plain.cjs
 *	@Date: 2026-11-13T12:00:00-08:00 (1794600000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T12:00:00-08:00 (1794600000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper an api file requires through a `require` made from a plain path: one module of the process.
 * @module api_test_internal_imports.helpers.plain
 */

/**
 * Require a file.
 * @param {string} target - The specifier or path.
 * @returns {*} What it exports.
 */
const attempt = (target) => require(target);

module.exports = { attempt };
