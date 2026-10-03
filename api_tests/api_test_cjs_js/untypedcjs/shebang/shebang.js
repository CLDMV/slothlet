#!/usr/bin/env node
/**
 * @fileoverview CommonJS `.js` leaf with a leading hashbang, in a package with no `type` field (#521).
 * Node strips the hashbang and loads the file as CommonJS.
 * @module api_test_cjs_js.untypedcjs.shebang
 */

let count = 0;

module.exports = {
	/**
	 * Increment and return this module scope's counter.
	 * @returns {number} The new count.
	 * @example
	 * api.untypedcjs.shebang.next(); // 1
	 */
	next: () => ++count
};
