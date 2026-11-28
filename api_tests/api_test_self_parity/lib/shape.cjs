/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_self_parity/lib/shape.cjs
 *	@Date: 2026-11-15T17:12:05-08:00 (1794791525)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:43-08:00 (1795868983)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The CommonJS copy of `shape.mjs`'s report, for a CommonJS leaf (#803): the rows that need no platform
 * operation.
 */

/**
 * Run one operation, reporting a throw as its error code or name.
 * @param {function(): *} op - The operation.
 * @returns {*} Its result, or `threw:<code|name>`.
 */
function attempt(op) {
	try {
		return op();
	} catch (error) {
		return `threw:${error?.code ?? error?.name}`;
	}
}

/**
 * Report the form rows of a value.
 * @param {*} x - The api root as the caller sees it.
 * @returns {Record<string, *>} What each operation gave.
 */
exports.shape = function shape(x) {
	return {
		typeof: typeof x,
		toStringTag: attempt(() => Object.prototype.toString.call(x)),
		instanceofFunction: attempt(() => x instanceof Function),
		directCall: attempt(() => x(2)),
		dotCall: attempt(() => x.call(null, 2)),
		mathAdd: attempt(() => x.math.add(2, 3))
	};
};
