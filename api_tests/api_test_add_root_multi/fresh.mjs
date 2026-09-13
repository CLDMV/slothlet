/**
 * @fileoverview Brand-new root key mounted alongside a colliding sibling ("existing")
 * in the same root add() call — see api_test_add_root_multi/existing.mjs.
 * @module api_tests/api_test_add_root_multi
 */

/**
 * A root key with no prior collision.
 * @param {string} x - Input value.
 * @returns {string} Tagged value.
 */
export function fresh(x) {
	return `root-multi:fresh:${x}`;
}
