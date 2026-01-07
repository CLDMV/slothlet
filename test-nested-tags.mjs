import slothlet from "./index.mjs";

const api = await slothlet({ dir: "./api_tests/api_test", lazy: false, hotReload: true, debug: false });

console.log("\n=== BEFORE addApi ===");
console.log("api.math:", typeof api.math, !!api.math?.__metadata);
console.log("api.math.add:", typeof api.math?.add, !!api.math?.add?.__metadata);

await api.addApi("deep", "./api_tests/api_test", { test: "metadata" }, { moduleId: "deep-test" });

console.log("\n=== AFTER addApi ===");
console.log("deep:", typeof api.deep, !!api.deep.__slothletPath, !!api.deep.__metadata);
console.log("deep.math:", typeof api.deep.math, !!api.deep?.math?.__metadata);
console.log("deep.math.add:", typeof api.deep?.math?.add, !!api.deep?.math?.add?.__metadata);

await api.shutdown();
