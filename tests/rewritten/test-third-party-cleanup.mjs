/**
 * Test that simulates third-party library listeners (like pg-pool)
 * getting wrapped by slothlet's global EventEmitter patching
 */

import slothlet from "../index.mjs";
import { EventEmitter } from "node:events";

console.log("[THIRD-PARTY TEST] Testing cleanup of third-party library listeners...\n");

// Simulate pg-pool-like behavior - library creates EventEmitters and listeners
function createPgPoolSimulation() {
	const clients = [];

	for (let i = 0; i < 5; i++) {
		const client = new EventEmitter();

		// Simulate pg-pool error handling patterns
		const onError = (err) => console.log(`Client ${i} error: ${err.message}`);
		client.once("error", onError);

		// Simulate response callback patterns
		const responseCallback = (_) => {
			console.log(`Client ${i} response callback`);
		};
		client.on("response", responseCallback);

		// Simulate connection patterns
		client.on("connect", () => console.log(`Client ${i} connected`));
		client.on("end", () => console.log(`Client ${i} ended`));

		clients.push(client);
	}

	return clients;
}

async function testThirdPartyCleanup() {
	// First create some "third-party" EventEmitters BEFORE slothlet loads
	console.log("📦 Creating pre-slothlet EventEmitters (should NOT be tracked)...");
	const preSlothletEmitters = createPgPoolSimulation();

	let preListenerCount = 0;
	preSlothletEmitters.forEach((emitter) => {
		preListenerCount += emitter.listenerCount("error");
		preListenerCount += emitter.listenerCount("response");
		preListenerCount += emitter.listenerCount("connect");
		preListenerCount += emitter.listenerCount("end");
	});
	console.log(`✅ Pre-slothlet: ${preListenerCount} listeners created`);

	// Now load slothlet - this will patch EventEmitter.prototype globally
	console.log("\\n🚀 Loading slothlet (this patches EventEmitter.prototype globally)...");
	const api = await slothlet({
		dir: "./api_tests/api_test",
		mode: "lazy",
		hooks: true
	});

	console.log("✅ Slothlet loaded - EventEmitter.prototype is now patched globally");

	// Now create more "third-party" EventEmitters AFTER slothlet loads
	console.log("\\n📦 Creating post-slothlet EventEmitters (WILL be tracked by slothlet)...");
	const postSlothletEmitters = createPgPoolSimulation();

	let postListenerCount = 0;
	postSlothletEmitters.forEach((emitter) => {
		postListenerCount += emitter.listenerCount("error");
		postListenerCount += emitter.listenerCount("response");
		postListenerCount += emitter.listenerCount("connect");
		postListenerCount += emitter.listenerCount("end");
	});
	console.log(`✅ Post-slothlet: ${postListenerCount} listeners created`);

	// Test that listeners work
	console.log("\\n📡 Testing that listeners work...");
	postSlothletEmitters[0].emit("connect");
	postSlothletEmitters[1].emit("response", null, "data", () => {});

	// Create some additional EventEmitters during API usage
	console.log("\\n🔧 Creating EventEmitters during API usage...");
	const duringApiEmitters = [];
	for (let i = 0; i < 3; i++) {
		const emitter = new EventEmitter();
		emitter.on("api-event", () => console.log(`API event ${i}`));
		duringApiEmitters.push(emitter);
	}

	// Test API to make sure slothlet context is active
	try {
		const result = await api.math.add(100, 200);
		console.log(`✅ API test: 100 + 200 = ${JSON.stringify(result)}`);
	} catch (err) {
		console.log(`⚠️ API test failed: ${err.message}`);
	}

	// Check total listeners before shutdown
	const totalPreShutdown =
		preSlothletEmitters.reduce(
			(sum, e) => sum + e.listenerCount("error") + e.listenerCount("response") + e.listenerCount("connect") + e.listenerCount("end"),
			0
		) +
		postSlothletEmitters.reduce(
			(sum, e) => sum + e.listenerCount("error") + e.listenerCount("response") + e.listenerCount("connect") + e.listenerCount("end"),
			0
		) +
		duringApiEmitters.reduce((sum, e) => sum + e.listenerCount("api-event"), 0);

	console.log(`\\n📊 Total listeners before shutdown: ${totalPreShutdown}`);

	// CRITICAL TEST: shutdown should clean up all listeners that went through slothlet's patching
	console.log("\\n🧹 Calling shutdown - should clean up ALL listeners created after slothlet loaded...");
	const shutdownStart = Date.now();
	await api.shutdown();
	const shutdownTime = Date.now() - shutdownStart;

	console.log(`✅ Shutdown completed in ${shutdownTime}ms`);

	// Check what listeners remain
	const preRemaining = preSlothletEmitters.reduce(
		(sum, e) => sum + e.listenerCount("error") + e.listenerCount("response") + e.listenerCount("connect") + e.listenerCount("end"),
		0
	);
	const postRemaining = postSlothletEmitters.reduce(
		(sum, e) => sum + e.listenerCount("error") + e.listenerCount("response") + e.listenerCount("connect") + e.listenerCount("end"),
		0
	);
	const duringRemaining = duringApiEmitters.reduce((sum, e) => sum + e.listenerCount("api-event"), 0);
	const totalRemaining = preRemaining + postRemaining + duringRemaining;

	console.log(`\\n📊 Listeners remaining after shutdown:`);
	console.log(`  - Pre-slothlet:  ${preRemaining}/${preListenerCount} (should be ${preListenerCount})`);
	console.log(`  - Post-slothlet: ${postRemaining}/${postListenerCount} (should be 0)`);
	console.log(`  - During API:    ${duringRemaining}/3 (should be 0)`);
	console.log(`  - TOTAL:         ${totalRemaining}/${totalPreShutdown}`);

	const cleanedUp = totalPreShutdown - totalRemaining;
	console.log(`\\n🎯 Cleaned up ${cleanedUp} listeners`);

	if (postRemaining === 0 && duringRemaining === 0) {
		console.log("🎉 SUCCESS: All post-slothlet listeners cleaned up!");
		console.log("🚀 This should prevent hanging processes from third-party libraries!");
	} else {
		console.log(`⚠️  WARNING: ${postRemaining + duringRemaining} listeners still hanging!`);
		console.log("🐛 This could cause hanging processes in real applications.");
	}

	if (preRemaining === preListenerCount) {
		console.log("✅ Pre-slothlet listeners preserved (correct behavior)");
	} else {
		console.log(`⚠️  Pre-slothlet listeners affected: ${preListenerCount - preRemaining} removed`);
	}
}

// Run the test
testThirdPartyCleanup().catch((err) => {
	console.error("💥 Test failed:", err);
	process.exit(1);
});
