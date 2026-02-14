/**
 * Test TypeScript fast mode support
 */
import slothlet from "./index.mjs";

console.log("Testing TypeScript fast mode...\n");

try {
	// Load API with TypeScript enabled
	const api = await slothlet({
		dir: "./api_tests/api_test_typescript",
		typescript: true // Enable fast mode
	});

	console.log("✓ API loaded successfully with TypeScript support");
	
	// Test math functions
	console.log("\nTesting math.add(5, 3):", api.math.add(5, 3));
	console.log("Testing math.subtract(10, 4):", api.math.subtract(10, 4));
	console.log("Testing math.multiply(6, 7):", api.math.multiply(6, 7));
	
	// Test string functions
	console.log("\nTesting string.capitalize('hello'):", api.string.capitalize("hello"));
	console.log("Testing string.lowercase('WORLD'):", api.string.lowercase("WORLD"));
	console.log("Testing string.uppercase('test'):", api.string.uppercase("test"));
	
	console.log("\n✓ All TypeScript functions executed successfully!");
	
	await api.slothlet.shutdown();
	console.log("✓ Shutdown complete");
} catch (error) {
	console.error("✗ Error:", error.message);
	console.error(error);
	process.exit(1);
}
