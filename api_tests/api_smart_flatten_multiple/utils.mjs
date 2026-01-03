/**
 * Test folder for smart flattening Case 3: Multiple files with one matching API path
 * Scenario: addApi("utils", "./utils-folder") where folder contains utils.mjs + other files
 * Expected: api.utils.{utils-functions} + api.utils.other (utils.mjs flattened, others preserved)
 */

export function utilFunction() {
	return "utility function";
}

export function helperMethod() {
	return "helper method";
}

export function formatData(data) {
	return `Formatted: ${data}`;
}

export default {
	module: "utils-main",
	functions: ["utilFunction", "helperMethod", "formatData"]
};
