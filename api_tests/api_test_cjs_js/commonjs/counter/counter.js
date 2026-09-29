/**
 * @fileoverview CommonJS `.js` leaf in a `"type": "commonjs"` package (#521). Module-scope state must be
 * per slothlet instance, exactly as for a `.cjs` leaf.
 * @module api_test_cjs_js.commonjs.counter
 */

let count = 0;

module.exports = {
	/**
	 * Increment and return this module scope's counter.
	 * @returns {number} The new count.
	 * @example
	 * api.commonjs.counter.next(); // 1
	 */
	next: () => ++count
};
