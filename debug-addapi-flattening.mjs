/**
 * Debug script to understand addapi flattening behavior
 */

import slothlet from "./index.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const _filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(_filename);

console.log("=== Debug: AddApi Flattening with addapi.mjs ===\n");

try {
	const api = await slothlet({ dir: path.join(__dirname, "./api_tests/api_test") });

	console.log("Loading addapi_with_folders...");

	// Enable debug to see what's happening
	api.config.debug = true;

	await api.addApi("plugins", path.join(__dirname, "./api_tests/api_smart_flatten_addapi_with_folders"), {}, true);

	console.log("\nActual API structure for api.plugins:");

	function inspectObject(obj, path = "", depth = 0) {
		if (depth > 3) return; // Prevent infinite recursion

		for (const [key, value] of Object.entries(obj)) {
			const fullPath = path ? `${path}.${key}` : key;

			if (typeof value === "function") {
				console.log(`  ${fullPath} (function)`);
			} else if (typeof value === "object" && value !== null) {
				console.log(`  ${fullPath} (object)`);
				if (depth < 2) {
					// Only go 2 levels deep for readability
					inspectObject(value, fullPath, depth + 1);
				}
			} else {
				console.log(`  ${fullPath} = ${JSON.stringify(value)}`);
			}
		}
	}

	inspectObject(api.plugins);

	console.log("\n=== Testing function calls ===");

	// Test if functions exist where we expect them
	if (typeof api.plugins.initializeMainPlugin === "function") {
		const result = await api.plugins.initializeMainPlugin();
		console.log(`✅ api.plugins.initializeMainPlugin() = ${JSON.stringify(result)}`);
	} else {
		console.log("❌ api.plugins.initializeMainPlugin is not a function");

		// Check if it's nested somewhere else
		if (api.plugins.addapi && typeof api.plugins.addapi.initializeMainPlugin === "function") {
			console.log("⚠️  Found at api.plugins.addapi.initializeMainPlugin instead");
		}
	}

	if (typeof api.plugins.pluginGlobalMethod === "function") {
		const result = await api.plugins.pluginGlobalMethod();
		console.log(`✅ api.plugins.pluginGlobalMethod() = ${JSON.stringify(result)}`);
	} else {
		console.log("❌ api.plugins.pluginGlobalMethod is not a function");
	}

	if (api.plugins.pluginVersion !== undefined) {
		console.log(`✅ api.plugins.pluginVersion = ${JSON.stringify(api.plugins.pluginVersion)}`);
	} else {
		console.log("❌ api.plugins.pluginVersion is undefined");
	}

	await api.shutdown();
} catch (error) {
	console.error("Error:", error);
}
