/**
 * @fileoverview ESM `.js` leaf in a `"type": "module"` package — the control case for #521: it loads
 * through `import()` exactly as before.
 * @module api_test_cjs_js.esm.counter
 */

let count = 0;

/**
 * Increment and return this module scope's counter.
 * @returns {number} The new count.
 * @example
 * api.esm.counter.next(); // 1
 */
export function next() {
	return ++count;
}
