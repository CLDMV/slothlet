/**
 * @fileoverview Colliding counterpart of api_test_add_root_base's "existing" root key,
 * mounted alongside a brand-new sibling key ("fresh") in the same root add() call.
 * @module api_tests/api_test_add_root_multi
 */

/**
 * Colliding implementation of the "existing" root key.
 * @param {string} x - Input value.
 * @returns {string} Tagged value.
 */
export function existing(x) {
	return `root-multi:${x}`;
}
