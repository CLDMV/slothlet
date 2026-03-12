/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/math.mjs
 *	@Date: 2026-01-23T08:17:46-08:00 (1769185066)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:13 -08:00 (1772425273)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Root math file for api_test_collisions collision testing (collides with math/ folder).
 * @module api_test_collisions.mathFile
 * @memberof module:api_test_collisions
 */
/**
 * @namespace mathFile
 * @memberof module:api_test_collisions
 * @alias module:api_test_collisions.mathFile
 */

/**
 * power.
 * @param {*} base - base.
 * @param {*} exponent - exponent.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.math.power(null, null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.math.power(null, null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.math.power(null, null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.math.power(null, null);
 */
export function power(base, exponent) {
	return Math.pow(base, exponent);
}

/**
 * Calculate square root of a number.
 * @param {number} n - The number.
 * @returns {number} The square root.
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.math.sqrt(1);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.math.sqrt(1);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.math.sqrt(1);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.math.sqrt(1);
 */
export function sqrt(n) {
	return Math.sqrt(n);
}

/**
 * Calculate modulo of two numbers.
 * @param {number} a - First number.
 * @param {number} b - Second number.
 * @returns {number} The remainder.
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.math.modulo(1, 1);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.math.modulo(1, 1);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.math.modulo(1, 1);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.math.modulo(1, 1);
 */
export function modulo(a, b) {
	return a % b;
}

/**
 * Version identifier for collision detection.
 * @type {string}
 */
export const collisionVersion = "math-collision-v1";

