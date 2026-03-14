/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reserved_name/slothlet.mjs
 *	@Date: 2026-03-01 19:00:00 -08:00 (1772416800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:15 -08:00 (1772425275)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Fixture for testing the reserved name "slothlet" warning.
 * When this file is loaded, slothlet will emit WARNING_RESERVED_PROPERTY_CONFLICT.
 * @module api_test_reserved_name.slothlet
 * @memberof module:api_test_reserved_name
 */
/**
 * @namespace slothlet
 * @memberof module:api_test_reserved_name
 * @alias module:api_test_reserved_name.slothlet
 */

/**
 * A stub function — the filename "slothlet" conflicts with the reserved namespace.
 * @returns {string} A simple string.
 * @example
 * slothlet.slothlet.greet(); // "hello"
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_reserved_name = await slothlet({ dir: './api_tests/api_test_reserved_name' });
 * api_test_reserved_name.slothlet.greet();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_reserved_name = await slothlet({ dir: './api_tests/api_test_reserved_name' });
 *   api_test_reserved_name.slothlet.greet();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_reserved_name = await slothlet({ dir: './api_tests/api_test_reserved_name' });
 *   api_test_reserved_name.slothlet.greet();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_reserved_name = await slothlet({ dir: './api_tests/api_test_reserved_name' });
 * api_test_reserved_name.slothlet.greet();
 */
export function greet() {
	return "hello";
}
