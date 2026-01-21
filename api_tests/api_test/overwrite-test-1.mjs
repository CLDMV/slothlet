/**
 * @fileoverview First file in overwrite test - loaded first alphabetically
 * @module api_test.overwriteTest1
 */

/**
 * First version of conflict function
 * @returns {string} Version identifier
 */
export default function overwriteTest() {
	return "overwrite-test-1";
}

/**
 * Named export that will be overwritten
 * @returns {string} Version identifier
 */
export function conflictingName() {
	return "from-file-1";
}
