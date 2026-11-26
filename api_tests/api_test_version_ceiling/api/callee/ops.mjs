/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_version_ceiling/api/callee/ops.mjs
 *	@Date: 2026-11-25T01:29:35-08:00 (1795598975)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:46:10-08:00 (1795599970)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A callee that runs code its caller supplies (it stringifies the value it is handed).
 * @module api_test_version_ceiling/callee/ops
 */

/**
 * Stringify a value: a supplier's `toString` runs inside this call.
 * @param {unknown} value - The value.
 * @returns {number} The string's length.
 * @example
 * echo("ab"); // 2
 */
export function echo(value) {
	return String(value).length;
}
