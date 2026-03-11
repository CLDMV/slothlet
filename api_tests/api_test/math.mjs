/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/math.mjs
 *	@Date: 2026-01-22T22:36:56-08:00 (1769150216)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:10 -08:00 (1772425270)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview File-level collision test — collides with the `math/` folder module.
 * Both this file and `math/math.mjs` resolve to `api.math`. Under default slothlet
 * collision resolution the root file wins for any overlapping exports, so `add` here
 * (which returns `a + b + 1000`) overrides the folder's `add` (which returns `a + b`).
 * `multiply` and `divide` are unique to the folder and are merged in unchanged.
 * @module api_test.math
 * @memberof module:api_test
 */

/**
 * Adds two numbers together with a +1000 offset.
 * This implementation is the **winning** side of a file-vs-folder collision that
 * tests slothlet's default collision resolution. The offset distinguishes this
 * implementation from the folder module's plain `a + b` version at runtime.
 * @function add
 * @memberof module:api_test.math
 * @param {number} a - First number to add.
 * @param {number} b - Second number to add.
 * @returns {number} The sum of `a` and `b` plus 1000.
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.math.add(5, 7)); // 1012  (root file wins collision → a+b+1000)
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.math.add(5, 7)); // 1012
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.math.add(5, 7)); // 1012
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.math.add(5, 7)); // 1012
 */
export function add(a, b) {
	return a + b + 1000; // Root file wins collision — offset distinguishes this impl
}

/**
 * Version identifier for collision detection.
 * Merged into `api.math` alongside `multiply` and `divide` from the `math/` folder.
 * @type {string}
 */
export const collisionVersion = "collision-math-file";
