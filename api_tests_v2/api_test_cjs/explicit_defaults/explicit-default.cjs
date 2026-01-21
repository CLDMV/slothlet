/**
 * @fileoverview Explicit CJS default export test (part of CJS test modules). Internal file (not exported in package.json).
 * @module api_test_cjs.explicit_defaults.explicitDefault
 * @memberof module:api_test_cjs
 */

/**
 * Calculator object with explicit default export.
 * @alias module:api_test_cjs.explicitDefaults.explicitDefault
 */
const calculator =
	/** @lends calculator */
	{
		/**
		 * Multiplies two numbers with explicit CJS default export.
		 * @function multiply
		 * @param {number} a - First number to multiply
		 * @param {number} b - Second number to multiply
		 * @returns {number} The product of a and b
		 * @example // ESM usage via slothlet API
		 * import slothlet from "@cldmv/slothlet";
		 * const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
		 * console.log(api_test_cjs.explicitDefaults.multiply(3, 4)); // 12
		 *
		 * @example // CJS usage via slothlet API
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test_cjs = await slothlet({ dir: "./api_tests/api_test_cjs" });
		 * console.log(api_test_cjs.explicitDefaults.multiply(3, 4)); // 12
		 */
		multiply(a, b) {
			return a * b;
		},

		/**
		 * Divides two numbers with explicit CJS default export.
		 * @function divide
		 * @param {number} a - Dividend
		 * @param {number} b - Divisor
		 * @returns {number} The quotient of a divided by b
		 * @example
		 * console.log(api_test_cjs.explicitDefaults.divide(12, 3)); // 4
		 */
		divide(a, b) {
			return a / b;
		}
	};

/**
 * Utility function for explicit default testing.
 * @function getCalculatorName
 * @returns {string} Name of the calculator
 * @example
 * console.log(api_test_cjs.explicitDefaults.getCalculatorName()); // "Explicit Default Calculator"
 */
function getCalculatorName() {
	return "Explicit Default Calculator";
}

// Explicit CJS default export (should be treated as ESM default after unwrapping)
module.exports = {
	default: calculator,
	getCalculatorName: getCalculatorName
};
