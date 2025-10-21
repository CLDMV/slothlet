/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/test-eventemitter-wrapping.mjs
 *	@Date: 2025-10-21 13:06:00 -07:00 (1761077160)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-21 13:16:14 -07:00 (1761077774)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test EventEmitter wrapping behavior
 * @module @cldmv/slothlet/tests/test-eventemitter-wrapping
 */

import slothlet from "../index.mjs";
import { self, context, reference } from "../src/lib/runtime/runtime.mjs";

const TEST_DIR = "./api_tests/api_test";

async function testEventEmitterWrapping() {
	console.log("🧪 Testing EventEmitter wrapping behavior...\n");

	try {
		// Load the API with context
		const api = await slothlet({
			dir: TEST_DIR,
			context: { user: "test-user" }
		});

		console.log("✅ API loaded successfully");
		console.log("📊 Initial context check:");
		console.log("  - self keys:", Object.keys(self || {}).length);
		console.log("  - context user:", context?.user);
		console.log("  - reference keys:", Object.keys(reference || {}).length);

		// Test 1: Direct server creation via API call
		console.log("\n🔍 Test 1: Direct server creation via tcp.createTestServer()");

		if (api.tcp && typeof api.tcp.createTestServer === "function") {
			console.log("  📞 Calling api.tcp.createTestServer()...");
			const result = await api.tcp.createTestServer(0);

			console.log("  📊 Result object analysis:");
			console.log("    - Type:", typeof result);
			console.log("    - Constructor:", result?.constructor?.name);
			console.log("    - Has server property:", result?.server !== undefined);

			const server = result?.server;
			if (server) {
				console.log("  📊 Server property analysis:");
				console.log("    - Type:", typeof server);
				console.log("    - Constructor:", server?.constructor?.name);
				console.log("    - Has on method:", typeof server?.on === "function");
				console.log("    - Has emit method:", typeof server?.emit === "function");
				console.log("    - toString contains Proxy:", server.toString().includes("Proxy"));

				// Test the on method directly
				console.log("  🔍 Testing server.on method:");
				console.log("    - server.on type:", typeof server.on);
				console.log("    - server.on name:", server.on?.name);
				console.log("    - server.on toString:", server.on?.toString()?.substring(0, 100));
			} else {
				console.log("  ❌ No server property found in result");
			}

			// Close the server to clean up
			if (typeof result?.close === "function") {
				await result.close();
			}
		} else {
			console.log("  ❌ tcp.createTestServer not available");
		}

		// Test 2: Check what runtime_isClassInstance would return for various objects
		console.log("\n🔍 Test 2: Object classification test");

		const testObjects = [
			{ name: "Plain object", obj: {} },
			{ name: "Array", obj: [] },
			{ name: "Function", obj: function () {} },
			{ name: "Date", obj: new Date() },
			{ name: "Promise", obj: Promise.resolve() }
		];

		// Import net to test Node.js objects
		const net = await import("net");
		const testServer = net.createServer();
		testObjects.push({ name: "net.Server", obj: testServer });

		testObjects.forEach(({ name, obj }) => {
			const isObject = typeof obj === "object";
			const hasConstructor = obj?.constructor && typeof obj.constructor === "function";
			const constructorName = obj?.constructor?.name;
			const wouldBeWrapped = isObject && hasConstructor && constructorName !== "Object" && constructorName !== "Array";
			const isEventEmitterLike = typeof obj?.on === "function" && typeof obj?.emit === "function";

			console.log(`    ${name}:`, {
				type: typeof obj,
				constructor: constructorName,
				wouldBeWrapped,
				isEventEmitterLike
			});
		});

		testServer.close();
	} catch (error) {
		console.error("❌ Test failed:", error);
		process.exit(1);
	}
}

testEventEmitterWrapping().catch(console.error);
