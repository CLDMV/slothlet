/**
 * Simple script to test hook execution behavior
 * Testing if multiple hooks with different priorities all execute
 */

import slothlet from "./index.mjs";

const api = await slothlet({
	dir: "./api_tests/api_test",
	hooks: true,
	lazy: false // Use eager mode for this test
});

console.log("=== Hook Registration Test ===");

const execution = [];

// Register 5 hooks with different priorities
console.log("Registering hooks...");
api.hooks.on(
	"before",
	() => {
		console.log("  Executing hook: p50");
		execution.push("p50");
	},
	{ id: "p50", pattern: "**", priority: 50 }
);

api.hooks.on(
	"before",
	() => {
		console.log("  Executing hook: p200");
		execution.push("p200");
	},
	{ id: "p200", pattern: "**", priority: 200 }
);

api.hooks.on(
	"before",
	() => {
		console.log("  Executing hook: p100-1");
		execution.push("p100-1");
	},
	{ id: "p100-1", pattern: "**", priority: 100 }
);

api.hooks.on(
	"before",
	() => {
		console.log("  Executing hook: p100-2");
		execution.push("p100-2");
	},
	{ id: "p100-2", pattern: "**", priority: 100 }
);

api.hooks.on(
	"before",
	() => {
		console.log("  Executing hook: p300");
		execution.push("p300");
	},
	{ id: "p300", pattern: "**", priority: 300 }
);

console.log("Hooks registered. Calling math.add(2, 3)...");
console.log("Expected execution order: ['p300', 'p200', 'p100-1', 'p100-2', 'p50']");
console.log("");

// Call a function to trigger hooks
const result = await api.math.add(2, 3);

console.log("");
console.log("=== Results ===");
console.log("Function result:", result);
console.log("Actual execution order:", execution);
console.log("Expected execution order: ['p300', 'p200', 'p100-1', 'p100-2', 'p50']");
console.log("Match:", JSON.stringify(execution) === JSON.stringify(["p300", "p200", "p100-1", "p100-2", "p50"]));

await api.shutdown();
