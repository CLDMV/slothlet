/**
 * @fileoverview Override counterpart of api_test_add_dedup_leaf's self-named leaf, used to
 * verify a forceOverwrite replace onto the leaf actually swaps its callable impl.
 * @module api_tests/api_test_add_dedup_leaf_override
 */

/**
 * Callable leaf with zero attached children — matches the mount path segment "thing".
 * @param {string} x - Input value.
 * @returns {string} Tagged value.
 */
export function thing(x) {
	return `override:${x}`;
}
