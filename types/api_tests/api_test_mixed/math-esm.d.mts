export namespace mathEsm {
	/**
	 * Adds two numbers.
	 * @function add
	 * @public
	 * @param {number} a - First number to add.
	 * @param {number} b - Second number to add.
	 * @returns {number} The sum of a and b.
	 * @example // ESM usage via slothlet API
	 * import slothlet from '@cldmv/slothlet';
	 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
	 * console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
	 *
	 * @example // ESM usage via slothlet API (inside async function)
	 * async function example() {
	 *   const { default: slothlet } = await import("@cldmv/slothlet");
	 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
	 *   console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
	 * }
	 *
	 * @example // CJS usage via slothlet API (top-level)
	 * let slothlet;
	 * (async () => {
	 * 	({ slothlet } = await import("@cldmv/slothlet"));
	 * 	const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
	 * 	console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
	 * })();
	 *
	 * @example // CJS usage via slothlet API (inside async function)
	 * const slothlet = require("@cldmv/slothlet");
	 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
	 * console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
	 */
	function add(a: number, b: number): number;
	/**
	 * Subtracts two numbers.
	 * @function subtract
	 * @public
	 * @param {number} a - Number to subtract from.
	 * @param {number} b - Number to subtract.
	 * @returns {number} The difference of a and b.
	 * @example // ESM usage via slothlet API
	 * import slothlet from '@cldmv/slothlet';
	 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
	 * console.log(api_test_mixed.mathEsm.subtract(5, 3)); // 2
	 *
	 * @example // ESM usage via slothlet API (inside async function)
	 * async function example() {
	 *   const { default: slothlet } = await import("@cldmv/slothlet");
	 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
	 *   console.log(api_test_mixed.mathEsm.subtract(5, 3)); // 2
	 * }
	 *
	 * @example // CJS usage via slothlet API (top-level)
	 * let slothlet;
	 * (async () => {
	 *   ({ slothlet } = await import("@cldmv/slothlet"));
	 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
	 *   console.log(api_test_mixed.mathEsm.subtract(5, 3)); // 2
	 * })();
	 *
	 * @example // CJS usage via slothlet API (inside async function)
	 * const slothlet = require("@cldmv/slothlet");
	 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
	 * console.log(api_test_mixed.mathEsm.subtract(5, 3)); // 2
	 */
	function subtract(a: number, b: number): number;
}
//# sourceMappingURL=math-esm.d.mts.map
