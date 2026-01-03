import slothlet from "./index.mjs";
import path from "path";
import { fileURLToPath } from "node:url";

const _filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(_filename);

// Initialize slothlet correctly like the tests do - but load api_smart_flatten_nested directly
const api = await slothlet({
	dir: path.join(__dirname, "api_tests/api_smart_flatten_nested"),
	mode: "eager",
	runtime: "async",
	hooks: false
});

// NO addApi call - just see the primary load structure

console.log("=== FULL API DUMP ===");
console.log(
	JSON.stringify(
		api,
		(key, value) => {
			if (typeof value === "function") {
				return `[Function: ${value.name || "anonymous"}]`;
			}
			return value;
		},
		2
	)
);

api.shutdown();
