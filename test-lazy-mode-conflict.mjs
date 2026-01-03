/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /test-lazy-mode-conflict.mjs
 *	@Date: 2026-01-02 19:07:13 -08:00 (1767408433)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import slothlet from "./index.mjs";
import path from "path";
import { fileURLToPath } from "node:url";

const _filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(_filename);

console.log("=== Testing addApi with config file + config folder conflict (LAZY MODE) ===");

const api = await slothlet({
	dir: path.join(__dirname, "api_tests/api_test_mixed"),
	mode: "lazy",
	runtime: "async",
	hooks: false,
	debug: true
});
const api2 = await slothlet({
	dir: path.join(__dirname, "api_tests/smart_flatten/api_smart_flatten_conflict"),
	mode: "lazy",
	runtime: "async",
	hooks: false,
	debug: true
});

console.log("\nBefore addApi:");
console.log("api.config exists:", typeof api.config);

await api.addApi("config", path.join(__dirname, "api_tests/smart_flatten/api_smart_flatten_conflict"));
await api.addApi("config", path.join(__dirname, "api_tests/smart_flatten/api_smart_flatten_folder_config"));

console.log("\nAfter addApi:");
console.log(
	"Full structure:",
	JSON.stringify(
		api.config,
		(key, value) => {
			if (typeof value === "function") {
				return `[Function: ${value.name || "anonymous"}]`;
			}
			return value;
		},
		2
	)
);

console.log(api);
console.log(api2);

console.log("\nExpected behavior (flattened per Rule 1):");
console.log("- api.config.getRootConfig() should exist (from root-level config.mjs)");
console.log("- api.config.getSubConfig() should exist (from config/config.mjs, flattened)");

console.log("\nTesting function calls (trigger materialization first):");
// In lazy mode, we need to access properties to trigger materialization
try {
	await api.config.getRootConfig();
} catch (_) {
	// Expected if function doesn't exist
}
try {
	await api.config.getSubConfig();
} catch (_) {
	// Expected if function doesn't exist
}

console.log("\nAfter materialization - checking what exists:");
console.log("api.config.getRootConfig exists:", typeof api.config.getRootConfig === "function");
console.log("api.config.setRootConfig exists:", typeof api.config.setRootConfig === "function");
console.log("api.config.getSubConfig exists:", typeof api.config.getSubConfig === "function");
console.log("api.config.setSubConfig exists:", typeof api.config.setSubConfig === "function");

console.log("\nActual function calls:");
if (typeof api.config.getRootConfig === "function") {
	console.log("getRootConfig():", await api.config.getRootConfig());
}
if (typeof api.config.getSubConfig === "function") {
	console.log("getSubConfig():", await api.config.getSubConfig());
}

api.shutdown();
