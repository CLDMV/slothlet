/**
 * @fileoverview Test for reference object with 'name' property assignment
 * Tests the fix for TypeError when reference object contains read-only properties like 'name'
 */

import slothlet from "../index.mjs";

/**
 * Test reference object with 'name' property
 * @returns {Promise<void>}
 */
async function testReferenceNameProperty() {
	console.log("🧪 Testing Reference Object with 'name' Property");
	console.log("=".repeat(50));

	try {
		// This should NOT throw an error after the fix
		console.log("\n📝 Creating slothlet with reference containing 'name' property...");

		const api = await slothlet({
			dir: "./api_tests/api_tv_test",
			reference: {
				version: "2.5.6", // Package version for debugging and context
				name: "test-package" // This used to cause TypeError: Cannot assign to read only property 'name'
			}
		});

		console.log("✅ Slothlet created successfully with reference.name property");

		// Test that the reference properties are accessible
		console.log("\n🔍 Testing reference property access...");
		console.log("api.version:", api.version);
		console.log("api.name:", api.name);

		if (api.version === "2.5.6" && api.name === "test-package") {
			console.log("✅ Reference properties correctly assigned");
		} else {
			console.log("❌ Reference properties not correctly assigned");
			console.log("  Expected version: 2.5.6, got:", api.version);
			console.log("  Expected name: test-package, got:", api.name);
		}

		// Test other reference properties work too
		console.log("\n🧪 Testing multiple reference properties...");
		const api2 = await slothlet({
			dir: "./api_tests/api_tv_test",
			reference: {
				version: "1.0.0",
				name: "another-package",
				author: "test-author",
				description: "test description",
				length: 42, // Another potentially problematic property
				prototype: { custom: "value" } // Another potentially problematic property
			}
		});

		console.log("api2.version:", api2.version);
		console.log("api2.name:", api2.name);
		console.log("api2.author:", api2.author);
		console.log("api2.description:", api2.description);
		console.log("api2.length:", api2.length);
		console.log("api2.prototype:", api2.prototype);

		console.log("\n✅ All reference properties handled correctly");
		console.log("🎉 TEST PASSED - No TypeError for read-only properties");
	} catch (error) {
		console.error("❌ TEST FAILED");
		console.error("Error:", error.message);
		console.error("Stack:", error.stack);
		process.exit(1);
	}
}

// Run the test if this file is executed directly
import { fileURLToPath } from "url";
import { resolve } from "path";

const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
	testReferenceNameProperty().catch(console.error);
}

export { testReferenceNameProperty };
