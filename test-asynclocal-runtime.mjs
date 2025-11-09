#!/usr/bin/env node

/**
 * Test AsyncLocalStorage runtime detection with proper context setup
 */

import slothlet from "@cldmv/slothlet";

async function testAsyncLocalStorageRuntime() {
	console.log("🚀 Testing AsyncLocalStorage Runtime Detection");

	// Create slothlet instance with AsyncLocalStorage runtime and context data
	const api = await slothlet({
		dir: "./api_tests/api_test",
		runtime: "async",
		context: {
			user: "test-user-asynclocalstorage",
			testId: "asynclocalstorage-test-123"
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

testAsyncLocalStorageRuntime().catch(console.error);
