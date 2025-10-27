/**
 * @fileoverview Helper functions for testing single file context flattening (Rule 11). Internal file (not exported in package.json).
 * @module api_test.utilities.helpers
 * @memberof module:api_test
 */
/**
 * Parses a JSON string with error handling.
 * Accessed as `api.utilities.parse()` in the slothlet API.
 * Rule 11 test: Should flatten to `api.utilities.parse()` since this is the only file in utilities folder
 * and has no default export, only named exports.
 * @function parse
 * @public
 * @param {string} jsonString - JSON string to parse
 * @returns {object|null} Parsed object or null if invalid
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: "./api_tests/api_test" });
 * console.log(api_test.utilities.parse('{"test":true}')); // {test: true}
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: "./api_tests/api_test" });
 *   console.log(api_test.utilities.parse('{"test":true}')); // {test: true}
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: "./api_tests/api_test" });
 *   console.log(api_test.utilities.parse('{"test":true}')); // {test: true}
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: "./api_tests/api_test" });
 * console.log(api_test.utilities.parse('{"test":true}')); // {test: true}
 */
export function parse(jsonString: string): object | null;
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
export function stringify(obj: object): string;
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
export function validate(obj: object, requiredProps: string[]): boolean;
//# sourceMappingURL=helpers.d.mts.map