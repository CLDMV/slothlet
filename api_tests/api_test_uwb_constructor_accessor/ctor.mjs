/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_uwb_constructor_accessor/ctor.mjs
 *	@Date: 2026-11-25T01:46:27-08:00 (1795599987)
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
 * @fileoverview Objects whose prototype answers `constructor` through a getter.
 */

/**
 * A function the module exports, so a node fronts it.
 * @returns {string} A label.
 */
export function exported() {
	return "exported";
}

/**
 * An object whose prototype's `constructor` getter answers `value`.
 * @param {*} value - What `constructor` reads.
 * @returns {object} The object.
 */
function answering(value) {
	return Object.create(
		{
			get constructor() {
				return value;
			}
		},
		{ tag: { value: 1, enumerable: true } }
	);
}

/** `constructor` reads a primitive. */
export const prim = answering(5);

/** `constructor` reads a plain object. */
export const obj = answering({ kind: "obj" });

/** `constructor` reads a function no node fronts. */
export const fnv = answering(function helper() {
	return "helper";
});

/** `constructor` reads the module's exported function. */
export const nodeFn = answering(exported);
