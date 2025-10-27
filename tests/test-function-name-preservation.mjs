/**
 * @fileoverview Test to verify function names are preserved after transformation
 * This test ensures that original function names are maintained in both eager and lazy modes
 * and that function name preference works correctly (e.g., autoIP vs autoIp).
 */
import slothlet from "@cldmv/slothlet";

/**
 * Test function name preservation in both eager and lazy modes
 * @async
 * @returns {Promise<void>}
 * @throws {Error} When function names are not preserved correctly
 */
async function testFunctionNamePreservation() {
	console.log("🧪 Testing Function Name Preservation...");

	const errors = [];

	// Test both eager and lazy modes
	const modes = [
		{ name: "EAGER", options: { dir: "./api_tests/api_test", lazy: false } },
		{ name: "LAZY", options: { dir: "./api_tests/api_test", lazy: true } }
	];

	for (const { name, options } of modes) {
		console.log(`\n🔍 Testing ${name} mode...`);

		const api = await slothlet({ ...options, debug: false }); // Disable debug output for cleaner test

		try {
			// Test 1: Root function should be callable
			if (typeof api !== "function") {
				errors.push(`${name}: Root API should be callable function`);
			}

			// Test 2: Named exports at root level should have correct names
			if (api.rootFunctionShout?.name !== "rootFunctionShout") {
				errors.push(`${name}: rootFunctionShout name should be "rootFunctionShout", got "${api.rootFunctionShout?.name}"`);
			}

			if (api.rootFunctionWhisper?.name !== "rootFunctionWhisper") {
				errors.push(`${name}: rootFunctionWhisper name should be "rootFunctionWhisper", got "${api.rootFunctionWhisper?.name}"`);
			}

			// Test 3: Function name preservation after materialization
			if (name === "LAZY") {
				// In lazy mode, materialize functions by calling them
				await api.math.add(2, 3);
				await api.math.multiply(4, 5);
				await api.multi_defaults.key("TEST");
				await api.multi_defaults.power();
				await api.multi_defaults.volume(50);
				await api.task.autoIP();
			}

			// Check function names after materialization (or immediate for eager mode)
			if (api.math?.add?.name !== "add") {
				errors.push(`${name}: math.add name should be "add", got "${api.math?.add?.name}"`);
			}

			if (api.math?.multiply?.name !== "multiply") {
				errors.push(`${name}: math.multiply name should be "multiply", got "${api.math?.multiply?.name}"`);
			}

			// Test 4: Function name preference (function name over sanitized filename)
			if (api.task?.autoIP?.name !== "autoIP") {
				errors.push(`${name}: task.autoIP name should be "autoIP" (function name preference), got "${api.task?.autoIP?.name}"`);
			} // Test 5: Multi-defaults should use function names, not filenames
			if (api.multi_defaults?.key?.name !== "key") {
				errors.push(`${name}: multi_defaults.key name should be "key" (function name), got "${api.multi_defaults?.key?.name}"`);
			}

			if (api.multi_defaults?.power?.name !== "power") {
				errors.push(`${name}: multi_defaults.power name should be "power" (function name), got "${api.multi_defaults?.power?.name}"`);
			}

			if (api.multi_defaults?.volume?.name !== "volume") {
				errors.push(`${name}: multi_defaults.volume name should be "volume" (function name), got "${api.multi_defaults?.volume?.name}"`);
			}

			console.log(`✅ ${name} mode passed all function name tests`);
		} catch (error) {
			errors.push(`${name}: Test execution failed - ${error.message}`);
		} finally {
			await api.shutdown();
		}
	}

	// Report results
	if (errors.length > 0) {
		console.log(`\n❌ Function Name Preservation Test FAILED:`);
		for (const error of errors) {
			console.log(`   • ${error}`);
		}
		process.exit(1);
	} else {
		console.log(`\n✅ Function Name Preservation Test PASSED - All function names preserved correctly!`);
	}
}

// Run the test
testFunctionNamePreservation().catch((error) => {
	console.error("❌ Test failed with error:", error);
	process.exit(1);
});
