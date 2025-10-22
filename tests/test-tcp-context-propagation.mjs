#!/usr/bin/env node

/**
 * @fileoverview Test script for automatic EventEmitter context propagation using API modules.
 * @module @cldmv/slothlet/tests/test-tcp-context-propagation
 */

import net from "node:net";

/**
 * Test automatic context propagation for EventEmitter methods within API modules.
 * This test verifies that context is preserved in EventEmitter callbacks within API modules
 * WITHOUT requiring consumer changes.
 * @async
 * @returns {Promise<void>}
 */
async function testTcpContextPropagation() {
	console.log("[TEST] Testing TCP EventEmitter context propagation within API modules...\n");

	try {
		// Import slothlet and create an API instance
		const { default: slothlet } = await import("@cldmv/slothlet");
		const api = await slothlet({
			dir: "./api_tests/api_test",
			context: { user: "test-user", session: "tcp-test-session" }
		});

		console.log("[TEST] ✅ Slothlet API created successfully");
		console.log("[TEST] API structure:", Object.keys(api));

		// Verify the TCP module is available
		if (!api.tcp) {
			console.log("[TEST] ❌ TCP module not found in API");
			process.exit(1);
		}

		console.log("[TEST] ✅ TCP module available in API");

		// Test 1: Check context within the TCP module itself (before EventEmitter callbacks)
		console.log("\n[TEST 1] Context availability in TCP module:");
		const tcpContext = api.tcp.testContext();
		console.log("  📊 TCP module context:");
		console.log("    self available:", tcpContext.selfAvailable);
		console.log("    self keys length:", tcpContext.selfKeys.length);
		console.log("    context available:", tcpContext.contextAvailable);
		console.log("    context user:", tcpContext.contextUser);

		if (tcpContext.selfAvailable && tcpContext.contextAvailable) {
			console.log("  ✅ Context is available within the TCP API module!");
		} else {
			console.log("  ❌ Context not available within the TCP API module");
			process.exit(1);
		}

		// Test 2: Create TCP server within the API module and test EventEmitter callbacks
		console.log("\n[TEST 2] TCP Server EventEmitter callbacks - automatic context propagation:");

		const serverInfo = await api.tcp.createTestServer();
		console.log("  ✅ TCP server created from API module");

		// Debug: Check if the returned server is wrapped
		console.log("  🔍 DEBUG - ServerInfo inspection:");
		console.log("    ServerInfo type:", typeof serverInfo);
		console.log("    ServerInfo constructor:", serverInfo?.constructor?.name);
		console.log("    ServerInfo keys:", Object.keys(serverInfo));
		console.log("    Server type:", typeof serverInfo.server);
		console.log("    Server constructor:", serverInfo.server?.constructor?.name);
		console.log("    Server has 'on':", typeof serverInfo.server?.on === "function");
		console.log("    Server is wrapped (constructor name):", serverInfo.server?.constructor?.name === "Proxy");
		console.log("    Server accessing 'on' method...");
		const serverOnMethod = serverInfo.server.on;
		console.log("    Server 'on' method type:", typeof serverOnMethod);

		// Test the server by connecting as a client
		const testPromise = new Promise((resolve, reject) => {
			const client = net.connect(serverInfo.port, "localhost", () => {
				console.log("  📤 Client connected to TCP server");
				client.write("Test message for context propagation");
			});

			client.on("data", (data) => {
				try {
					const response = JSON.parse(data.toString());
					console.log("  📨 Received response from server");

					// Analyze the context test results
					console.log("\n[CONTEXT TEST RESULTS]");

					let allTestsPassed = true;

					response.tests.forEach((test, index) => {
						console.log(`  Test ${index + 1} (${test.event}):`);
						console.log(`    Self available: ${test.selfAvailable ? "✅" : "❌"}`);
						console.log(`    Self keys: ${test.selfKeys.length}`);
						console.log(`    Context available: ${test.contextAvailable ? "✅" : "❌"}`);
						console.log(`    Context user: ${test.contextData?.user || "undefined"}`);

						if (!test.selfAvailable || !test.contextAvailable) {
							allTestsPassed = false;
						}
					});

					console.log("\n[API ACCESS TEST]");
					if (response.apiAccess.success) {
						console.log(`  ✅ API call from socket handler: ${response.apiAccess.result}`);
					} else {
						console.log(`  ❌ API call failed: ${response.apiAccess.error}`);
						allTestsPassed = false;
					}

					console.log("\n[SERVER CONTEXT]");
					console.log(`  User: ${response.serverContext.user}`);
					console.log(`  Session: ${response.serverContext.session}`);

					if (response.serverContext.user !== "test-user") {
						allTestsPassed = false;
					}

					resolve(allTestsPassed);
				} catch (error) {
					console.log("  ❌ Failed to parse server response:", error.message);
					reject(error);
				}
			});

			client.on("error", (error) => {
				console.log("  ❌ Client error:", error.message);
				reject(error);
			});

			client.on("end", () => {
				console.log("  🔌 Client connection ended");
			});
		});

		// Wait for the test to complete
		const allTestsPassed = await testPromise;

		// Close the server
		await serverInfo.close();

		// Final results
		console.log("\n[FINAL RESULTS]");
		if (allTestsPassed) {
			console.log("🎉 SUCCESS: Automatic EventEmitter context propagation works!");
			console.log('   ✅ Context preserved in server.on("connection", callback)');
			console.log('   ✅ Context preserved in socket.on("data", callback)');
			console.log("   ✅ API access works from within EventEmitter callbacks");
			console.log("   ✅ No consumer code changes required!");
		} else {
			console.log("❌ FAILURE: EventEmitter context propagation needs more work");
			process.exit(1);
		}
	} catch (error) {
		console.error("[TEST] ❌ Test failed with error:", error);
		console.error(error.stack);
		process.exit(1);
	}
}

// Run the test
testTcpContextPropagation();
