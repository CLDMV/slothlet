/**
 * @fileoverview Single self-named leaf export used to reproduce the Rule 13 (C34)
 * AddApi path-deduplication bug: a folder whose only file's export name matches the
 * mount path's last segment must still mount as a callable leaf, not an empty object.
 * @module api_tests/api_test_add_dedup_leaf
 */

/**
 * Callable leaf with zero attached children — matches the mount path segment "thing".
 * @param {string} x - Input value.
 * @returns {string} Tagged value.
 */
export function thing(x) {
	return `base:${x}`;
}
