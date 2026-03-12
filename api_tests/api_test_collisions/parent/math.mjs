/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/parent/math.mjs
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
 * @fileoverview Root math file for api_test_collisions parent collision testing.
 * @module api_test_collisions.parent.mathFile
 * @memberof module:api_test_collisions
 */
/**
 * @namespace parent
 * @memberof module:api_test_collisions
 * @alias module:api_test_collisions.parent
 */
/**
 * @namespace mathFile
 * @memberof module:api_test_collisions.parent
 * @alias module:api_test_collisions.parent.mathFile
 */
/**
 * power.
 * @param {*} base - base.
 * @param {*} exponent - exponent.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.parent.math.power(null, null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.parent.math.power(null, null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.parent.math.power(null, null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.parent.math.power(null, null);
 */
export function power(base, exponent) {
	return Math.pow(base, exponent);
}

/**
 * sqrt.
 * @param {*} num - num.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.parent.math.sqrt(null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.parent.math.sqrt(null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.parent.math.sqrt(null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.parent.math.sqrt(null);
 */
export function sqrt(num) {
	return Math.sqrt(num);
}

/**
 * modulo.
 * @param {*} a - a.
 * @param {*} b - b.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.parent.math.modulo(null, null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.parent.math.modulo(null, null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 *   api_test_collisions.parent.math.modulo(null, null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_collisions = await slothlet({ dir: './api_tests/api_test_collisions' });
 * api_test_collisions.parent.math.modulo(null, null);
 */
export function modulo(a, b) {
	return a % b;
}

