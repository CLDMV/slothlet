/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round4/callee/__lib/describe.mjs
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
 * @fileoverview What plain JavaScript reports about a function, for comparing a slothlet function a module reads with
 * the one the host reads (#597).
 *
 * @module api_tests/api_test_caller_supplied_round4/callee/__lib/describe
 */

/**
 * The prototype of an async function.
 * @type {object}
 * @private
 */
const ASYNC_FUNCTION_PROTOTYPE = Object.getPrototypeOf(async function () {});

/**
 * Describe a function as plain JavaScript reports it.
 * @param {Function} fn - The function.
 * @param {PropertyKey} [key="caller"] - A member whose attributes are reported.
 * @returns {object} The report.
 * @public
 * @example
 * describeFunction(async () => {}).prototype; // "AsyncFunction"
 */
export function describeFunction(fn, key = "caller") {
	const prototype = Object.getPrototypeOf(fn);
	const member = Object.getOwnPropertyDescriptor(fn, key);
	return {
		prototype: prototype === ASYNC_FUNCTION_PROTOTYPE ? "AsyncFunction" : prototype === Function.prototype ? "Function" : "other",
		extensible: Object.isExtensible(fn),
		sealed: Object.isSealed(fn),
		frozen: Object.isFrozen(fn),
		member: member ? { configurable: member.configurable, writable: member.writable, enumerable: member.enumerable } : null
	};
}
