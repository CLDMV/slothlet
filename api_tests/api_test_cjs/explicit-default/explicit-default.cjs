/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_cjs/explicit-default/explicit-default.cjs
 *	@Date: 2025-10-27T09:42:13-07:00 (1761583333)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:12 -08:00 (1772425272)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Explicit CJS default export example with hyphenated name (part of CJS test modules). Internal file (not exported in package.json).
 * @module api_test_cjs.explicitDefault
 * @memberof module:api_test_cjs
 */

/**
 * Calculator object for testing explicit CJS default exports with sanitized naming.
 * This tests the behavior where folder name "explicit-default" becomes API key "explicitDefault".
 * @private
 */
const calculator = {
	/**
	 * Multiplies two numbers using explicit CJS default pattern.
	 * @function multiply
	 * @param {number} a - First number to multiply
	 * @param {number} b - Second number to multiply
	 * @returns {number} The product of a and b
	 */
	multiply(a, b) {
		return a * b;
	},

	/**
	 * Divides two numbers using explicit CJS default pattern.
	 * @function divide
	 * @param {number} a - Dividend
	 * @param {number} b - Divisor
	 * @returns {number} The quotient of a divided by b
	 */
	divide(a, b) {
		if (b === 0) {
			throw new Error("Division by zero");
		}
		return a / b;
	}
};

/**
 * Gets the name of the calculator for testing named exports alongside explicit defaults.
 * @function getCalculatorName
 * @returns {string} The name identifier for this calculator instance
 */
function getCalculatorName() {
	return "Hyphenated Default Calculator";
}

// Export pattern: explicit default with named export
// This creates: module.exports = { default: calculator, getCalculatorName: fn }
// Expected API after sanitization: api.explicitDefault.default.multiply() + api.explicitDefault.getCalculatorName()
// Note: The folder name "explicit-default" becomes "explicitDefault" due to sanitization
module.exports = {
	default: calculator,
	getCalculatorName
};
