/**
 * @fileoverview The module the rules guard: `api.vault.get()`.
 * @module api_test_leaf_call.vault
 * @memberof module:api_test_leaf_call
 */

/**
 * What the rules guard.
 * @function get
 * @memberof module:api_test_leaf_call.vault
 * @returns {string} "SECRET"
 * @example
 * api.vault.get(); // "SECRET"
 */
export function get() {
	return "SECRET";
}
