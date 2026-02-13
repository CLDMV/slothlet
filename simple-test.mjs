import { slothlet } from "./index.mjs";

const api = await slothlet({
dir: "api_tests/api_test/math",
mode: "eager"
});

console.log("API loaded successfully!");
console.log("Object.keys(api):", Object.keys(api));
console.log("✅ Test passed!");
