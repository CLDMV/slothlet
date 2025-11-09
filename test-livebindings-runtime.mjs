#!/usr/bin/env node

/**
 * Test Live Bindings runtime detection with proper context setup
 */

import slothlet from "@cldmv/slothlet";

async function testLiveBindingsRuntime() {
	console.log("🚀 Testing Live Bindings Runtime Detection");

	// Create slothlet instance with Live Bindings runtime and context data
	const api = await slothlet({
		dir: "./api_tests/api_test",
		runtime: "live",
		context: {
			user: "test-user-livebindings",
			testId: "livebindings-test-456"
		}
	});

	console.log("✅ API loaded successfully");

	// Test runtime detection
	const result = api.runtimeTest.verifyRuntime();

	console.log("\n📋 Runtime Verification Results:");
	console.log("  Runtime type detected:", result.runtimeType);
	console.log("  Context available:", result.contextTest.available);
	console.log("  Context user data:", result.contextTest.userData);
	console.log("  Instance ID value:", result.instanceIdTest.value);
	console.log("  Self test passed:", result.selfTest.available);

	return result;
}

testLiveBindingsRuntime().catch(console.error);
