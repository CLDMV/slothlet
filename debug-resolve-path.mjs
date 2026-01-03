import { resolvePathFromCaller } from "./src/lib/helpers/resolve-from-caller.mjs";
import slothlet from "./index.mjs";

console.log("=== Testing resolvePathFromCaller ===");

console.log("Current working directory:", process.cwd());
console.log("Direct resolvePathFromCaller('./api_tests/api_test'):", resolvePathFromCaller("./api_tests/api_test"));
console.log(
	"Direct resolvePathFromCaller('./api_tests/api_smart_flatten_folder_addapi'):",
	resolvePathFromCaller("./api_tests/api_smart_flatten_folder_addapi")
);

console.log("\n=== Testing slothlet dir resolution ===");
try {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		debug: true
	});
	console.log("slothlet() with relative dir worked!");
	await api.shutdown();
} catch (error) {
	console.log("slothlet() with relative dir failed:", error.message);
}
