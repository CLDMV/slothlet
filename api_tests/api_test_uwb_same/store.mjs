/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_uwb_same/store.mjs
 *	@Date: 2026-11-25T01:28:37-08:00 (1795598917)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:03-08:00 (1795869003)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module holding data, a class instance and a promise of its own.
 */

/** Plain data. */
export const data = { a: 1 };

/** A class with a method. */
export class Box {
	/** @returns {string} A label. */
	label() {
		return "box";
	}
}

/**
 * A fresh instance of the class.
 * @returns {Box} The instance.
 */
export function make() {
	return new Box();
}

/**
 * A promise of the module's data, made without `async`.
 * @returns {Promise<object>} The promise.
 */
export function later() {
	return Promise.resolve(data);
}
