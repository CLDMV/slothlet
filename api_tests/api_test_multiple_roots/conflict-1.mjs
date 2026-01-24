/**
 * @fileoverview First collision test file - loaded first alphabetically.
 * Exports a default function that will collide with conflict-2.mjs at root level.
 * @module api_test/conflict-1
 */

/**
 * First version of conflicting function.
 * @returns {string} Version identifier.
 */
export default function conflictingName() {
	return "from-file-1";
}

export function rootFunctionShout(name) {
	return `HELLO 1, ${name.toUpperCase()}!`;
}
