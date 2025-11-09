#!/usr/bin/env node

/**
 * Test Experimental runtime detection with proper context setup
 */

import slothlet from "@cldmv/slothlet";

async function testExperimentalRuntime() {
	console.log("🚀 Testing Experimental Runtime Detection");

	// Create slothlet instance with Experimental runtime and context data
	const api = await slothlet({
		dir: "./api_tests/api_test",
		runtime: "experimental",
		context: {
			user: "test-user-experimental",
			testId: "experimental-test-456"
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

testExperimentalRuntime().catch(console.error);
