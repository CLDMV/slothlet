/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round3/callee/shapes.mjs
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
 * @fileoverview Reads a slothlet function and reports what the plain-JavaScript operations on it do (#597): a function
 * a module reads out of `self.slothlet` behaves as the one the host reads.
 *
 * @module api_tests/api_test_caller_supplied_round3/callee/shapes
 */

import { self } from "@cldmv/slothlet/runtime";
import { shapeOf } from "./__lib/shape.mjs";

/**
 * Report the plain-JavaScript operations on a slothlet function, read by this module. The function is frozen.
 * @param {string} dotted - Its path under `self.slothlet`.
 * @returns {object} The outcomes (see `shapeOf`).
 * @public
 * @example
 * api.callee.shapes.of("scope");
 */
export function of(dotted) {
	return shapeOf(dotted.split(".").reduce((node, key) => node[key], self.slothlet));
}
