/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/test-auto-context-propagation.mjs
 *	@Date: 2025-10-22 08:40:37 -07:00 (1761147637)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-22 08:54:05 -07:00 (1761148445)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test script for automatic EventEmitter context propagation.
 * @module @cldmv/slothlet/tests/test-auto-context-propagation
 */

import net from "node:net";

/**
 * Test automatic context propagation for EventEmitter methods.
 * This test verifies that context is preserved WITHOUT requiring consumer changes.
 * @async
 * @returns {Promise<void>}
 */
async function testAutoContextPropagation() {
	console.log("[TEST] Testing automatic EventEmitter context propagation...\n");

	try {
		// Import slothlet and create an API instance
		const { default: slothlet } = await import("@cldmv/slothlet");
		const api = await slothlet({
			dir: "./api_tests/api_test",
			context: { user: "test-user", session: "auto-test-session" }
		});

		console.log("[TEST] ✅ Slothlet API created successfully");
		console.log("[TEST] API structure:", Object.keys(api));
		console.log("[TEST] API.__ctx exists:", !!api.__ctx);
		console.log("[TEST] API.__ctx structure:", api.__ctx ? Object.keys(api.__ctx) : "undefined");

		// Import runtime utilities to check context inside callbacks
		const { self, context } = await import("@cldmv/slothlet/runtime");

		console.log("[TEST] ✅ Runtime utilities imported");

		// Test 1: Direct access (should work)
		console.log("\n[TEST 1] Direct context access:");
		console.log("  self exists:", typeof self === "object" && Object.keys(self).length > 0);
		console.log("  self keys:", Object.keys(self));
		console.log("  context user:", context?.user);
		console.log("  API structure check:", Object.keys(api));

		// Debug: Check if the API is wrapped with context
		if (api.__ctx) {
			console.log("  ✅ API has __ctx property");
			console.log("  __ctx.self keys:", api.__ctx.self ? Object.keys(api.__ctx.self) : "undefined");
			console.log("  __ctx.context:", api.__ctx.context);
		} else {
			console.log("  ❌ API missing __ctx property - context not properly attached");
		}

		// Test 1.5: Call an API method to establish context
		console.log("\n[TEST 1.5] Basic API method call:");
		try {
			const result = api.math.add(1, 2);
			console.log("  ✅ API call successful: 1 + 2 =", result);
		} catch (error) {
			console.log("  ❌ API call failed:", error.message);
		}

		// Test 2: TCP Server EventEmitter - via API module (proper approach)
		console.log("\n[TEST 2] TCP Server EventEmitter callbacks - via API module:");

		// Check if TCP module is available
		if (!api.tcp) {
			console.log("  ❌ TCP module not found in API");
			process.exit(1);
		}

		console.log("  ✅ TCP module available in API");

		// Use the API module to create and test the server (this is the correct approach)
		const serverResult = await api.tcp.createTestServer();

		console.log("  🔍 Server creation result:");
		console.log("    Success: true");
		console.log("    Port:", serverResult.port);

		// Test by connecting as a client
		let responseData = null;
		const testPromise = new Promise((resolve, reject) => {
			const client = net.connect(serverResult.port, "localhost", () => {
				console.log("  📤 Client connected, sending test message...");
				client.write("Test message for context verification");
			});

			client.on("data", (data) => {
				console.log("  📨 Client received response:", data.toString());
				try {
					responseData = JSON.parse(data.toString());
				} catch (e) {
					console.log("  ⚠️  Failed to parse response as JSON:", e.message);
				}
				client.end();
			});

			client.on("end", () => {
				console.log("  🔌 Client disconnected");
				resolve();
			});

			client.on("error", reject);
		});

		await testPromise;

		// Close the server
		await serverResult.close();
		console.log("  🛑 Server closed");

		// Analyze the response data to determine test results
		let connectionContextPreserved = false;
		let dataContextPreserved = false;
		let apiAccessWorked = false;

		if (responseData) {
			// Check connection event context
			const connectionTest = responseData.tests?.find(t => t.event === "connection");
			if (connectionTest) {
				connectionContextPreserved = connectionTest.contextAvailable && connectionTest.contextUser === "test-user";
			}

			// Check data event context
			const dataTest = responseData.tests?.find(t => t.event === "data");
			if (dataTest) {
				dataContextPreserved = dataTest.contextAvailable && dataTest.contextUser === "test-user";
			}

			// Check API access
			if (responseData.apiAccess) {
				apiAccessWorked = responseData.apiAccess.success === true;
			}
		}

		// Final test results
		console.log("\n[TEST RESULTS]");
		console.log("  Connection handler context preserved:", connectionContextPreserved ? "✅" : "❌");
		console.log("  Data handler context preserved:", dataContextPreserved ? "✅" : "❌");
		console.log("  API access from handler worked:", apiAccessWorked ? "✅" : "❌");

		if (connectionContextPreserved && dataContextPreserved && apiAccessWorked) {
			console.log("\n🎉 SUCCESS: Automatic context propagation works perfectly!");
			console.log("   Consumer code requires NO changes - context just works!");
		} else {
			console.log("\n❌ FAILURE: Automatic context propagation needs more work");
			process.exit(1);
		}
	} catch (error) {
		console.error("[TEST] ❌ Test failed with error:", error);
		console.error(error.stack);
		process.exit(1);
	}
}

// Run the test
testAutoContextPropagation();
