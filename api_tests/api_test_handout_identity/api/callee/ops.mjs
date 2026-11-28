/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_handout_identity/api/callee/ops.mjs
 *	@Date: 2026-11-27T20:30:27-08:00 (1795840227)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:09-08:00 (1795868889)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Leaves that hand back what they are handed (#1026): `echo` the value itself, `pick` a function nested
 * in it.
 * @module api_test_handout_identity.callee.ops
 */

/**
 * The value it is handed.
 * @param {*} value - Any value.
 * @returns {*} The same value.
 */
export function echo(value) {
	return value;
}

/**
 * The function at `holder.inner.cb`.
 * @param {{inner: {cb: Function}}} holder - Data holding a function.
 * @returns {Function} That function.
 */
export function pick(holder) {
	return holder.inner.cb;
}
