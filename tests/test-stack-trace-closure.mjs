/**
 * @fileoverview Test to verify stack trace behavior with closures
 * @description Tests whether closures show definition or execution location in stack traces
 */

// import { pathToFileURL } from "url";

function getStackTrace() {
	const originalPrepareStackTrace = Error.prepareStackTrace;
	Error.prepareStackTrace = (_, stack) => stack;
	const err = new Error();
	Error.captureStackTrace(err, getStackTrace);
	const stack = err.stack;
	Error.prepareStackTrace = originalPrepareStackTrace;
	return stack;
}

function executeClosureFromHelper(closure) {
	console.log("\n🔍 Stack trace from INSIDE helper function:");
	closure();
}

async function executeAsyncClosureFromHelper(closure) {
	console.log("\n🔍 Stack trace from INSIDE async helper function:");
	await closure();
}

console.log("📋 Testing stack trace behavior with closures\n");

// Test 1: Synchronous closure
console.log("Test 1: Synchronous closure defined in test file, executed in helper");
executeClosureFromHelper(() => {
	const stack = getStackTrace();
	console.log("   Stack frames:");
	for (let i = 0; i < Math.min(5, stack.length); i++) {
		const frame = stack[i];
		const fileName = frame.getFileName?.();
		const lineNumber = frame.getLineNumber?.();
		console.log(`   [${i}] ${fileName}:${lineNumber}`);
	}
});

// Test 2: Async closure
console.log("\nTest 2: Async closure defined in test file, executed in helper");
await executeAsyncClosureFromHelper(async () => {
	const stack = getStackTrace();
	console.log("   Stack frames:");
	for (let i = 0; i < Math.min(5, stack.length); i++) {
		const frame = stack[i];
		const fileName = frame.getFileName?.();
		const lineNumber = frame.getLineNumber?.();
		console.log(`   [${i}] ${fileName}:${lineNumber}`);
	}
});

// Test 3: Import and execute through another file's helper
console.log("\nTest 3: Closure executed through test-helper.mjs");
const { runTestWithApi } = await import("./test-helper.mjs");
const slothlet = (await import("../index.mjs")).default;
const api = await slothlet({ dir: "./api_tests/api_test", lazy: false });

await runTestWithApi(api, async (_) => {
	const stack = getStackTrace();
	console.log("   Stack frames:");
	for (let i = 0; i < Math.min(10, stack.length); i++) {
		const frame = stack[i];
		const fileName = frame.getFileName?.();
		const lineNumber = frame.getLineNumber?.();
		const functionName = frame.getFunctionName?.();
		console.log(`   [${i}] ${functionName || "<anonymous>"} - ${fileName}:${lineNumber}`);
	}
});

await api.shutdown();

console.log("\n✅ Stack trace test complete");
