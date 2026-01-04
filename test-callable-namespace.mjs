// Test callable namespace with mixed exports
import slothlet from "./index.mjs";

async function testCallableNamespace() {
	const api = await slothlet({ dir: "./api_tests/api_test" });

	console.log("=== Testing Callable Namespace ===");

	// Test 1: Single function module (funcmod)
	console.log("\n1. Single function module (funcmod):");
	console.log("   typeof api.funcmod:", typeof api.funcmod);
	try {
		const result1 = api.funcmod("test");
		console.log("   ✅ api.funcmod('test'):", result1);
	} catch (e) {
		console.log("   ❌ api.funcmod('test') failed:", e.message);
	}

	// Test 2: Mixed exports in single file (mixed)
	console.log("\n2. Mixed exports in single file (mixed):");
	console.log("   typeof api.mixed:", typeof api.mixed);
	console.log("   api.mixed properties:", Object.keys(api.mixed || {}));

	try {
		const result2 = api.mixed("hello");
		console.log("   ✅ api.mixed('hello') as function:", result2);
	} catch (e) {
		console.log("   ❌ api.mixed('hello') as function failed:", e.message);
	}

	try {
		const result3 = api.mixed.mixedNamed("world");
		console.log("   ✅ api.mixed.mixedNamed('world'):", result3);
	} catch (e) {
		console.log("   ❌ api.mixed.mixedNamed('world') failed:", e.message);
	}

	try {
		const result4 = api.mixed.mixedAnother(5);
		console.log("   ✅ api.mixed.mixedAnother(5):", result4);
	} catch (e) {
		console.log("   ❌ api.mixed.mixedAnother(5) failed:", e.message);
	}

	// Test 3: Multiple files with default function (logger)
	console.log("\n3. Multiple files with default function (logger):");
	console.log("   typeof api.logger:", typeof api.logger);
	console.log("   api.logger properties:", Object.keys(api.logger || {}));

	try {
		const result5 = api.logger("test message");
		console.log("   ✅ api.logger('test message') as function:", result5);
	} catch (e) {
		console.log("   ❌ api.logger('test message') as function failed:", e.message);
	}

	try {
		const result6 = api.logger.debug("debug message");
		console.log("   ✅ api.logger.debug('debug message'):", result6);
	} catch (e) {
		console.log("   ❌ api.logger.debug('debug message') failed:", e.message);
	}

	try {
		const result7 = api.logger.error("error message");
		console.log("   ✅ api.logger.error('error message'):", result7);
	} catch (e) {
		console.log("   ❌ api.logger.error('error message') failed:", e.message);
	}
}

testCallableNamespace().catch(console.error);
