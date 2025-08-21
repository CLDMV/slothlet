/**
 * multi_func.mjs - Test file for folder flattening in slothlet
 * Exports unique functions to be flattened onto the multi_func API object.
 *
 * Usage:
 *   api.multiFunc.uniqueOne(...)
 *   api.multiFunc.uniqueTwo(...)
 *   api.multiFunc.uniqueThree(...)
 */

export function uniqueOne(msg) {
	return `uniqueOne: ${msg}`;
}

export function uniqueTwo(msg) {
	return `uniqueTwo: ${msg}`;
}

export function uniqueThree(msg) {
	return `uniqueThree: ${msg}`;
}
