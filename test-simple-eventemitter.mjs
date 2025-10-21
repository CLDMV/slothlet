/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /test-simple-eventemitter.mjs
 *	@Date: 2025-10-21 11:45:57 -07:00 (1761072357)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-21 13:16:37 -07:00 (1761077797)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Simple test to verify EventEmitter method wrapping works
 */

import slothlet from "./index.mjs";
import net from "node:net";

async function testSimpleEventEmitter() {
	console.log("[TEST] Testing basic EventEmitter method wrapping...");

	// Create API with context
	const api = await slothlet({
		dir: "./api_tests/api_test",
		context: { user: "test-user" }
	});

	console.log("✅ API created with context");

	// Create a server inside a wrapped function call
	const server = net.createServer();
	console.log("✅ Server created");

	// Manually wrap the server using the wrapper
	console.log("Context object keys:", Object.keys(api.__ctx));
	console.log("Context object:", api.__ctx);

	// Try to get the wrapper function - it should be available in makeWrapper export
	const { makeWrapper } = await import("./src/lib/runtime/runtime.mjs");
	const wrapper = makeWrapper(api.__ctx);
	const wrappedServer = wrapper(server);

	console.log("✅ Server manually wrapped");
	console.log("Server constructor:", server.constructor.name);
	console.log("Wrapped server constructor:", wrappedServer.constructor.name);
	console.log("Server has on:", typeof server.on === "function");
	console.log("Wrapped server has on:", typeof wrappedServer.on === "function");

	// Test EventEmitter method access
	console.log("\n[TEST] Testing EventEmitter method access...");

	// This should trigger EventEmitter detection
	wrappedServer.on("connection", (socket) => {
		console.log("🔌 Connection received!");
		console.log("Context in connection handler:", api.__ctx.context?.user);

		socket.on("data", (_) => {
			console.log("📥 Data received!");
			console.log("Context in data handler:", api.__ctx.context?.user);
		});
	});

	console.log("✅ Event handlers attached");

	await api.shutdown();
}

testSimpleEventEmitter().catch(console.error);
