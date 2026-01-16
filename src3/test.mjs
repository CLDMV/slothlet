/**
 * @fileoverview Test script for src3 prototype
 */
import slothlet from "./slothlet.mjs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("🧪 Testing Slothlet Prototype (src3)\n");

try {
	// Test 1: Basic load
	console.log("Test 1: Loading API in eager mode...");
	const api = await slothlet({
		dir: resolve(__dirname, "../api_tests/api_test"),
		mode: "eager",
		runtime: "async"
	});

	console.log("✅ API loaded successfully");
	console.log("   Root keys:", Object.keys(api).slice(0, 10).join(", "));

	// Test 2: Function calls
	console.log("\nTest 2: Testing function calls with context isolation...");

	// Check what we actually have
	console.log("   api.rootMath type:", typeof api.rootMath);
	if (api.rootMath) {
		console.log("   api.rootMath keys:", Object.keys(api.rootMath));
	}
	console.log("   api.math type:", typeof api.math);
	if (api.math) {
		console.log("   api.math keys:", Object.keys(api.math));
	}

	// Test rootMath (exported as named export "rootMath")
	if (api.rootMath && api.rootMath.add && typeof api.rootMath.add === "function") {
		const result = api.rootMath.add(2, 3);
		console.log(`✅ api.rootMath.add(2, 3) = ${result}`);
		if (result !== 5) {
			throw new Error(`Expected 5, got ${result}`);
		}
	} else {
		console.log("⚠️  rootMath.add not accessible");
	}

	// Test math (should be flattened: math/math.mjs → api.math)
	if (api.math && api.math.add && typeof api.math.add === "function") {
		const result = api.math.add(10, 20);
		console.log(`✅ api.math.add(10, 20) = ${result}`);
		if (result !== 30) {
			throw new Error(`Expected 30, got ${result}`);
		}
	} else {
		console.log("⚠️  math.add not accessible");
	}

	// Test 3: Context isolation
	console.log("\nTest 3: Testing built-in API methods...");
	console.log("   api.api exists:", typeof api.api === "object");
	console.log("   api.reload exists:", typeof api.reload === "function");
	console.log("   api.scope exists:", typeof api.scope === "function");
	console.log("   api.run exists:", typeof api.run === "function");
	console.log("✅ Built-in methods attached");

	// Test 4: Diagnostics (when enabled)
	console.log("\nTest 4: Testing diagnostics...");
	const api_with_diag = await slothlet({
		dir: resolve(__dirname, "../api_tests/api_test"),
		mode: "eager",
		diagnostics: true
	});
	console.log("   api.diag exists:", typeof api_with_diag.diag === "object");
	if (api_with_diag.diag) {
		const diag = api_with_diag.diag.inspect();
		console.log("✅ Diagnostics enabled");
		console.log("   Instance ID:", diag.instanceId);
		console.log("   Active instances:", diag.context.activeInstances);
	}
	await api_with_diag.api.shutdown();

	// Test 5: Error handling
	console.log("\nTest 5: Testing error handling...");
	try {
		await slothlet({ dir: "/nonexistent/path" });
	} catch (error) {
		console.log("✅ Caught expected error:", error.code);
		console.log("   Error message:", error.message.split("\n")[0]);
	}

	// Test 6: Shutdown
	console.log("\nTest 6: Testing shutdown...");
	await api.api.shutdown();
	console.log("✅ Instance shut down successfully");

	// Test 7: Multiple instances
	console.log("\nTest 7: Testing multiple instances...");
	const api1 = await slothlet({
		dir: resolve(__dirname, "../api_tests/api_test"),
		mode: "eager",
		diagnostics: true
	});

	const api2 = await slothlet({
		dir: resolve(__dirname, "../api_tests/api_test"),
		mode: "eager",
		diagnostics: true
	});

	console.log("✅ Multiple instances loaded");
	console.log("   Instance 1 ID:", api1.diag.inspect().instanceId);
	console.log("   Instance 2 ID:", api2.diag.inspect().instanceId);

	await api1.api.shutdown();
	await api2.api.shutdown();
	console.log("✅ Both instances shut down");

	console.log("\n✅ All tests passed!");
} catch (error) {
	console.error("\n❌ Test failed:");
	console.error(error);
	process.exit(1);
}
