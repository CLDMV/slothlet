/**
 * Special addapi.mjs file - should be auto-flattened
 */

/**
 * Test function that should be flattened to parent level
 */
export function specialFunction() {
	return "This function should appear at the parent API level";
}

/**
 * Another test function
 */
export function anotherFunction() {
	return "This should also be flattened up";
}

export default {
	defaultFunction: () => "Default export from addapi",
	value: "special-addapi-value"
};
