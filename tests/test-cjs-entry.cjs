/**
 * Test file for CommonJS entry point (index.cjs)
 * This tests that the CommonJS entry point can load slothlet correctly
 */

const slothlet = require("../index.cjs");

async function testCjsEntry() {
	console.log("🧪 Testing CommonJS entry point...");

	try {
		// Test that slothlet is loaded
		console.log("✓ Slothlet loaded via CommonJS:", typeof slothlet);

		// Test that it's callable (if it should be)
		if (typeof slothlet === "function") {
			console.log("✓ Slothlet is callable");

			// Test basic functionality
			const api = await slothlet({
				dir: "./api_test",
				debug: false,
				api_mode: "function"
			});

			console.log("✓ API created successfully via CommonJS entry");
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

		console.log("🎉 CommonJS entry point test passed!");
	} catch (error) {
		console.error("❌ CommonJS entry point test failed:", error.message);
		process.exit(1);
	}
}

testCjsEntry().catch(console.error);
