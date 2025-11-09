/**
 * Test script to see if server.listen() preserves context without auto-wrap helper
 */
import slothlet from "./index.mjs";

// Test with AsyncLocalStorage runtime
const api = await slothlet({
	dir: "./api_tests/api_test",
	runtime: "asynclocalstorage"
});

console.log("=== Testing server.listen() context preservation ===");

// Import net module directly (no auto-wrap)
import net from "node:net";

console.log("\n1. Creating server with direct net import...");
const server = net.createServer((socket) => {
	console.log("Client connected");
	socket.end("Hello from server");
});

console.log("2. Calling server.listen() - checking if context is preserved...");

// This should show if context is preserved during server.listen()
try {
	// Get current context before listen
	const { self, context, reference } = await import("@cldmv/slothlet/runtime/async");
	console.log("Context before listen:", {
		hasSelf: !!self,
		hasContext: !!context,
		hasReference: !!reference,
		selfKeys: self ? Object.keys(self) : "none"
	});

	server.listen(0, () => {
		console.log("Server listening callback executed");

		// Check context inside listen callback
		import("@cldmv/slothlet/runtime/async").then(({ self: callbackSelf, context: callbackContext, reference: callbackReference }) => {
			console.log("Context inside listen callback:", {
				hasSelf: !!callbackSelf,
				hasContext: !!callbackContext,
				hasReference: !!callbackReference,
				selfKeys: callbackSelf ? Object.keys(callbackSelf) : "none"
			});

			server.close();
		});
	});
} catch (err) {
	console.error("Error testing server.listen():", err);
}
