/**
 * @fileoverview String API module for testing slothlet loader with auto-flattening behavior. Internal file (not exported in package.json).
 * @module api_test.string
 * @memberof module:api_test
 */

/**
 * String manipulation API object for testing auto-flattening.
 * This module tests slothlet's ability to flatten single-file folder structures.
 * Accessed as `api.string` in the slothlet API.
 * @alias module:api_test.string
 * @public
 * @property {Function} upper - Converts string to uppercase
 * @property {Function} reverse - Reverses a string
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.string.upper('hello')); // 'HELLO'
 * console.log(api_test.string.reverse('hello')); // 'olleh'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import('@cldmv/slothlet');
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.string.upper('hello')); // 'HELLO'
 *   console.log(api_test.string.reverse('hello')); // 'olleh'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import('@cldmv/slothlet'));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.string.upper('hello')); // 'HELLO'
 *   console.log(api_test.string.reverse('hello')); // 'olleh'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require('@cldmv/slothlet');
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.string.upper('hello')); // 'HELLO'
 * console.log(api_test.string.reverse('hello')); // 'olleh'
 */
export const string =
	/** @lends string */
	{
		/**
		 * Converts a string to uppercase.
		 * @function upper
		 * @public
		 * @param {string} str - String to convert to uppercase
		 * @returns {string} The uppercased string
		 * @example // ESM usage via slothlet API
		 * import slothlet from '@cldmv/slothlet';
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.string.upper('world')); // 'WORLD'
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import('@cldmv/slothlet');
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.string.upper('world')); // 'WORLD'
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import('@cldmv/slothlet'));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.string.upper('world')); // 'WORLD'
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require('@cldmv/slothlet');
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.string.upper('world')); // 'WORLD'
		 */
		upper(str) {
			return str.toUpperCase();
		},
		/**
		 * Reverses a string character by character.
		 * @function reverse
		 * @public
		 * @param {string} str - String to reverse
		 * @returns {string} The reversed string
		 * @example // ESM usage via slothlet API
		 * import slothlet from '@cldmv/slothlet';
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.string.reverse('world')); // 'dlrow'
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import('@cldmv/slothlet');
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.string.reverse('world')); // 'dlrow'
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import('@cldmv/slothlet'));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.string.reverse('world')); // 'dlrow'
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require('@cldmv/slothlet');
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.string.reverse('world')); // 'dlrow'
		 */
		reverse(str) {
			return str.split("").reverse().join("");
		}
	};
