import slothlet from "./src/slothlet.mjs";

const api = await slothlet({
	dir: "./api_tests/api_tv_test", 
	debug: true, 
	lazy: true
});

console.log("Test completed");
await api.shutdown();