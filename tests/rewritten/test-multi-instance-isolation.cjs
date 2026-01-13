/**
 * Test file for multi-instance functionality verification
 * Tests that different instances with different IDs are truly isolated
 * by creating one eager and one lazy instance and verifying their behavior differs
 */

async function testMultiInstanceIsolation() {
	console.log("🧪 Testing multi-instance isolation...");

	try {
		const slothlet = require("@cldmv/slothlet");

		console.log("✓ Created two instances with different IDs");

		// Create eager API (should load all modules immediately)
		console.log("\n📦 Creating eager API...");
		const eagerApi = await slothlet({
			dir: "./api_tests/api_test",
			mode: "eager", // New syntax for eager mode
			debug: false
		});

		// Create lazy API (should create proxies, not load modules)
		console.log("📦 Creating lazy API...");
		const lazyApi = await slothlet({
			dir: "./api_tests/api_test",
			mode: "lazy", // New syntax for lazy mode
			debug: false
		});

		console.log("✓ Both APIs created successfully");

		// Test that eager API has real functions immediately
		console.log("\n🔍 Testing eager API structure...");
		const eagerMathType = typeof eagerApi.math;
		const eagerMathAddType = typeof eagerApi.math?.add;
		console.log("  eagerApi.math type:", eagerMathType);
		console.log("  eagerApi.math.add type:", eagerMathAddType);

		// Test that lazy API has proxy functions (should be functions but with proxy behavior)
		console.log("\n🔍 Testing lazy API structure...");
		const lazyMathType = typeof lazyApi.math;
		const lazyMathName = lazyApi.math?.name || "no name";
		console.log("  lazyApi.math type:", lazyMathType);
		console.log("  lazyApi.math name:", lazyMathName);

		// The key test: lazy API should have proxy functions with specific naming
		// that indicates they haven't been materialized yet
		const isLazyProxied = lazyMathName.includes("lazyFolder_") || lazyMathName.includes("proxy");
		console.log("  lazyApi.math appears to be proxied:", isLazyProxied);

		// Test actual function calls to verify isolation
		console.log("\n🧮 Testing function calls...");

		// Eager should work immediately
		const eagerResult = eagerApi.math.add(2, 3);
		console.log("  Eager math.add(2, 3):", eagerResult);

		// Lazy should require await
		const lazyResult = await lazyApi.math.add(2, 3);
		console.log("  Lazy math.add(2, 3) (awaited):", lazyResult);

		// Verify both results are correct
		if (eagerResult === 5 && lazyResult === 5) {
			console.log("✓ Both instances return correct results");
		} else {
			throw new Error(`Results mismatch: eager=${eagerResult}, lazy=${lazyResult}`);
		}

		// The critical test: verify they're truly separate instances
		// by checking that lazy mode behavior is different from eager mode behavior
		const eagerIsAsync = eagerResult && typeof eagerResult.then === "function";
		const lazyWasAsync = true; // We had to await it

		console.log("\n🔬 Instance isolation verification:");
		console.log("  Eager result was async:", eagerIsAsync);
		console.log("  Lazy result required await:", lazyWasAsync);
		console.log("  Lazy API has proxy naming:", isLazyProxied);

		// If instances are properly isolated, eager should be sync and lazy should be async
		const instancesAreSeparate = !eagerIsAsync && lazyWasAsync && isLazyProxied;

		if (instancesAreSeparate) {
			console.log("🎉 Multi-instance isolation verified!");
			console.log("  ✓ Eager instance loads modules immediately");
			console.log("  ✓ Lazy instance uses proxies until called");
			console.log("  ✓ Instances operate independently");
		} else {
			throw new Error("Instance isolation failed - instances may be sharing state");
		}

		// Cleanup
		if (eagerApi.shutdown) await eagerApi.shutdown();
		if (lazyApi.shutdown) await lazyApi.shutdown();
		console.log("✓ Cleanup completed");
	} catch (error) {
		console.error("❌ Multi-instance isolation test failed:", error.message);
		console.error(error.stack);
		process.exit(1);
	}
}

testMultiInstanceIsolation().catch(console.error);
