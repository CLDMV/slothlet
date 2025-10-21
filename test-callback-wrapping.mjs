/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /test-callback-wrapping.mjs
 *	@Date: 2025-10-21 11:57:03 -07:00 (1761073023)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-21 13:16:26 -07:00 (1761077786)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Test EventEmitter callback argument wrapping with actual connection
 */

import slothlet from "./index.mjs";
import net from "node:net";

async function testCallbackArgumentWrapping() {
	console.log("[TEST] Testing EventEmitter callback argument wrapping...");

	// Create API with context
	const api = await slothlet({
		dir: "./api_tests/api_test",
		context: { user: "test-user" }
	});

	console.log("✅ API created with context");

	// Create and manually wrap server
	const server = net.createServer();
	const { makeWrapper } = await import("./src/lib/runtime/runtime.mjs");
	const wrapper = makeWrapper(api.__ctx);
	const wrappedServer = wrapper(server);

	console.log("✅ Server manually wrapped");

	// Set up connection handler that should receive wrapped socket
	wrappedServer.on("connection", (socket) => {
		console.log("🔌 Connection received!");
		console.log("Socket type:", typeof socket);
		console.log("Socket constructor:", socket?.constructor?.name);
		console.log("Socket is wrapped:", socket !== server); // rough check

		// This should trigger EventEmitter callback argument wrapping
		socket.on("data", (_) => {
			console.log("📥 Data received in nested handler!");
		});

		socket.write("Hello from server\n");
		socket.end();
	});

	// Start server
	wrappedServer.listen(0, "localhost", () => {
		const port = wrappedServer.address().port;
		console.log(`✅ Server listening on port ${port}`);

		// Connect client to trigger the callback
		const client = net.connect(port, "localhost", () => {
			console.log("📤 Client connected");
			client.write("Test data");
		});

		client.on("data", (data) => {
			console.log("📨 Client received:", data.toString().trim());
			client.end();
		});

		client.on("end", () => {
			console.log("🔌 Client disconnected");
			wrappedServer.close();
		});

		wrappedServer.on("close", () => {
			console.log("🛑 Server closed");
			api.shutdown();
		});
	});
}

testCallbackArgumentWrapping().catch(console.error);
