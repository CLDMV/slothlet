import slothlet from "./index.mjs";

const api = await slothlet({ dir: "./api_tests/api_test", debug: true });

console.log("=== STRING MODULE ===");
console.log("api.string:", typeof api.string, Object.keys(api.string));
console.log("api.string.string:", typeof api.string?.string, api.string?.string ? Object.keys(api.string.string) : "undefined");

console.log("\n=== MATH MODULE ===");
console.log("api.math:", typeof api.math, Object.keys(api.math));
console.log("api.math.math:", typeof api.math?.math, api.math?.math ? Object.keys(api.math.math) : "undefined");

console.log("\n=== EXPECTED vs ACTUAL ===");
console.log("Expected: api.string.upper() should work");
console.log("Actual api.string.upper:", typeof api.string?.upper);
console.log("Actual api.string.string.upper:", typeof api.string?.string?.upper);

await api.shutdown();
