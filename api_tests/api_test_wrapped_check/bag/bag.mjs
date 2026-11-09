/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_wrapped_check/bag/bag.mjs
 *	@Date: 2026-11-08T16:13:51-08:00 (1794183231)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:15:32-08:00 (1794183332)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module handing out the kinds of values slothlet may put behind its own Proxies, and
 * reading `self.slothlet.wrapped` from module code.
 */

import { self } from "@cldmv/slothlet/runtime";

/** A class whose instances the module hands out. */
export class Thing {
	/** @returns {number} A value. */
	value() {
		return 1;
	}
}

/** Plain data the module exports. */
export const data = { n: 1, list: [1, 2] };

/**
 * Make a class instance.
 * @returns {Thing} A new instance.
 */
export function makeThing() {
	return new Thing();
}

/**
 * Make a closure.
 * @returns {Function} A closure.
 */
export function makeFn() {
	return () => 1;
}

/**
 * Ask from module code whether a value is one of slothlet's own Proxies.
 * @param {*} value - The value.
 * @returns {boolean} The answer.
 */
export function check(value) {
	return self.slothlet.wrapped(value);
}

/**
 * Ask about the module's own export read back through `self` (a per-reader view).
 * @returns {{ isProxy: boolean, wrapped: boolean }} What module code sees.
 */
export async function checkOwnView() {
	const { types } = await import("node:util");
	const view = self.bag.data;
	return { isProxy: types.isProxy(view), wrapped: self.slothlet.wrapped(view) };
}
