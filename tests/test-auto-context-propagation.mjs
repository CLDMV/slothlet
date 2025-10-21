#!/usr/bin/env node

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

		// Test 1.5: Call an API method to establish context and test inside the call
		console.log("\n[TEST 1.5] Context from within API method call:");
		try {
			const result = api.math.add(1, 2);
			console.log("  ✅ API call successful: 1 + 2 =", result);

			// Test context from within API method
			const contextInfo = api.math.testContext();
			console.log("  📊 Context info from within API method:");
			console.log("    self type:", contextInfo.selfType);
			console.log("    self keys length:", contextInfo.selfKeys.length);
			console.log("    context type:", contextInfo.contextType);
			console.log("    context data:", contextInfo.contextData);
			console.log("    context as function:", contextInfo.contextAsFunction);
			console.log("    context user (direct):", contextInfo.contextUser);
			console.log("    context keys:", contextInfo.contextKeys);

			// Check if we have meaningful context data
			const hasWorkingContext =
				contextInfo.selfKeys.length > 1 && (contextInfo.contextUser === "test-user" || contextInfo.contextAsFunction?.user === "test-user");

			if (hasWorkingContext) {
				console.log("  ✅ Context is properly available within API method calls!");
			} else {
				console.log("  ❌ Context not fully available within API method calls");
			}
		} catch (error) {
			console.log("  ❌ API call failed:", error.message);
		}

		// Test 2: TCP Server with automatic context propagation
		console.log("\n[TEST 2] TCP Server EventEmitter - automatic context propagation:");

		let contextPreservedInConnection = false;
		let contextPreservedInData = false;
		let apiAccessWorked = false;

		const server = net.createServer();

		// This should automatically preserve context - NO manual wrapping required
		server.on("connection", (socket) => {
			console.log("  🔌 Socket connection handler triggered");

			// Check if context is preserved automatically
			const selfInHandler = self;
			const contextInHandler = context;

			console.log("  📊 Context check in connection handler:");
			console.log("    self keys:", Object.keys(selfInHandler));
			console.log("    context user:", contextInHandler?.user);

			if (Object.keys(selfInHandler).length > 0 && contextInHandler?.user === "test-user") {
				contextPreservedInConnection = true;
				console.log("  ✅ Context preserved in connection handler!");
			} else {
				console.log("  ❌ Context lost in connection handler");
			}

			// Test nested EventEmitter callback (data handler)
			socket.on("data", (data) => {
				console.log("  📥 Socket data handler triggered");

				const selfInDataHandler = self;
				const contextInDataHandler = context;

				console.log("  📊 Context check in data handler:");
				console.log("    self keys:", Object.keys(selfInDataHandler));
				console.log("    context user:", contextInDataHandler?.user);

				if (Object.keys(selfInDataHandler).length > 0 && contextInDataHandler?.user === "test-user") {
					contextPreservedInData = true;
					console.log("  ✅ Context preserved in data handler!");

					// Test API method access within the handler
					if (selfInDataHandler.math && typeof selfInDataHandler.math.add === "function") {
						try {
							const result = selfInDataHandler.math.add(5, 7);
							console.log("  🧮 API method call result: 5 + 7 =", result);
							apiAccessWorked = true;
							console.log("  ✅ API access worked from within socket handler!");
						} catch (error) {
							console.log("  ❌ API access failed:", error.message);
						}
					}
				} else {
					console.log("  ❌ Context lost in data handler");
				}

				// Send response and close
				socket.write(`Server received: ${data.toString().trim()}\n`);
				socket.end();
			});
		});

		// Start server
		server.listen(0, "localhost", () => {
			const port = server.address().port;
			console.log(`  🌐 Test server listening on port ${port}`);

			// Create client to test the server
			const client = net.connect(port, "localhost", () => {
				console.log("  📤 Client connected, sending test message...");
				client.write("Hello from automatic context test!");
			});

			client.on("data", (data) => {
				console.log("  📨 Client received response:", data.toString().trim());
			});

			client.on("end", () => {
				console.log("  🔌 Client connection ended");
				server.close(() => {
					console.log("  🛑 Server closed");

					// Final test results
					console.log("\n[TEST RESULTS]");
					console.log("  Connection handler context preserved:", contextPreservedInConnection ? "✅" : "❌");
					console.log("  Data handler context preserved:", contextPreservedInData ? "✅" : "❌");
					console.log("  API access from handler worked:", apiAccessWorked ? "✅" : "❌");

					if (contextPreservedInConnection && contextPreservedInData && apiAccessWorked) {
						console.log("\n🎉 SUCCESS: Automatic context propagation works perfectly!");
						console.log("   Consumer code requires NO changes - context just works!");
					} else {
						console.log("\n❌ FAILURE: Automatic context propagation needs more work");
						process.exit(1);
					}
				});
			});
		});
	} catch (error) {
		console.error("[TEST] ❌ Test failed with error:", error);
		console.error(error.stack);
		process.exit(1);
	}
}

// Run the test
testAutoContextPropagation();
