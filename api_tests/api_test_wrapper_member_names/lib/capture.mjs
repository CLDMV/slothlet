/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_wrapper_member_names/lib/capture.mjs
 *	@Date: 2026-11-25T14:25:24-08:00 (1795645524)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:10-08:00 (1795869010)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Records every call into the fixture's members, and whether any of them was handed something that
 * reaches the slothlet instance (as `this` or as an argument).
 * @module api_test_wrapper_member_names.lib.capture
 */

/**
 * The names the wrapper's class chain carries without the framework's prefix.
 * @type {string[]}
 */
export const NAMES = [
	"slothlet",
	"SlothletError",
	"SlothletWarning",
	"clock",
	"instanceID",
	"createProxy",
	"emitImplDiagnostic",
	"emitImplCollision",
	"_applyNewImpl"
];

const seen = [];

/**
 * Whether a value reaches the slothlet instance or a wrapper's internal state.
 * @param {*} value - The value.
 * @returns {boolean} True when it does.
 */
function reachesInstance(value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
	try {
		return value.____slothlet !== undefined || value.____slothletInternal !== undefined || value.handlers?.permissionManager !== undefined;
	} catch {
		return false;
	}
}

/**
 * One member per name, each recording its calls.
 * @param {string} owner - Where the members live, recorded with each call.
 * @returns {object} The members, by name.
 */
export function members(owner) {
	const made = {};
	for (const name of NAMES) {
		made[name] = function (...args) {
			seen.push({ at: `${owner}.${name}`, leaked: reachesInstance(this) || args.some(reachesInstance) });
			return `${owner}:${name}`;
		};
	}
	return made;
}

/**
 * The calls recorded so far.
 * @returns {object[]} Each call: where, and whether it was handed the instance.
 */
export function calls() {
	return seen.map((entry) => ({ ...entry }));
}

/**
 * Forget the calls recorded so far.
 * @returns {void}
 */
export function reset() {
	seen.length = 0;
}
