/**
 * Test file for ESM entry point (index.mjs)
 * This tests that the ESM entry point can load slothlet correctly
 */

import slothlet from "../index.mjs";
// Also test named import
import { slothlet as namedSlothlet } from "../index.mjs";

async function testEsmEntry() {
	console.log("🧪 Testing ESM entry point...");

	try {
		// Test that slothlet is loaded
		console.log("✓ Slothlet loaded via ESM:", typeof slothlet);
		console.log("✓ Named slothlet loaded:", typeof namedSlothlet);

		// Test that default and named exports are the same
		if (slothlet === namedSlothlet) {
			console.log("✓ Default and named exports are identical");
		}

		// Test that it's callable (if it should be)
		if (typeof slothlet === "function") {
			console.log("✓ Slothlet is callable");

			// Test basic functionality
			const api = await slothlet({
				dir: "./api_test",
				debug: false,
				api_mode: "function"
			});

			console.log("✓ API created successfully via ESM entry");
			console.log("  API type:", typeof api);
			console.log("  API keys:", Object.keys(api));
		} else if (typeof slothlet?.create === "function") {
			console.log("✓ Slothlet.create is available");

			// Test using .create method
			const api = await slothlet.create({
				dir: "./api_test",
				debug: false,
				api_mode: "function"
			});

			console.log("✓ API created successfully via slothlet.create()");
			console.log("  API type:", typeof api);
			console.log("  API keys:", Object.keys(api));
		}

		console.log("🎉 ESM entry point test passed!");
	} catch (error) {
		console.error("❌ ESM entry point test failed:", error.message);
		process.exit(1);
	}
}

testEsmEntry().catch(console.error);
