// Test to understand stack trace issues with addApi
import slothlet from "./index.mjs";

// Let's examine the stack traces
function showStackTrace() {
	const err = new Error();
	const stack = err.stack?.split("\n").slice(1) || [];
	console.log("=== Stack Trace ===");
	stack.forEach((line, i) => console.log(`${i}: ${line.trim()}`));
	console.log("==================");
}

console.log("Stack trace from test script:");
showStackTrace();

console.log("\nTesting addApi...");
try {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		debug: true
	});

	// This should trigger the resolvePathFromCaller problem
	await api.addApi("myapi", "./api_tests/api_smart_flatten_folder_addapi");

	await api.shutdown();
} catch (error) {
	console.log("Error:", error.message);
}
