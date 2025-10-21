/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/test-tcp-eventemitter-context.mjs
 *	@Date: 2025-10-21 16:58:11 -07:00 (1761091091)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-21 16:58:24 -07:00 (1761091104)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test script for TCP EventEmitter context propagation via API module.
 * @module @cldmv/slothlet/tests/test-tcp-eventemitter-context
 */

import net from "node:net";

/**
 * Test EventEmitter context propagation through the TCP API module.
 * This verifies that context is preserved in EventEmitter callbacks within API modules.
 * @async
 * @returns {Promise<void>}
 */
async function testTcpEventEmitterContext() {
	console.log("[TEST] Testing TCP EventEmitter context propagation via API module...\n");

	try {
		// Create slothlet API instance with context
		const { default: slothlet } = await import("@cldmv/slothlet");
		const api = await slothlet({
			dir: "./api_tests/api_test",
			context: { user: "test-user", session: "tcp-test-session" }
		});

		console.log("[TEST] ✅ Slothlet API created successfully");
		console.log("[TEST] API keys:", Object.keys(api).length);

		// Verify TCP module is available
		if (!api.tcp) {
			console.log("[TEST] ❌ TCP module not found in API");
			process.exit(1);
		}

		console.log("[TEST] ✅ TCP module available");

		// Test 1: Check context within TCP module method call
		console.log("\n[TEST 1] Context availability in TCP module:");
		const tcpContext = api.tcp.testContext();
		console.log("  📊 TCP module context check:");
		console.log("    self available:", tcpContext.selfAvailable);
		console.log("    self keys length:", tcpContext.selfKeys.length);
		console.log("    context available:", tcpContext.contextAvailable);
		console.log("    context user:", tcpContext.contextUser);

		if (tcpContext.selfAvailable && tcpContext.contextAvailable) {
			console.log("  ✅ Context is properly available within TCP API module!");
		} else {
			console.log("  ❌ Context not available within TCP API module");
			process.exit(1);
		}

		// Test 2: Create TCP server and test EventEmitter context propagation
		console.log("\n[TEST 2] TCP Server EventEmitter context propagation:");

		const serverInfo = await api.tcp.createTestServer();
		console.log("  ✅ TCP server created on port:", serverInfo.port);

		// Create client to trigger EventEmitter callbacks
		const testClient = () => {
			return new Promise((resolve, reject) => {
				console.log("  📤 Connecting client to test EventEmitter callbacks...");

				const client = net.connect(serverInfo.port, "localhost", () => {
					console.log("  🔌 Client connected, sending test data...");
					client.write("Test message for EventEmitter context verification");
				});

				client.on("data", (data) => {
					console.log("  📨 Client received:", data.toString().trim());
					client.end();
				});

				client.on("end", () => {
					console.log("  🔌 Client disconnected");
					resolve();
				});

				client.on("error", (err) => {
					console.error("  ❌ Client error:", err.message);
					reject(err);
				});

				// Timeout after 5 seconds
				setTimeout(() => {
					client.destroy();
					reject(new Error("Client timeout"));
				}, 5000);
			});
		};

		// Run client test
		await testClient();

		// Close server
		await serverInfo.close();
		console.log("  🛑 TCP server closed");

		// Test 3: Analyze EventEmitter context test results
		console.log("\n[TEST 3] EventEmitter context propagation results:");

		const connectionTests = serverInfo.contextTests.filter((t) => t.event === "connection");
		const dataTests = serverInfo.contextTests.filter((t) => t.event === "data");

		console.log("  📊 Connection handler results:");
		if (connectionTests.length > 0) {
			const connTest = connectionTests[0];
			console.log("    Self available:", connTest.selfAvailable);
			console.log("    Self keys length:", connTest.selfKeys.length);
			console.log("    Context available:", connTest.contextAvailable);
			console.log("    Context user:", connTest.contextUser);
		} else {
			console.log("    ❌ No connection tests recorded");
		}

		console.log("  📊 Data handler results:");
		if (dataTests.length > 0) {
			const dataTest = dataTests[0];
			console.log("    Self available:", dataTest.selfAvailable);
			console.log("    Self keys length:", dataTest.selfKeys.length);
			console.log("    Context available:", dataTest.contextAvailable);
			console.log("    Context user:", dataTest.contextUser);
		} else {
			console.log("    ❌ No data tests recorded");
		}

		// Final results
		console.log("\n[FINAL RESULTS]");

		const connectionContextWorking = connectionTests.length > 0 && connectionTests[0].selfAvailable && connectionTests[0].contextAvailable;

		const dataContextWorking = dataTests.length > 0 && dataTests[0].selfAvailable && dataTests[0].contextAvailable;

		console.log("  Connection EventEmitter context:", connectionContextWorking ? "✅ WORKING" : "❌ BROKEN");
		console.log("  Data EventEmitter context:", dataContextWorking ? "✅ WORKING" : "❌ BROKEN");

		if (connectionContextWorking && dataContextWorking) {
			console.log("\n🎉 SUCCESS: EventEmitter context propagation is working!");
			console.log("   ✅ Connection handlers preserve context");
			console.log("   ✅ Socket data handlers preserve context");
			console.log("   ✅ Full API access available in EventEmitter callbacks");
		} else {
			console.log("\n❌ FAILURE: EventEmitter context propagation has issues");
			if (!connectionContextWorking) console.log("   ❌ Connection handlers lose context");
			if (!dataContextWorking) console.log("   ❌ Data handlers lose context");
			process.exit(1);
		}
	} catch (error) {
		console.error("[TEST] ❌ Test failed with error:", error.message);
		console.error(error.stack);
		process.exit(1);
	}
}

// Run the test
testTcpEventEmitterContext();
