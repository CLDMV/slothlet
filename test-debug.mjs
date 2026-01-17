import slothlet from "./src3/slothlet.mjs";

const api = await slothlet({
	dir: "./api_tests_v3/api_test",
	mode: "eager",
	debug: true
});

console.log("\n=== RESULTS ===");
console.log("API Type:", typeof api);
console.log("api() callable:", typeof api === "function");
console.log("api.funcmod:", typeof api.funcmod);
console.log("api.exportDefault:", typeof api.exportDefault);
console.log("api.mixed:", typeof api.mixed);
