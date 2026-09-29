/**
 * @fileoverview ESM-syntax `.js` leaf in a package whose package.json has no `type` field (#521). Node's
 * syntax detection loads it as an ES module, so it must keep loading through `import()`.
 * @module api_test_cjs_js.untypedesm.counter
 */

let count = 0;

/**
 * Increment and return this module scope's counter.
 * @returns {number} The new count.
 * @example
 * api.untypedesm.counter.next(); // 1
 */
export function next() {
	return ++count;
}

/**
 * Whether this module was evaluated as an ES module (`import.meta` exists only there).
 * @returns {boolean} True under ESM.
 * @example
 * api.untypedesm.counter.isModule(); // true
 */
export function isModule() {
	return typeof import.meta.url === "string";
}
