import slothlet from "./index.mjs";

console.log("=== Testing addApi with different folder structures ===");

// Test 1: Regular structure (should work now)
console.log("\n1. Testing with folder + api_smart_flatten_folder_addapi...");
try {
	const api1 = await slothlet({
		dir: "./api_tests/api_test",
		debug: true // Enable debug output
	});

	await api1.addApi("myapi", "./api_tests/api_smart_flatten_folder_addapi");

	console.log("✅ Test 1 passed: addApi completed successfully");
	console.log("api.myapi.getConfigValue:", typeof api1.myapi?.getConfigValue);
	console.log("api.myapi.version:", api1.myapi?.version);

	await api1.shutdown();
} catch (error) {
	console.log("❌ Test 1 failed:", error.message);
}

// Test 2: Category flattening with disableAutoFlattening=true
console.log("\n2. Testing category flattening with disableAutoFlattening=true...");
try {
	const api2 = await slothlet({
		dir: "./api_tests/api_test"
	});

	await api2.addApi(
		"myapi2",
		"./api_tests/api_smart_flatten_folder_config",
		{}, // metadata
		false // autoFlatten = false (disableAutoFlattening)
	);

	console.log("✅ Test 2 passed: addApi with disableAutoFlattening completed");
	console.log("api.myapi2.config exists:", typeof api2.myapi2?.config);
	console.log("Should NOT flatten config folder when disabled");

	await api2.shutdown();
} catch (error) {
	console.log("❌ Test 2 failed:", error.message);
}

console.log("\n=== All addApi tests completed ===");
