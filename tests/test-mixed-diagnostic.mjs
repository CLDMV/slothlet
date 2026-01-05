import slothlet from "@cldmv/slothlet";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("Testing api_test_mixed with hotReload...\n");

const apiMixed = await slothlet({
	dir: join(__dirname, "../api_tests/api_test_mixed"),
	hotReload: true,
	debug: false
});

console.log("=== API_TEST_MIXED ===");
console.log("Type:", typeof apiMixed);
console.log("Is function:", typeof apiMixed === "function");
console.log("API Keys:", Object.keys(apiMixed));
console.log("api.reload exists:", typeof apiMixed.reload);
console.log("api.mathEsm exists:", typeof apiMixed.mathEsm);
console.log("api.mathCjs exists:", typeof apiMixed.mathCjs);

console.log("\n=== API_TEST ===");
const apiTest = await slothlet({
	dir: join(__dirname, "../api_tests/api_test"),
	hotReload: true,
	debug: false
});

console.log("Type:", typeof apiTest);
console.log("Is function:", typeof apiTest === "function");
console.log("API Keys:", Object.keys(apiTest).slice(0, 10));
console.log("api.reload exists:", typeof apiTest.reload);
console.log("api.math exists:", typeof apiTest.math);

const api = apiMixed;

if (typeof api.reload === "function") {
	console.log("\n✅ reload() method is available");
	await api.reload();
	console.log("✅ reload() executed successfully");
} else {
	console.log("\n❌ reload() method is NOT available");
}

await api.shutdown();
