/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/__mixed/lib/cjs-counter.cjs
 *	@Date: 2026-10-02 12:27:51 -07:00 (1790969271)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02 12:27:51 -07:00 (1790969271)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview CommonJS helper imported by ESM leaves (#534). Uses `exports.x =` assignments and
 * requires a second-level CommonJS helper and an ES module, so isolation is proven below it in both
 * module systems.
 * @module api_test_helper_imports.mixed.lib.cjsCounter
 * @internal
 */
const inner = require("./cjs-inner.cjs");
const deep = require("./esm-deep.mjs");

let count = 0;

/**
 * Increment this module's counter.
 * @returns {number} The counter after incrementing.
 */
exports.bump = function bump() {
	return ++count;
};

/**
 * Increment the second-level CommonJS helper's counter.
 * @returns {number} The counter after incrementing.
 */
exports.innerBump = () => inner.bump();

/**
 * Increment the counter of the ES module this helper requires.
 * @returns {number} The counter after incrementing.
 */
exports.deepBump = () => deep.bump();
