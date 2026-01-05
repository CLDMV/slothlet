import { runTestMatrix } from "./test-helper.mjs";

console.log("🧪 Testing the test helper with a simple test...");

await runTestMatrix(
	{},
	async (api, configName, _) => {
		console.log(`   ⚡ ${configName}: API is ${typeof api}, has ${Object.keys(api).length} properties`);

		// Basic validation that the API loaded
		if (typeof api !== "function" && typeof api !== "object") {
			throw new Error(`API should be function or object, got ${typeof api}`);
		}

		if (typeof api === "function" && typeof api.math?.add !== "function") {
			throw new Error("Expected math.add function not found");
		}
	},
	"Test Helper Validation"
);

console.log("✅ Test helper validation complete!");
