/**
 * Simple hooks debug test
 */

import slothlet from "../index.mjs";

const api = await slothlet({
	dir: "./api_tests/api_test",
	hooks: true
});

console.log("API created");
console.log("api.hooks exists:", !!api.hooks);
console.log("api.__ctx exists:", !!api.__ctx);
console.log("api.__ctx.hookManager exists:", !!api.__ctx?.hookManager);
console.log("hookManager enabled:", api.__ctx?.hookManager?.enabled);
console.log("hookManager pattern:", api.__ctx?.hookManager?.enabledPattern);

// Register a hook - use existing API: on(name, type, handler, options)
api.hooks.on(
	"test-hook",
	"before",
	({ path, args }) => {
		console.log("HOOK CALLED! Path:", path, "Args:", args);
	},
	{ priority: 100, pattern: "**" }
);

console.log("Hook registered");
const hooksList = api.hooks.list();
console.log("Hooks list:", hooksList);

// Test pattern matching manually
if (api.__ctx.hookManager) {
	const manager = api.__ctx.hookManager;
	const testPath = "math.add";
	console.log("\n=== Pattern Matching Debug ===");
	console.log("Test path:", testPath);

	// Test pattern compilation directly
	console.log("--- Direct Pattern Compilation Test ---");
	const testPattern = "**";
	console.log(`Input pattern: "${testPattern}"`);
	const expandedBraces = manager._expandBraces(testPattern);
	console.log(`After _expandBraces: ${JSON.stringify(expandedBraces)}`);
	const regexString = manager._patternToRegex(expandedBraces[0]);
	console.log(`After _patternToRegex: "${regexString}"`);
	const fullRegex = new RegExp(`^${regexString}$`);
	console.log(`Final compiled: ${fullRegex}`);
	console.log(`Test against "math.add": ${fullRegex.test("math.add")}`);

	console.log("\n--- Registered Hook Inspection ---");
	for (const hook of manager.hooks.values()) {
		console.log("Hook:", hook.name, "Type:", hook.type, "Pattern:", hook.pattern);
		console.log("Compiled pattern:", hook.compiledPattern);
		console.log("Pattern test result:", hook.compiledPattern.test(testPath));
	}
}

// Try calling a function
console.log("\nCalling api.math.add(2, 3)...");
console.log("api.math type:", typeof api.math);
console.log("api.math.add type:", typeof api.math.add);
console.log("api.math.add.__slothletPath:", api.math.add.__slothletPath);
console.log("api.math.add.name:", api.math.add.name);
const result = await api.math.add(2, 3);
console.log("Result:", result);

await api.shutdown();
