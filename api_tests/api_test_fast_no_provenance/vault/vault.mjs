/**
 * @fileoverview The module the rules guard: `api.vault.get()`.
 * @module api_test_fast_no_provenance.vault
 * @memberof module:api_test_fast_no_provenance
 */

/**
 * What the rules guard.
 * @function get
 * @memberof module:api_test_fast_no_provenance.vault
 * @returns {string} "SECRET"
 * @example
 * api.vault.get(); // "SECRET"
 */
export function get() {
	return "SECRET";
}
