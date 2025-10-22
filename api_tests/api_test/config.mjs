/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/config.mjs
 *	@Date: 2025-09-09 13:22:38 -07:00 (1757449358)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-22 08:12:13 -07:00 (1761145933)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Configuration object for slothlet API testing. Internal file (not exported in package.json).
 * @module api_test.config
 * @memberof module:api_test
 */

// Runtime imports (unused but required for API structure)
// import { self, context, reference } from "@cldmv/slothlet/runtime";

/**
 * Default configuration object for testing API modules.
 * Contains sample connection parameters and settings used across test modules.
 * Accessed as `api.config` in the slothlet API.
 * @alias module:api_test.config
 * @property {string} host - The host URL for API testing
 * @property {string} username - Authentication username
 * @property {string} password - Authentication password
 * @property {string} site - Site identifier for multi-tenant systems
 * @property {boolean} secure - Whether to use secure connections
 * @property {boolean} verbose - Enable verbose logging
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.config.host); // "https://slothlet"
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.config.host); // "https://slothlet"
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.config.host); // "https://slothlet"
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.config.host); // "https://slothlet"
 */
export const config = {
	host: "https://slothlet",
	username: "admin",
	password: "password",
	site: "default",
	secure: true,
	verbose: true
};
