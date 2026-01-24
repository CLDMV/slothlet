/**
 * @fileoverview Second collision test file - loaded second alphabetically.
 * Exports a default function that will collide with conflict-1.mjs at root level.
 * @module api_test/conflict-2
 */

/**
 * Second version of conflicting function.
 * @returns {string} Version identifier.
 */
export default function conflictingName() {
	return "from-file-2";
}

export function rootFunctionShout(name) {
	return `HELLO 2, ${name.toUpperCase()}!`;
}
