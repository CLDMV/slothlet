/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/deep/folder/config.mjs
 *	@Date: 2026-01-30T17:01:40-08:00 (1769821300)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:09 -08:00 (1772425269)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Deeply nested config module for apiDepth traversal depth testing.
 * @module api_test.deep.folder.config
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
const config2 = {
	host: "https://slothlet",
	username: "admin",
	password: "password",
	site: "default",
	secure: true,
	verbose: true
};

export function get(key) {
	console.log("config.get - config:", config);
	console.log("config.get - typeof config:", typeof config);
	console.log("config.get - Object.keys(config):", Object.keys(config));
	console.log("config.get - config[key]:", config[key]);
	console.log("config.get - config.host:", config.host);
	return config2[key];
}

