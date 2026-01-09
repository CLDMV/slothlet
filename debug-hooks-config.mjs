/**
 * Debug script to test different slothlet configurations
 * Testing matrix config vs simple config to find the hook issue
 */

import slothlet from "./index.mjs";

console.log("=== Hook Configuration Debug Test ===");

// Test 1: Simple config (working)
console.log("\n1. Testing simple config (lazy: false)...");
const api1 = await slothlet({
	dir: "./api_tests/api_test",
	hooks: true,
	lazy: false
});

const execution1 = [];
api1.hooks.on(
	"before",
	() => {
		execution1.push("p300");
		console.log("  Simple: p300");
	},
	{ id: "p300", pattern: "**", priority: 300 }
);
api1.hooks.on(
	"before",
	() => {
		execution1.push("p200");
		console.log("  Simple: p200");
	},
	{ id: "p200", pattern: "**", priority: 200 }
);
api1.hooks.on(
	"before",
	() => {
		execution1.push("p100");
		console.log("  Simple: p100");
	},
	{ id: "p100", pattern: "**", priority: 100 }
);

await api1.math.add(2, 3);
console.log("Simple config result:", execution1);
await api1.shutdown();

// Test 2: Matrix config style (potentially failing)
console.log("\n2. Testing matrix config style (mode: 'eager')...");
const api2 = await slothlet({
	dir: "./api_tests/api_test",
	hooks: true,
	mode: "eager",
	runtime: "async",
	allowApiOverwrite: true,
	hotReload: false,
	apiDepth: Infinity
});

const execution2 = [];
api2.hooks.on(
	"before",
	() => {
		execution2.push("p300");
		console.log("  Matrix: p300");
	},
	{ id: "p300", pattern: "**", priority: 300 }
);
api2.hooks.on(
	"before",
	() => {
		execution2.push("p200");
		console.log("  Matrix: p200");
	},
	{ id: "p200", pattern: "**", priority: 200 }
);
api2.hooks.on(
	"before",
	() => {
		execution2.push("p100");
		console.log("  Matrix: p100");
	},
	{ id: "p100", pattern: "**", priority: 100 }
);

await api2.math.add(2, 3);
console.log("Matrix config result:", execution2);
await api2.shutdown();

// Test 3: Exact vitest config
console.log("\n3. Testing with resolved TEST_DIRS path...");
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DIR_ABSOLUTE = path.resolve(__dirname, "./api_tests/api_test");

const api3 = await slothlet({
	dir: TEST_DIR_ABSOLUTE,
	hooks: true,
	mode: "eager",
	runtime: "async",
	allowApiOverwrite: true,
	hotReload: false,
	apiDepth: Infinity
});

const execution3 = [];
api3.hooks.on(
	"before",
	() => {
		execution3.push("p300");
		console.log("  Absolute: p300");
	},
	{ id: "p300", pattern: "**", priority: 300 }
);
api3.hooks.on(
	"before",
	() => {
		execution3.push("p200");
		console.log("  Absolute: p200");
	},
	{ id: "p200", pattern: "**", priority: 200 }
);
api3.hooks.on(
	"before",
	() => {
		execution3.push("p100");
		console.log("  Absolute: p100");
	},
	{ id: "p100", pattern: "**", priority: 100 }
);

await api3.math.add(2, 3);
console.log("Absolute path config result:", execution3);
await api3.shutdown();

console.log("\n=== Summary ===");
console.log("Simple config (lazy: false):", execution1);
console.log("Matrix config (mode: eager):", execution2);
console.log("Absolute path config:", execution3);
console.log("All should be: ['p300', 'p200', 'p100']");
