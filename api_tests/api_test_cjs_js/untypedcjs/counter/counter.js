/**
 * @fileoverview CommonJS-syntax `.js` leaf in a package whose package.json has no `type` field (#521).
 * Node loads it as CommonJS, so its module-scope state must be per slothlet instance.
 * @module api_test_cjs_js.untypedcjs.counter
 */

let count = 0;

module.exports = {
	/**
	 * Increment and return this module scope's counter.
	 * @returns {number} The new count.
	 * @example
	 * api.untypedcjs.counter.next(); // 1
	 */
	next: () => ++count
};
