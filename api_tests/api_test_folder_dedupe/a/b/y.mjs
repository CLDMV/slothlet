/**
 * @fileoverview `a/b/y.mjs` of the same-named folder fixture (#743): reached at `api.a.b.y`.
 * @module api_test_folder_dedupe.a.b.y
 * @memberof module:api_test_folder_dedupe
 */

/**
 * The api path this function is reached at.
 * @function where
 * @memberof module:api_test_folder_dedupe.a.b.y
 * @returns {string} "a.b.y.where"
 * @example
 * api.a.b.y.where(); // "a.b.y.where"
 */
export function where() {
	return "a.b.y.where";
}
