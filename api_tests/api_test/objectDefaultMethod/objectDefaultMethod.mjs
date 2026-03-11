/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/objectDefaultMethod/objectDefaultMethod.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:11 -08:00 (1772425271)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Object with callable default method for testing mixed object/function behavior. Internal file (not exported in package.json).
 * @module api_test.objectDefaultMethod
 * @memberof module:api_test
 */
/**
 * @namespace objectDefaultMethod
 * @memberof module:api_test
 */

export const objectDefaultMethod =
	/** @lends objectDefaultMethod */
	{
		/**
	* Default method for objectDefaultMethod. Calls the named method based on level.
	* @function default
	* @public
	* @param {string} message - Message to log.
	* @param {string} [level="info"] - Level to use ('info', 'warn', 'error').
	* @returns {string} Formatted message with appropriate level prefix
	* @example // ESM usage via slothlet API
	* import slothlet from "@cldmv/slothlet";
	* const api_test = await slothlet({ dir: './api_tests/api_test' });
	* console.log(api_test.objectDefaultMethod("hello")); // 'INFO: Hello'
	* console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
	*
	* @example // ESM usage via slothlet API (inside async function)
	* async function example() {
	*   const { default: slothlet } = await import("@cldmv/slothlet");
	*   const api_test = await slothlet({ dir: './api_tests/api_test' });
	*   console.log(api_test.objectDefaultMethod("hello")); // 'INFO: Hello'
	*   console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
	* }
	*
	* @example // CJS usage via slothlet API (top-level)
	* let slothlet;
	* (async () => {
	*   ({ slothlet } = await import("@cldmv/slothlet"));
	*   const api_test = await slothlet({ dir: './api_tests/api_test' });
	*   console.log(api_test.objectDefaultMethod("hello")); // 'INFO: Hello'
	*   console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
	* })();
	*
	* @example // CJS usage via slothlet API (inside async function)
	* const slothlet = require("@cldmv/slothlet");
	* const api_test = await slothlet({ dir: './api_tests/api_test' });
	* console.log(api_test.objectDefaultMethod("hello")); // 'INFO: Hello'
	* console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
	*/
		default(message, level = "info") {
			if (typeof this[level] === "function") {
				return this[level](message);
			} else {
				return this.info(message);
			}
		},
		/**
	* Info method for objectDefaultMethod.
	* @function info
	* @public
	* @param {string} message - Message to log.
	* @returns {string} Formatted message with INFO prefix
	* @example // ESM usage via slothlet API
	* import slothlet from "@cldmv/slothlet";
	* const api_test = await slothlet({ dir: './api_tests/api_test' });
	* console.log(api_test.objectDefaultMethod.info("hello")); // 'INFO: Hello'
	*
	* @example // ESM usage via slothlet API (inside async function)
	* async function example() {
	*   const { default: slothlet } = await import("@cldmv/slothlet");
	*   const api_test = await slothlet({ dir: './api_tests/api_test' });
	*   console.log(api_test.objectDefaultMethod.info("hello")); // 'INFO: Hello'
	* }
	*
	* @example // CJS usage via slothlet API (top-level)
	* let slothlet;
	* (async () => {
	*   ({ slothlet } = await import("@cldmv/slothlet"));
	*   const api_test = await slothlet({ dir: './api_tests/api_test' });
	*   console.log(api_test.objectDefaultMethod.info("hello")); // 'INFO: Hello'
	* })();
	*
	* @example // CJS usage via slothlet API (inside async function)
	* const slothlet = require("@cldmv/slothlet");
	* const api_test = await slothlet({ dir: './api_tests/api_test' });
	* console.log(api_test.objectDefaultMethod.info("hello")); // 'INFO: Hello'
	*/
		info(message) {
			return `INFO: ${message}`;
		},
		/**
	* Warn method for objectDefaultMethod.
	* @function warn
	* @public
	* @param {string} message - Message to log.
	* @returns {string} Formatted message with WARN prefix
	* @example // ESM usage via slothlet API
	* import slothlet from "@cldmv/slothlet";
	* const api_test = await slothlet({ dir: './api_tests/api_test' });
	* console.log(api_test.objectDefaultMethod.warn("hello")); // 'WARN: Hello'
	*
	* @example // ESM usage via slothlet API (inside async function)
	* async function example() {
	*   const { default: slothlet } = await import("@cldmv/slothlet");
	*   const api_test = await slothlet({ dir: './api_tests/api_test' });
	*   console.log(api_test.objectDefaultMethod.warn("hello")); // 'WARN: Hello'
	* }
	*
	* @example // CJS usage via slothlet API (top-level)
	* let slothlet;
	* (async () => {
	*   ({ slothlet } = await import("@cldmv/slothlet"));
	*   const api_test = await slothlet({ dir: './api_tests/api_test' });
	*   console.log(api_test.objectDefaultMethod.warn("hello")); // 'WARN: Hello'
	* })();
	*
	* @example // CJS usage via slothlet API (inside async function)
	* const slothlet = require("@cldmv/slothlet");
	* const api_test = await slothlet({ dir: './api_tests/api_test' });
	* console.log(api_test.objectDefaultMethod.warn("hello")); // 'WARN: Hello'
	*/
		warn(message) {
			return `WARN: ${message}`;
		},
		/**
	* Error method for objectDefaultMethod.
	* @function error
	* @public
	* @param {string} message - Message to log.
	* @returns {string} Formatted message with ERROR prefix
	* @example // ESM usage via slothlet API
	* import slothlet from "@cldmv/slothlet";
	* const api_test = await slothlet({ dir: './api_tests/api_test' });
	* console.log(api_test.objectDefaultMethod.error("hello")); // 'ERROR: Hello'
	*
	* @example // ESM usage via slothlet API (inside async function)
	* async function example() {
	*   const { default: slothlet } = await import("@cldmv/slothlet");
	*   const api_test = await slothlet({ dir: './api_tests/api_test' });
	*   console.log(api_test.objectDefaultMethod.error("hello")); // 'ERROR: Hello'
	* }
	*
	* @example // CJS usage via slothlet API (top-level)
	* let slothlet;
	* (async () => {
	*   ({ slothlet } = await import("@cldmv/slothlet"));
	*   const api_test = await slothlet({ dir: './api_tests/api_test' });
	*   console.log(api_test.objectDefaultMethod.error("hello")); // 'ERROR: Hello'
	* })();
	*
	* @example // CJS usage via slothlet API (inside async function)
	* const slothlet = require("@cldmv/slothlet");
	* const api_test = await slothlet({ dir: './api_tests/api_test' });
	* console.log(api_test.objectDefaultMethod.error("hello")); // 'ERROR: Hello'
	*/
		error(message) {
			return `ERROR: ${message}`;
		}
	};

