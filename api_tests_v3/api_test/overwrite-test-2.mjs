/**
 * @fileoverview Second file in overwrite test - loaded second alphabetically
 * @description This file attempts to overwrite conflictingName from overwrite-test-1.mjs
 * @module api_test.overwriteTest2
 */

/**
 * Second version of conflict function - attempts to overwrite
 * @returns {string} Version identifier
 */
export default function overwriteTest() {
	return "overwrite-test-2";
}

/**
 * Named export attempting to overwrite the one from file 1
 * @returns {string} Version identifier
 */
export function conflictingName() {
	return "from-file-2";
}
