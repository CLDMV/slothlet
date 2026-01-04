// Test root level multi-default behavior
import slothlet from "./index.mjs";

async function testRootMultiDefault() {
	const api = await slothlet({ dir: "./api_tests/api_tv_test" });

	console.log("=== Testing Root Multi-Default Behavior ===");

	// Test volume (has both named exports and default export)
	console.log("\nvolume module:");
	console.log("typeof api.volume:", typeof api.volume);
	console.log("api.volume properties:", Object.keys(api.volume || {}));

	try {
		const result1 = api.volume(50); // Should call default export (set function)
		console.log("✅ api.volume(50) [default]:", result1);
	} catch (e) {
		console.log("❌ api.volume(50) [default] failed:", e.message);
	}

	try {
		const result2 = api.volume.up(); // Should call named export
		console.log("✅ api.volume.up():", result2);
	} catch (e) {
		console.log("❌ api.volume.up() failed:", e.message);
	}

	try {
		const result3 = api.volume.down(); // Should call named export
		console.log("✅ api.volume.down():", result3);
	} catch (e) {
		console.log("❌ api.volume.down() failed:", e.message);
	}
}

testRootMultiDefault().catch(console.error);
