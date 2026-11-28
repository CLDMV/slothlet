/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_uwb_crossing/owner/owner.mjs
 *	@Date: 2026-11-25T01:26:19-08:00 (1795598779)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:01-08:00 (1795869001)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module whose values another module takes and uses.
 */

/** A class whose constructor refuses a missing argument. */
class Strict {
	/**
	 * @param {string} name - Required.
	 */
	constructor(name) {
		if (!name) throw new TypeError("name required");
		this.name = name;
	}
}

/**
 * The class.
 * @returns {Function} `Strict`.
 */
export const strict = () => Strict;

/**
 * An async generator that fails on its first step.
 * @returns {AsyncGenerator} The generator.
 */
export const failing = () =>
	(async function* failingSteps() {
		yield* [];
		throw new RangeError("step failed");
	})();

/**
 * An object holding a getter, a plain member and a function.
 * @returns {object} The object.
 */
export const withAccessor = () => ({
	get computed() {
		return 42;
	},
	plain: 1,
	slot: null
});

/**
 * An object closed to new members but whose members can still be removed.
 * @returns {object} The object.
 */
export const closed = () => Object.preventExtensions({ a: 1, b: 2 });

/**
 * A frozen object.
 * @returns {object} The object.
 */
export const frozen = () => Object.freeze({ a: 1 });

/**
 * A plain function.
 * @returns {Function} The function.
 */
export const fn = () =>
	function ownerFn() {
		return "owner";
	};
