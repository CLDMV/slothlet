#!/usr/bin/env node

/**
 * Debug script to understand what's happening with folder loading
 */

import slothlet from "./index.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function debugFolderLoading() {
	console.log("=== Debug: Folder loading behavior ===\n");

	const api = await slothlet({
		dir: path.join(__dirname, "api_tests/api_test"),
		debug: true
	});

	console.log("\n--- Testing folder with root files + subfolders ---");
	await api.addApi("config", path.join(__dirname, "api_tests/api_smart_flatten_folder_config"), {}, true);

	console.log("\nAPI structure after addApi:");
	console.log("api.config keys:", Object.keys(api.config || {}));

	if (api.config) {
		for (const key of Object.keys(api.config)) {
			console.log(`api.config.${key}:`, typeof api.config[key]);
			if (typeof api.config[key] === "object" && api.config[key] !== null) {
				console.log(`  - api.config.${key} keys:`, Object.keys(api.config[key]));
			}
		}
	} else {
		console.log("api.config is:", api.config);
	}

	await api.shutdown();
}

debugFolderLoading().catch(console.error);
