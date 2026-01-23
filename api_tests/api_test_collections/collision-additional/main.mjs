/**
 * @fileoverview Additional content for collision testing
 * @module api_test_collections.collisionAdditional
 * 
 * @description  
 * This folder is used to test api.add() collision modes when adding to an existing path.
 * It should be added via api.add("collisionOriginal", path_to_this_folder, ...) to test collisions.
 */

/**
 * New function added during hot reload
 * @returns {string} Identifier
 */
export function newFunction() {
	return "new-function-from-collision-test";
}

/**
 * Additional version marker
 * @type {string}
 */
export const additionalVersion = "2.0.0";

/**
 * Shared function name that may conflict
 * @returns {string} Result
 */
export function sharedFunction() {
	return "from-additional-module";
}
