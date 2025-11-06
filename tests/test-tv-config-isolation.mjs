/**
 * @fileoverview Test for TV config isolation between multiple slothlet instances
 * This test checks if config state is properly isolated between different slothlet instances
 * or if there's a bug where config is shared between instances.
 */

import slothlet from "../index.mjs";

/**
 * Test TV config isolation between multiple slothlet instances
 * @returns {Promise<void>}
 */
async function testTvConfigIsolation() {
	console.log("🧪 Testing TV Config Isolation Between Slothlet Instances");
	console.log("=".repeat(60));

	try {
		// Create two separate slothlet instances for the same API folder
		console.log("\n📁 Loading two separate slothlet instances from api_tv_test...");

		const api1 = await slothlet({ dir: "./api_tests/api_tv_test" });
		const api2 = await slothlet({ dir: "./api_tests/api_tv_test" });

		console.log("✅ Both instances created successfully");

		// Get initial instance information
		console.log("\n🔍 Getting initial instance information...");
		const instance1Info = api1.config.getInstanceInfo();
		const instance2Info = api2.config.getInstanceInfo();

		console.log("Instance 1 ID:", instance1Info.instanceId);
		console.log("Instance 2 ID:", instance2Info.instanceId);

		if (instance1Info.instanceId === instance2Info.instanceId) {
			console.log("❌ WARNING: Instance IDs are the same - possible shared state!");
		} else {
			console.log("✅ Instance IDs are different - good sign for isolation");
		}

		// Get initial config states
		console.log("\n📋 Initial configuration states:");
		const initialConfig1 = api1.config.get();
		const initialConfig2 = api2.config.get();

		console.log("Instance 1 initial config:", JSON.stringify(initialConfig1, null, 2));
		console.log("Instance 2 initial config:", JSON.stringify(initialConfig2, null, 2));

		// Update config in instance 1
		console.log("\n🔄 Updating config in Instance 1...");
		const update1Result = api1.config.update({
			manufacturer: "samsung",
			host: "192.168.1.200",
			port: 8080,
			testValue1: "instance1-specific-value"
		});
		console.log("Instance 1 update result:", JSON.stringify(update1Result, null, 2));

		// Update config in instance 2 with different values
		console.log("\n🔄 Updating config in Instance 2...");
		const update2Result = api2.config.update({
			manufacturer: "sony",
			host: "192.168.1.300",
			port: 9090,
			testValue2: "instance2-specific-value"
		});
		console.log("Instance 2 update result:", JSON.stringify(update2Result, null, 2));

		// Get updated config states
		console.log("\n📋 Updated configuration states:");
		const updatedConfig1 = api1.config.get();
		const updatedConfig2 = api2.config.get();

		console.log("Instance 1 updated config:", JSON.stringify(updatedConfig1, null, 2));
		console.log("Instance 2 updated config:", JSON.stringify(updatedConfig2, null, 2));

		// Analysis and comparison
		console.log("\n🔬 Analysis:");

		// Check if configurations are different (they should be)
		const config1Manufacturer = updatedConfig1.manufacturer;
		const config2Manufacturer = updatedConfig2.manufacturer;
		const config1Host = updatedConfig1.host;
		const config2Host = updatedConfig2.host;
		const config1Port = updatedConfig1.port;
		const config2Port = updatedConfig2.port;

		console.log(`Instance 1 manufacturer: ${config1Manufacturer}`);
		console.log(`Instance 2 manufacturer: ${config2Manufacturer}`);
		console.log(`Instance 1 host: ${config1Host}`);
		console.log(`Instance 2 host: ${config2Host}`);
		console.log(`Instance 1 port: ${config1Port}`);
		console.log(`Instance 2 port: ${config2Port}`);

		// Test isolation
		let isolationPassed = true;
		const issues = [];

		if (config1Manufacturer === config2Manufacturer) {
			isolationPassed = false;
			issues.push("Manufacturer values are the same");
		}

		if (config1Host === config2Host) {
			isolationPassed = false;
			issues.push("Host values are the same");
		}

		if (config1Port === config2Port) {
			isolationPassed = false;
			issues.push("Port values are the same");
		}

		if (updatedConfig1.testValue1 && updatedConfig2.testValue1) {
			isolationPassed = false;
			issues.push("Instance 1 specific value found in Instance 2");
		}

		if (updatedConfig2.testValue2 && updatedConfig1.testValue2) {
			isolationPassed = false;
			issues.push("Instance 2 specific value found in Instance 1");
		}

		// Additional cross-contamination test
		console.log("\n🧪 Cross-contamination test:");
		console.log("Setting unique values in each instance...");

		api1.config.update("uniqueToInstance1", "value-only-in-1");
		api2.config.update("uniqueToInstance2", "value-only-in-2");

		const finalConfig1 = api1.config.get();
		const finalConfig2 = api2.config.get();

		console.log("Instance 1 has uniqueToInstance1:", !!finalConfig1.uniqueToInstance1);
		console.log("Instance 1 has uniqueToInstance2:", !!finalConfig1.uniqueToInstance2);
		console.log("Instance 2 has uniqueToInstance1:", !!finalConfig2.uniqueToInstance1);
		console.log("Instance 2 has uniqueToInstance2:", !!finalConfig2.uniqueToInstance2);

		if (finalConfig1.uniqueToInstance2) {
			isolationPassed = false;
			issues.push("Instance 1 contains value that should only be in Instance 2");
		}

		if (finalConfig2.uniqueToInstance1) {
			isolationPassed = false;
			issues.push("Instance 2 contains value that should only be in Instance 1");
		}

		// Final results
		console.log("\n" + "=".repeat(60));
		if (isolationPassed) {
			console.log("✅ ISOLATION TEST PASSED");
			console.log("   Config states are properly isolated between instances");
		} else {
			console.log("❌ ISOLATION TEST FAILED");
			console.log("   Issues found:");
			issues.forEach((issue) => console.log(`   - ${issue}`));
			console.log("\n   This indicates a potential bug where config state is shared");
			console.log("   between different slothlet instances when it should be isolated.");
		}

		// Test function calls isolation
		console.log("\n🔧 Testing function call isolation:");
		const port1 = api1.config.getDefaultPort();
		const port2 = api2.config.getDefaultPort();

		console.log(`Instance 1 getDefaultPort(): ${port1}`);
		console.log(`Instance 2 getDefaultPort(): ${port2}`);

		if (port1 !== port2) {
			console.log("✅ Function calls return different values - good isolation");
		} else {
			console.log("⚠️  Function calls return same values - check if this is expected");
		}
	} catch (error) {
		console.error("❌ Test failed with error:");
		console.error(error);
		process.exit(1);
	}
}

// Run the test if this file is executed directly
import { fileURLToPath } from "url";
import { resolve } from "path";

const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
	testTvConfigIsolation().catch(console.error);
}

export { testTvConfigIsolation };
