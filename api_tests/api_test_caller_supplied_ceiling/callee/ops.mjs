/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_ceiling/callee/ops.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The callee for the ceiling tests (#597): converts what it is handed, which runs any `toString`
 * the value carries inside this module's call.
 *
 * @module api_tests/api_test_caller_supplied_ceiling/callee/ops
 */

/**
 * Convert the value to a string and return its length.
 * @param {*} value - Any value.
 * @returns {number} Length of its string form.
 * @public
 * @example
 * api.callee.ops.echo("abc"); // 3
 */
export function echo(value) {
	return String(value).length;
}
