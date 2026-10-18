/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round3/callee/__lib/shape.mjs
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
 * @fileoverview What the plain-JavaScript operations on a function report, for comparing a slothlet function a module
 * reads with the one the host reads (#597).
 *
 * @module api_tests/api_test_caller_supplied_round3/callee/__lib/shape
 */

/**
 * Run an operation, reporting what it returned or the kind of error it threw.
 * @param {function(): *} operation - The operation.
 * @returns {{value: *}|{threw: string}} The outcome.
 * @private
 */
function outcome(operation) {
	try {
		const value = operation();
		return { value: typeof value === "function" ? "function" : value };
	} catch (error) {
		return { threw: error?.constructor?.name ?? typeof error };
	}
}

/**
 * Report the plain-JavaScript operations on a function, then freeze it and report them again.
 * @param {Function} fn - The function. It is frozen.
 * @returns {object} The outcomes, by operation.
 * @public
 * @example
 * shapeOf(function f() {}); // { hasPrototype: { value: true }, … }
 */
export function shapeOf(fn) {
	const report = () => ({
		typeOf: outcome(() => typeof fn),
		hasPrototype: outcome(() => "prototype" in fn),
		ownPrototype: outcome(() => Object.hasOwn(fn, "prototype")),
		name: outcome(() => fn.name),
		length: outcome(() => typeof fn.length),
		keys: outcome(() => Reflect.ownKeys(fn).map(String).sort().join(",")),
		extensible: outcome(() => Object.isExtensible(fn)),
		frozen: outcome(() => Object.isFrozen(fn))
	});
	const before = report();
	const deletePrototype = outcome(() => Reflect.deleteProperty(fn, "prototype"));
	const afterDelete = outcome(() => Object.hasOwn(fn, "prototype"));
	const freeze = outcome(() => Object.isFrozen(Object.freeze(fn)));
	return { before, deletePrototype, afterDelete, freeze, after: report() };
}
