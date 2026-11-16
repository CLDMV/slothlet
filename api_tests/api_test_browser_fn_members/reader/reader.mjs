/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_browser_fn_members/reader/reader.mjs
 *	@Date: 2026-11-15T12:30:32-08:00 (1794774632)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T13:05:16-08:00 (1794776716)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module reading `math.calc`'s members through `self`.
 * @module api_test_browser_fn_members/reader/reader
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * @returns {*} `self.math.calc.name`.
 */
export function readName() {
	return self.math.calc.name;
}

/**
 * @returns {*} `self.math.calc.length`.
 */
export function readLength() {
	return self.math.calc.length;
}

/**
 * @returns {*} What `self.math.calc.calc()` returns.
 */
export function readCalc() {
	return self.math.calc.calc();
}

/**
 * @returns {string[]} `Object.keys(self.math.calc)`.
 */
export function listKeys() {
	return Object.keys(self.math.calc);
}
