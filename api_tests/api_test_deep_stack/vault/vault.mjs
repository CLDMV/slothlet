/**
 * @fileoverview The module the rules guard: `api.vault.get()`.
 * @module api_test_deep_stack.vault
 * @memberof module:api_test_deep_stack
 */

/**
 * What the rules guard.
 * @function get
 * @memberof module:api_test_deep_stack.vault
 * @returns {string} "SECRET"
 * @example
 * api.vault.get(); // "SECRET"
 */
export function get() {
	return "SECRET";
}
