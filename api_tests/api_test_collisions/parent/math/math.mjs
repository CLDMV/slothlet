/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/parent/math/math.mjs
 *	@Date: 2026-01-27T06:21:28-08:00 (1769523688)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:14 -08:00 (1772425274)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Math module for api_test_collisions parent/math testing.
 * @module api_test_collisions.parent.math
 * @memberof module:api_test_collisions
 */
/**
 * @namespace math
 * @memberof module:api_test_collisions.parent
 * @alias module:api_test_collisions.parent.math
 */
/**
 * add.
 * @param {*} a - a.
 * @param {*} b - b.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.parent.math.add(null, null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.parent.math.add(null, null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.parent.math.add(null, null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.parent.math.add(null, null);
 */
export function add(a, b) {
	return a + b;
}

/**
 * multiply.
 * @param {*} a - a.
 * @param {*} b - b.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.parent.math.multiply(null, null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.parent.math.multiply(null, null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.parent.math.multiply(null, null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.parent.math.multiply(null, null);
 */
export function multiply(a, b) {
	return a * b;
}

/**
 * divide.
 * @param {*} a - a.
 * @param {*} b - b.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.parent.math.divide(null, null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.parent.math.divide(null, null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.parent.math.divide(null, null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.parent.math.divide(null, null);
 */
export function divide(a, b) {
	return a / b;
}

