import slothlet from "./index.mjs";

const _api = await slothlet({ dir: "./api_tests/api_test", runtime: "live" });

// Call a function to put runtime info in stack
const result = await _api.runtimeTest.verifyRuntime();
console.log("Runtime verification from API call:", result.runtimeType);

// Debug what runtime dispatcher sees
console.log("=== DISPATCHER DEBUG AFTER API CALL ===");
const stack = new Error().stack;
console.log("Stack contains livebindings:", stack.includes("slothlet_runtime=livebindings"));
console.log("Stack contains live:", stack.includes("slothlet_runtime=live"));
console.log("Stack preview:", stack.substring(0, 500) + "...");
console.log("========================");

// Import both runtimes to compare
const { instanceId: dispatcherInstanceId } = await import("@cldmv/slothlet/runtime");
const { instanceId: directInstanceId } = await import("@cldmv/slothlet/runtime/live");

console.log("Dispatcher instanceId type:", typeof dispatcherInstanceId);
console.log("Dispatcher instanceId String():", String(dispatcherInstanceId));
console.log("Direct instanceId type:", typeof directInstanceId);
console.log("Direct instanceId String():", String(directInstanceId));

// Test the detection logic from runtime-test.mjs
let instanceIdValue = String(dispatcherInstanceId);
let hasInstanceId = instanceIdValue && instanceIdValue !== "undefined" && instanceIdValue !== "" && instanceIdValue !== "null";

console.log("Detection results:");
console.log("  instanceIdValue:", instanceIdValue);
console.log("  hasInstanceId:", hasInstanceId);

if (hasInstanceId) {
	if (
		instanceIdValue === "asynclocalstorage-runtime" ||
		(typeof instanceIdValue === "string" && instanceIdValue.includes("asynclocalstorage"))
	) {
		console.log("  Detected: asynclocalstorage");
	} else if (typeof instanceIdValue === "object" || typeof instanceIdValue === "function" || instanceIdValue === "livebindings-runtime") {
		console.log("  Detected: livebindings");
	} else {
		console.log("  Detected: unknown (instanceIdValue:", instanceIdValue, ")");
	}
}
