/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_closed_self_set/lib/writes.mjs
 *	@Date: 2026-11-25T03:05:22-08:00 (1795604722)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T03:19:19-08:00 (1795605559)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Every way a write reaches an object, made on one target: `Reflect.set`, an assignment in strict code,
 * and an assignment in sloppy code, each to a member the target already holds and to a new one. The module runs it on
 * its `self`, the test on the host's `api` and on a plain object closed the same way.
 */

// Code the Function constructor builds is sloppy whatever module builds it: its assignment fails silently.
const sloppyAssign = new Function("target", "key", "value", "target[key] = value; return true;");

/**
 * What one write gave: its answer, or the kind of error it threw.
 * @param {function(): *} write - The write.
 * @returns {{value: *}|{threw: string}} The outcome.
 */
function outcome(write) {
	try {
		return { value: write() };
	} catch (error) {
		return { threw: error?.constructor?.name ?? typeof error };
	}
}

/**
 * Each write on `target`, with what the member held after it.
 * @param {object|Function} target - The object written to.
 * @param {string} existing - The name of a member it holds (a number).
 * @returns {Record<string, *>} What each write gave.
 */
export function writes(target, existing) {
	"use strict";
	return {
		reflectExisting: outcome(() => Reflect.set(target, existing, 2)),
		afterReflectExisting: target[existing],
		strictExisting: outcome(() => {
			target[existing] = 3;
			return true;
		}),
		afterStrictExisting: target[existing],
		sloppyExisting: outcome(() => sloppyAssign(target, existing, 4)),
		afterSloppyExisting: target[existing],
		reflectFresh: outcome(() => Reflect.set(target, "freshReflect", 1)),
		hasReflectFresh: Reflect.has(target, "freshReflect"),
		strictFresh: outcome(() => {
			target.freshStrict = 1;
			return true;
		}),
		hasStrictFresh: Reflect.has(target, "freshStrict"),
		sloppyFresh: outcome(() => sloppyAssign(target, "freshSloppy", 1)),
		hasSloppyFresh: Reflect.has(target, "freshSloppy")
	};
}
