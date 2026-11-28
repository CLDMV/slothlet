/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_require_esm/api/math.mjs
 *	@Date: 2026-11-27T21:56:34-08:00 (1795845394)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-27T22:05:36-08:00 (1795845936)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A leaf that imports `@cldmv/slothlet/runtime` statically, as most leaves do (#1034).
 * @module api_test_require_esm.math
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The sum of two numbers.
 * @param {number} a - A number.
 * @param {number} b - Another.
 * @returns {number} Their sum.
 */
export function add(a, b) {
	return a + b;
}

/**
 * Whether `self` reaches this leaf.
 * @returns {boolean} True when it does.
 */
export function selfReachesMe() {
	return typeof self.math.add === "function";
}
