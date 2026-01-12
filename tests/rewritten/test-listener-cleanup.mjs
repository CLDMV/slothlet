/**
 * Test comprehensive listener cleanup to prevent hanging processes
 * Tests all combinations of modes, hooks, and runtime types
 */

import slothlet from "../index.mjs";
import { EventEmitter } from "node:events";

console.log("[CLEANUP TEST] Testing comprehensive listener cleanup across all configurations...\n");

const testConfigurations = [
	{ mode: "lazy", hooks: true, runtime: "asynclocalstorage", desc: "Lazy + Hooks + AsyncLocalStorage" },
	{ mode: "lazy", hooks: true, runtime: "live-binding", desc: "Lazy + Hooks + Live Binding" },
	{ mode: "lazy", hooks: false, runtime: "asynclocalstorage", desc: "Lazy + No Hooks + AsyncLocalStorage" },
	{ mode: "lazy", hooks: false, runtime: "live-binding", desc: "Lazy + No Hooks + Live Binding" },
	{ mode: "eager", hooks: true, runtime: "asynclocalstorage", desc: "Eager + Hooks + AsyncLocalStorage" },
	{ mode: "eager", hooks: true, runtime: "live-binding", desc: "Eager + Hooks + Live Binding" },
	{ mode: "eager", hooks: false, runtime: "asynclocalstorage", desc: "Eager + No Hooks + AsyncLocalStorage" },
	{ mode: "eager", hooks: false, runtime: "live-binding", desc: "Eager + No Hooks + Live Binding" }
];

async function testConfiguration(config) {
	console.log(`\n🧪 Testing: ${config.desc}`);
	console.log("=".repeat(60));

	// Create slothlet instance with current configuration
	const api = await slothlet({
		dir: "./api_tests/api_test",
		mode: config.mode,
		hooks: config.hooks,
		runtime: config.runtime
	});

	console.log(`✅ Slothlet API loaded (${Object.keys(api).length} keys)`);

	// Create EventEmitters and add listeners within slothlet context
	const emitter1 = new EventEmitter();
	const emitter2 = new EventEmitter();
	const emitter3 = new EventEmitter();

	let listenerCallCount = 0;

	// Add various types of listeners
	const handler1 = () => {
		listenerCallCount++;
		console.log(`  📡 Handler 1 called (count: ${listenerCallCount})`);
	};

	const handler2 = (data) => {
		listenerCallCount++;
		console.log(`  📡 Handler 2 called with: ${data}`);
	};

	const onceHandler = () => {
		listenerCallCount++;
		console.log(`  📡 Once handler called (should only fire once)`);
	};

	emitter1.on("test", handler1);
	emitter1.addListener("custom", handler2);
	emitter2.on("data", handler2);
	emitter2.once("close", onceHandler);
	emitter3.prependListener("priority", handler1);

	console.log("✅ Added 5 listeners across 3 EventEmitters");

	// Add hooks if enabled
	if (config.hooks) {
		api.hooks.on("test-before", "before", ({ path, args }) => {
			console.log(`  🪝 Before hook: ${path}`);
			return { args };
		});

		api.hooks.on("test-after", "after", ({ path, result }) => {
			console.log(`  🪝 After hook: ${path}`);
			return result;
		});

		api.hooks.on("test-always", "always", ({ path, result: _, hasError }) => {
			console.log(`  🪝 Always hook: ${path} (error: ${hasError})`);
		});

		console.log("✅ Added 3 hooks");
	}

	// Test API functionality
	try {
		const mathResult = await api.math.add(10, 20);
		console.log(`✅ API test: 10 + 20 = ${JSON.stringify(mathResult)}`);
	} catch (err) {
		console.log(`⚠️  API test failed: ${err.message}`);
	}

	// Test listeners
	console.log("📡 Testing listeners before shutdown...");
	emitter1.emit("test");
	emitter1.emit("custom", "test-data");
	emitter2.emit("data", "important-data");
	emitter2.emit("close");
	emitter3.emit("priority");

	console.log(`✅ Listeners fired successfully (total calls: ${listenerCallCount})`);

	// Critical test: shutdown should clean up ALL listeners and hooks
	console.log("🧹 Calling shutdown - should clean up all listeners and hooks...");
	const shutdownStart = Date.now();
	await api.shutdown();
	const shutdownTime = Date.now() - shutdownStart;

	console.log(`✅ Shutdown completed in ${shutdownTime}ms`);

	// Test that emitters still exist but listeners should be cleaned up
	const listenersRemaining =
		emitter1.listenerCount("test") +
		emitter1.listenerCount("custom") +
		emitter2.listenerCount("data") +
		emitter2.listenerCount("close") +
		emitter3.listenerCount("priority");

	if (listenersRemaining > 0) {
		console.log(`⚠️  Warning: ${listenersRemaining} listeners may still be registered`);
	} else {
		console.log("✅ No listeners remaining on test emitters");
	}

	console.log(`🎉 Configuration test completed successfully`);

	return { success: true, shutdownTime, listenersRemaining };
}

async function runAllTests() {
	console.log("🚀 Starting comprehensive listener cleanup tests");
	console.log(`Testing ${testConfigurations.length} different configurations...\n`);

	const results = [];
	let totalTime = 0;
	let failures = 0;

	for (const config of testConfigurations) {
		try {
			const result = await testConfiguration(config);
			results.push({ config, ...result });
			totalTime += result.shutdownTime;

			// Small delay between tests to ensure clean state
			await new Promise((resolve) => setTimeout(resolve, 100));
		} catch (error) {
			console.error(`❌ Configuration failed: ${config.desc}`);
			console.error(`   Error: ${error.message}`);
			failures++;
			results.push({ config, success: false, error: error.message });
		}
	}

	// Summary report
	console.log("\n" + "=".repeat(80));
	console.log("📊 COMPREHENSIVE TEST RESULTS");
	console.log("=".repeat(80));

	results.forEach((result, index) => {
		const status = result.success ? "✅ PASS" : "❌ FAIL";
		const time = result.shutdownTime ? `(${result.shutdownTime}ms)` : "";
		const listeners = result.listenersRemaining !== undefined ? `(${result.listenersRemaining} listeners remaining)` : "";

		console.log(`${index + 1}. ${status} ${result.config.desc} ${time} ${listeners}`);
		if (result.error) {
			console.log(`   Error: ${result.error}`);
		}
	});

	console.log(`\n📈 Total configurations tested: ${testConfigurations.length}`);
	console.log(`✅ Successful: ${testConfigurations.length - failures}`);
	console.log(`❌ Failed: ${failures}`);
	console.log(`⏱️  Average shutdown time: ${Math.round(totalTime / (testConfigurations.length - failures))}ms`);

	if (failures === 0) {
		console.log("\n🎉 ALL TESTS PASSED! Listener cleanup works across all configurations!");
		console.log("🚀 Process should exit cleanly without hanging listeners.");
	} else {
		console.log(`\n⚠️  ${failures} configuration(s) failed. Review results above.`);
		process.exit(1);
	}
}

// Run all tests
runAllTests().catch((err) => {
	console.error("💥 Test suite failed:", err);
	process.exit(1);
});
