import slothlet from "./index.mjs";

console.log("=== Test 21 Scenario ===");
const api = await slothlet({ dir: "./api_tests/api_test", lazy: false, hotReload: true, debug: false });

// Add deep API
await api.addApi("deep", "./api_tests/api_test", { test: "metadata" }, { moduleId: "deep-test" });

console.log("\n=== BEFORE reloadApi ===");
console.log("api.deep has __metadata?", !!api.deep.__metadata);
console.log("api.deep.math has __metadata?", !!api.deep.math.__metadata);
console.log("api.deep.math.add has __metadata?", !!api.deep.math.add.__metadata);

const mathRef = api.deep?.math;
const addRef = api.deep?.math?.add;
console.log("\nStored references:");
console.log("mathRef:", typeof mathRef);
console.log("addRef:", typeof addRef);

// Reload with mutateExisting
await api.reloadApi("deep");

console.log("\n=== AFTER reloadApi ===");
console.log("api.deep has __metadata?", !!api.deep.__metadata);
console.log("api.deep.math has __metadata?", !!api.deep.math.__metadata);
console.log("api.deep.math.add has __metadata?", !!api.deep.math.add.__metadata);

console.log("\nReference checks:");
console.log("api.deep.math === mathRef:", api.deep?.math === mathRef);
console.log("api.deep.math.add === addRef:", api.deep?.math?.add === addRef);

await api.shutdown();
