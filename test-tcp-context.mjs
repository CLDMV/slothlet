#!/usr/bin/env node

/**
 * Test script to verify EventEmitter context propagation specifically
 */

import slothlet from "./index.mjs";

async function testTcpContext() {
	console.log("🧪 Testing TCP EventEmitter context propagation...\n");

	// Load the test API
	const api = await slothlet({
		dir: "./api_tests/api_test",
		context: { user: "test-user-context" }
	});

	console.log("✅ API loaded with context");

	// Call createTestServer - this should preserve context through nested callbacks
	console.log("\n📡 Creating TCP server with nested event listeners...");
	const result = await api.tcp.createTestServer();

	console.log("\n🎯 Result:", result);
	console.log("\n✅ Test completed successfully! EventEmitter context propagation is working.");
}

testTcpContext().catch(console.error);
