/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/conflicting-name-1.mjs
 *	@Date: 2026-02-16T17:50:31-08:00 (1771293031)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-12 21:33:01 -07:00 (1773376381)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview First file in conflicting-name collision test — loaded first alphabetically.
 * @module api_test.conflictingName1
 * @memberof module:api_test
 */
/**
 * @namespace conflictingName1
 * @memberof module:api_test
 */

/**
	* Named export that will be overwritten
	* @returns {string} Version identifier
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.conflicting-name-1.conflictingName();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.conflicting-name-1.conflictingName();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.conflicting-name-1.conflictingName();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.conflicting-name-1.conflictingName();
 */
/**
 * conflictingName.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.conflicting-name-1.conflictingName();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.conflicting-name-1.conflictingName();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.conflicting-name-1.conflictingName();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.conflicting-name-1.conflictingName();
 */
export function conflictingName() {
	return "from-file-1";
}

