/**
 * @fileoverview `a/b/x.mjs` of the same-named folder fixture (#743): reached at `api.a.b.x`.
 * @module api_test_folder_dedupe.a.b.x
 * @memberof module:api_test_folder_dedupe
 */

/**
 * The api path this function is reached at.
 * @function where
 * @memberof module:api_test_folder_dedupe.a.b.x
 * @returns {string} "a.b.x.where"
 * @example
 * api.a.b.x.where(); // "a.b.x.where"
 */
export function where() {
	return "a.b.x.where";
}
