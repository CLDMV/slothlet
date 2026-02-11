/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/utilities/helpers.mjs
 *	@Date: 2025-10-27T09:42:13-07:00 (1761583333)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-10 18:02:02 -08:00 (1770775322)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

export function parse(jsonString) {
	try {
		return JSON.parse(jsonString);
	} catch (_) {
		return null;
	}
}

/**
	* Stringifies an object with pretty formatting.
	* Accessed as `api.utilities.stringify()` in the slothlet API.
	* @function stringify
	* @public
	* @param {object} obj - Object to stringify
	* @returns {string} JSON string
	* @example // ESM usage via slothlet API
	* import slothlet from "@cldmv/slothlet";
	* const api_test = await slothlet({ dir: "./api_tests/api_test" });
	* console.log(api_test.utilities.stringify({test: true})); // '{"test":true}'
	*
	* @example // ESM usage via slothlet API (inside async function)
	* async function example() {
	*   const { default: slothlet } = await import("@cldmv/slothlet");
	*   const api_test = await slothlet({ dir: "./api_tests/api_test" });
	*   console.log(api_test.utilities.stringify({test: true})); // '{"test":true}'
	* }
	*
	* @example // CJS usage via slothlet API (top-level)
	* let slothlet;
	* (async () => {
	*   ({ slothlet } = await import("@cldmv/slothlet"));
	*   const api_test = await slothlet({ dir: "./api_tests/api_test" });
	*   console.log(api_test.utilities.stringify({test: true})); // '{"test":true}'
	* })();
	*
	* @example // CJS usage via slothlet API (inside async function)
	* const slothlet = require("@cldmv/slothlet");
	* const api_test = await slothlet({ dir: "./api_tests/api_test" });
	* console.log(api_test.utilities.stringify({test: true})); // '{"test":true}'
	*/
export function stringify(obj) {
	return JSON.stringify(obj);
}

/**
	* Validates if an object has all required properties.
	* Accessed as `api.utilities.validate()` in the slothlet API.
	* @function validate
	* @public
	* @param {object} obj - Object to validate
	* @param {string[]} requiredProps - Required property names
	* @returns {boolean} True if valid, false otherwise
	* @example // ESM usage via slothlet API
	* import slothlet from "@cldmv/slothlet";
	* const api_test = await slothlet({ dir: "./api_tests/api_test" });
	* console.log(api_test.utilities.validate({name: "test"}, ["name"])); // true
	*
	* @example // ESM usage via slothlet API (inside async function)
	* async function example() {
	*   const { default: slothlet } = await import("@cldmv/slothlet");
	*   const api_test = await slothlet({ dir: "./api_tests/api_test" });
	*   console.log(api_test.utilities.validate({name: "test"}, ["name"])); // true
	* }
	*
	* @example // CJS usage via slothlet API (top-level)
	* let slothlet;
	* (async () => {
	*   ({ slothlet } = await import("@cldmv/slothlet"));
	*   const api_test = await slothlet({ dir: "./api_tests/api_test" });
	*   console.log(api_test.utilities.validate({name: "test"}, ["name"])); // true
	* })();
	*
	* @example // CJS usage via slothlet API (inside async function)
	* const slothlet = require("@cldmv/slothlet");
	* const api_test = await slothlet({ dir: "./api_tests/api_test" });
	* console.log(api_test.utilities.validate({name: "test"}, ["name"])); // true
	*/
export function validate(obj, requiredProps) {
	return requiredProps.every(prop => Object.prototype.hasOwnProperty.call(obj, prop));
}

