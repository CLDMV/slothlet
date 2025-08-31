/**
 * Comprehensive test for mixed CJS/ESM functionality
 * Tests CJS modules, live bindings, and interoperability
 */

const slothlet = require("@cldmv/slothlet");

async function testCjsOnly() {
	console.log("🧪 Testing CJS-only API...\n");

	try {
		// Create two different instances
		console.log("🔧 Creating CJS instance 1 with alice context...");
		const api1 = await slothlet({
			dir: "../api_tests/api_test_cjs",
			// mode: "vm",
			// instanceId: "cjs1",
			contextData: { user: "alice" }
		});

		console.log("🔧 Creating CJS instance 2 with bob context...");
		const api2 = await slothlet({
			dir: "../api_tests/api_test_cjs",
			// mode: "vm",
			// instanceId: "cjs2",
			contextData: { user: "bob" }
		});
		console.log("\n✅ Both CJS APIs created successfully");
		console.log(
			"API 1 methods:",
			Object.keys(api1).filter((k) => k !== "describe" && k !== "shutdown")
		);
		console.log(
			"API 2 methods:",
			Object.keys(api2).filter((k) => k !== "describe" && k !== "shutdown")
		);

		// Test basic CJS functions
		console.log("\n🔍 Testing basic CJS functions:");
		console.log("Instance 1 rootMath.add(5, 3):", api1.rootMath.add(5, 3));
		console.log("Instance 2 rootMath.add(10, 7):", api2.rootMath.add(10, 7));

		console.log("Instance 1 math.multiply(4, 3):", api1.math.multiply(4, 3));
		console.log("Instance 2 math.multiply(6, 2):", api2.math.multiply(6, 2));

		// Test live binding with self-reference
		console.log("\n🔗 Testing CJS live bindings with self-reference:");
		const result1 = await api1.advanced.selfObject.addViaSelf(10, 20);
		console.log("Instance 1 self-reference result:", result1);

		const result2 = await api2.advanced.selfObject.addViaSelf(15, 25);
		console.log("Instance 2 self-reference result:", result2);

		await api1.shutdown();
		await api2.shutdown();

		console.log("\n✅ CJS-only test completed successfully!\n");
	} catch (error) {
		console.error("❌ CJS-only test failed:", error.message);
		console.error(error.stack);
		throw error; // Re-throw to be caught by runAllTests
	}
}

async function testMixed() {
	console.log("🧪 Testing Mixed ESM/CJS API...\n");

	try {
		// Create instances with mixed API
		console.log("🔧 Creating mixed instance 1 with charlie context...");
		const api1 = await slothlet({
			dir: "../api_tests/api_test_mixed",
			// mode: "vm",
			// instanceId: "mixed1",
			contextData: { user: "charlie" }
		});

		console.log("🔧 Creating mixed instance 2 with diana context...");
		const api2 = await slothlet({
			dir: "../api_tests/api_test_mixed",
			// mode: "vm",
			// instanceId: "mixed2",
			contextData: { user: "diana" }
		});
		console.log("\n✅ Both mixed APIs created successfully");
		console.log(
			"API 1 methods:",
			Object.keys(api1).filter((k) => k !== "describe" && k !== "shutdown")
		);
		console.log(
			"API 2 methods:",
			Object.keys(api2).filter((k) => k !== "describe" && k !== "shutdown")
		);

		// Test ESM modules
		console.log("\n🔍 Testing ESM modules in mixed API:");
		console.log("Instance 1 ESM add(3, 4):");
		const esmResult1 = api1.mathEsm.add(3, 4);
		console.log("Result:", esmResult1);

		console.log("\nInstance 2 ESM subtract(10, 3):");
		const esmResult2 = api2.mathEsm.subtract(10, 3);
		console.log("Result:", esmResult2);

		// Test CJS modules with live bindings
		console.log("\n🔍 Testing CJS modules with live bindings:");
		console.log("Instance 1 CJS multiply(5, 6):");
		const cjsResult1 = await api1.mathCjs.multiply(5, 6);
		console.log("Result:", cjsResult1);

		console.log("\nInstance 2 CJS divide(20, 4):");
		const cjsResult2 = await api2.mathCjs.divide(20, 4);
		console.log("Result:", cjsResult2);

		// Test interoperability
		console.log("\n🔗 Testing ESM/CJS interoperability:");
		console.log("Instance 1 ESM -> CJS cross-call:");
		const interopResult1 = await api1.interop.interopEsm.testCrossCall(7, 8);
		console.log("Final result:", interopResult1);

		console.log("\nInstance 2 CJS -> ESM cross-call:");
		const interopResult2 = await api2.interop.interopCjs.testCrossCall(9, 11);
		console.log("Final result:", interopResult2);

		await api1.shutdown();
		await api2.shutdown();

		console.log("\n✅ Mixed ESM/CJS test completed successfully!\n");
	} catch (error) {
		console.error("❌ Mixed test failed:", error.message);
		console.error(error.stack);
		throw error; // Re-throw to be caught by runAllTests
	}
}

async function testContextIsolation() {
	console.log("🧪 Testing Context Isolation Between Instances...\n");

	try {
		const api1 = await slothlet({
			dir: "../api_tests/api_test_cjs",
			// mode: "vm",
			// instanceId: "iso1",
			context: { user: "isolation_test_1", environment: "test1", secretKey: "secret123" }
		});

		const api2 = await slothlet({
			dir: "../api_tests/api_test_cjs",
			// mode: "vm",
			// instanceId: "iso2",
			context: { user: "isolation_test_2", environment: "test2", secretKey: "secret456" }
		});

		console.log("🔍 Testing that instances have isolated contexts:");

		// Get contexts from both instances using live bindings
		console.log("Getting context from instance 1 via CJS live bindings...");
		const result1 = await api1.advanced.selfObject.addViaSelf(1, 1);

		console.log("Getting context from instance 2 via CJS live bindings...");
		const result2 = await api2.advanced.selfObject.addViaSelf(2, 2);

		await api1.shutdown();
		await api2.shutdown();

		console.log("\n✅ Context isolation test completed successfully!\n");
	} catch (error) {
		console.error("❌ Context isolation test failed:", error.message);
		console.error(error.stack);
		throw error; // Re-throw to be caught by runAllTests
	}
}

async function runAllTests() {
	console.log("🚀 Starting Comprehensive CJS Live Bindings Test Suite\n");
	console.log("============================================================");

	let hasErrors = false;

	try {
		await testCjsOnly();
	} catch (error) {
		console.error("❌ testCjsOnly failed:", error.message);
		hasErrors = true;
	}

	try {
		await testMixed();
	} catch (error) {
		console.error("❌ testMixed failed:", error.message);
		hasErrors = true;
	}

	try {
		await testContextIsolation();
	} catch (error) {
		console.error("❌ testContextIsolation failed:", error.message);
		hasErrors = true;
	}

	if (hasErrors) {
		console.log("\n❌ Some tests failed!");
		process.exit(1);
	}

	console.log("🎉 All tests completed!");
}

runAllTests().catch((error) => {
	console.error("❌ Test runner failed:", error.message);
	process.exit(1);
});
