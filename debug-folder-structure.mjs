/**
 * Debug script to understand folder structure behavior
 */

import slothlet from "./index.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const _filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(_filename);

console.log("=== Debug: Folder Structure ===\n");

try {
	// Create a clean slothlet instance without loading anything
	const api = await slothlet({ dir: path.join(__dirname, "./api_tests/api_test"), debug: true });

	console.log("Loading api_smart_flatten_folder_config...");
	await api.addApi("config", path.join(__dirname, "./api_tests/api_smart_flatten_folder_config"), {}, true);

	console.log("\nActual API structure for api.config:");

	function inspectObject(obj, path = "", depth = 0) {
		if (depth > 3) return;

		for (const [key, value] of Object.entries(obj)) {
			const fullPath = path ? `${path}.${key}` : key;

			if (typeof value === "function") {
				console.log(`  ${fullPath} (function)`);
			} else if (typeof value === "object" && value !== null) {
				console.log(`  ${fullPath} (object)`);
				if (depth < 2) {
					inspectObject(value, fullPath, depth + 1);
				}
			} else {
				console.log(`  ${fullPath} = ${JSON.stringify(value)}`);
			}
		}
	}

	inspectObject(api.config);

	await api.shutdown();
} catch (error) {
	console.error("Error:", error);
}
