/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_modes_debug/string/string.mjs
 *	@Date: 2026-02-27T22:37:47-08:00 (1772260667)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:15 -08:00 (1772425275)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview String utilities module for modes-processor debug coverage testing.
 * @module api_test_modes_debug.string
 * @memberof module:api_test_modes_debug
 */
/**
 * @namespace string
 * @memberof module:api_test_modes_debug
 * @alias module:api_test_modes_debug.string
 */

/**
 * String utilities for modes-processor debug coverage testing.
 * Uses folder/folder.mjs pattern with single named object export (Case 1).
 * This exports a single const named "string" matching the folder name "string"
 * to trigger the Case 1 single-file-folder-detected path, including the
 * debug.modes guard for `categoryName === "string"`.
 */
export const string = {
	/**
	 * @param {string} s
	 * @returns {string}
	 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_modes_debug = await slothlet({ dir: './api_tests/api_test_modes_debug' });
 * api_test_modes_debug.string.format('value');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_modes_debug = await slothlet({ dir: './api_tests/api_test_modes_debug' });
 *   api_test_modes_debug.string.format('value');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_modes_debug = await slothlet({ dir: './api_tests/api_test_modes_debug' });
 *   api_test_modes_debug.string.format('value');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_modes_debug = await slothlet({ dir: './api_tests/api_test_modes_debug' });
 * api_test_modes_debug.string.format('value');
 */
	format(s) {
		return s.toUpperCase();
	},

	/**
	 * @param {string} s
	 * @returns {string}
	 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_modes_debug = await slothlet({ dir: './api_tests/api_test_modes_debug' });
 * api_test_modes_debug.string.trim('value');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_modes_debug = await slothlet({ dir: './api_tests/api_test_modes_debug' });
 *   api_test_modes_debug.string.trim('value');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_modes_debug = await slothlet({ dir: './api_tests/api_test_modes_debug' });
 *   api_test_modes_debug.string.trim('value');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_modes_debug = await slothlet({ dir: './api_tests/api_test_modes_debug' });
 * api_test_modes_debug.string.trim('value');
 */
	trim(s) {
		return s.trim();
	}
};
