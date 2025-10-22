export namespace math {
	/**
	 * Adds two numbers together.
	 * @function add
	 * @public
	 * @param {number} a - First number to add
	 * @param {number} b - Second number to add
	 * @returns {number} The sum of a and b
	 * @example // ESM usage via slothlet API
	 * import slothlet from '@cldmv/slothlet';
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.math.add(5, 7)); // 12
	 *
	 * @example // ESM usage via slothlet API (inside async function)
	 * async function example() {
	 *   const { default: slothlet } = await import("@cldmv/slothlet");
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.math.add(5, 7)); // 12
	 * }
	 *
	 * @example // CJS usage via slothlet API (top-level)
	 * let slothlet;
	 * (async () => {
	 *   ({ slothlet } = await import("@cldmv/slothlet"));
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.math.add(5, 7)); // 12
	 * })();
	 *
	 * @example // CJS usage via slothlet API (inside async function)
	 * const slothlet = require("@cldmv/slothlet");
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.math.add(5, 7)); // 12
	 */
	function add(a: number, b: number): number;
	/**
	 * Multiplies two numbers together.
	 * @function multiply
	 * @public
	 * @param {number} a - First number to multiply
	 * @param {number} b - Second number to multiply
	 * @returns {number} The product of a and b
	 * @example // ESM usage via slothlet API
	 * import slothlet from '@cldmv/slothlet';
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.math.multiply(4, 6)); // 24
	 *
	 * @example // ESM usage via slothlet API (inside async function)
	 * async function example() {
	 *   const { default: slothlet } = await import("@cldmv/slothlet");
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.math.multiply(4, 6)); // 24
	 * }
	 *
	 * @example // CJS usage via slothlet API (top-level)
	 * let slothlet;
	 * (async () => {
	 *   ({ slothlet } = await import("@cldmv/slothlet"));
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.math.multiply(4, 6)); // 24
	 * })();
	 *
	 * @example // CJS usage via slothlet API (inside async function)
	 * const slothlet = require("@cldmv/slothlet");
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.math.multiply(4, 6)); // 24
	 */
	function multiply(a: number, b: number): number;
}
//# sourceMappingURL=math.d.mts.map
