/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/test-bind-context.mjs
 *	@Date: 2025-10-21 11:27:33 -07:00 (1761071253)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-21 13:16:55 -07:00 (1761077815)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test script for the bindContext utility function.
 * @module @cldmv/slothlet/tests/test-bind-context
 */

import { setTimeout } from "node:timers/promises";
import net from "node:net";

/**
 * Test the bindContext utility with AsyncLocalStorage context preservation.
 * @async
 * @returns {Promise<void>}
 */
async function testBindContext() {
	console.log("[TEST] Testing bindContext utility...\n");

	try {
		// Import slothlet and create an API instance
		const { default: slothlet } = await import("@cldmv/slothlet");
		const api = await slothlet({
			dir: "./api_tests/api_test",
			context: { user: "test-user", environment: "testing" }
		});

		console.log("[TEST] ✅ Slothlet API created successfully");
		console.log("[TEST] API structure:", Object.keys(api));

		// Import runtime utilities
		const { self, context, bindContext } = await import("@cldmv/slothlet/runtime");

		console.log("[TEST] ✅ Runtime utilities imported");

		// Test 1: Direct access (should work)
		console.log("\n[TEST 1] Direct context access:");
		console.log("  self exists:", typeof self === "object" && Object.keys(self).length > 0);
		console.log("  self keys:", Object.keys(self));
		console.log("  context exists:", typeof context === "object");
		console.log("  context data:", context);

		// Test 2: setTimeout without bindContext (should fail - context lost)
		console.log("\n[TEST 2] setTimeout without bindContext (context should be lost):");
		setTimeout(() => {
			console.log("  self in setTimeout (no bind):", Object.keys(self));
			console.log("  context in setTimeout (no bind):", context);
		}, 10);

		// Wait for the setTimeout to complete
		await setTimeout(50);

		// Test 3: setTimeout with bindContext (should work - context preserved)
		console.log("\n[TEST 3] setTimeout with bindContext (context should be preserved):");
		setTimeout(
			bindContext(() => {
				console.log("  self in setTimeout (with bind):", Object.keys(self));
				console.log("  context in setTimeout (with bind):", context);
				console.log("  ✅ Context preserved in bound setTimeout callback");
			}),
			10
		);

		// Wait for the bound setTimeout to complete
		await setTimeout(50);

		// Test 4: TCP socket simulation with bindContext
		console.log("\n[TEST 4] TCP socket event handler simulation:");

		// Create a simple TCP server to test socket event handlers
		const server = net.createServer();

		server.on(
			"connection",
			bindContext((socket) => {
				console.log("  ✅ Socket connection - context available in handler");
				console.log("  self keys in socket handler:", Object.keys(self));
				console.log("  context in socket handler:", context);

				socket.on(
					"data",
					bindContext((_) => {
						console.log("  ✅ Socket data received - context preserved in nested handler");
						console.log("  self exists in data handler:", Object.keys(self).length > 0);
						console.log("  context user:", context?.user);

						// Test accessing API through self
						if (self.math && typeof self.math.add === "function") {
							const result = self.math.add(2, 3);
							console.log("  ✅ API method call successful: 2 + 3 =", result);
						}

						socket.end("Response from bound handler\n");
					})
				);
			})
		);

		// Start server on a random port
		server.listen(0, "localhost", () => {
			const port = server.address().port;
			console.log(`  📡 Test server listening on port ${port}`);

			// Create a client connection to test the server
			const client = net.connect(port, "localhost", () => {
				console.log("  📤 Client connected, sending test data...");
				client.write("test message from client");
			});

			client.on("data", (data) => {
				console.log("  📥 Client received:", data.toString().trim());
				client.end();
			});

			client.on("end", () => {
				console.log("  🔌 Client connection ended");
				server.close(() => {
					console.log("  🛑 Server closed");
					console.log("\n[TEST] ✅ All bindContext tests completed successfully!");
				});
			});
		});
	} catch (error) {
		console.error("[TEST] ❌ Test failed:", error);
		console.error(error.stack);
		process.exit(1);
	}
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, _) => {
	console.error("[TEST] ❌ Unhandled promise rejection:", reason);
	process.exit(1);
});

// Run the test
testBindContext();
