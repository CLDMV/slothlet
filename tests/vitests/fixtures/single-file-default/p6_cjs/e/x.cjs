/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/single-file-default/p6_cjs/e/x.cjs
 *	@Date: 2026-11-14T08:20:39-08:00 (1794673239)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:08:55-08:00 (1794676135)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS file whose `module.exports` is a function with a function property (#773).
 * @module single-file-default.p6_cjs
 */

/**
 * The file's exported function.
 * @returns {string} Where it comes from.
 */
function run() {
	return "e/x.cjs:default";
}

/**
 * A property of the exported function.
 * @returns {string} Where it comes from.
 */
run.helper = function helper() {
	return "e/x.cjs:helper";
};

module.exports = run;
