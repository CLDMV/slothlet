/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /test-addapi-conflict.mjs
 *	@Date: 2026-01-02 18:20:42 -08:00 (1767406842)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-02 18:43:07 -08:00 (1767408187)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import slothlet from "./index.mjs";
import path from "path";
import { fileURLToPath } from "node:url";

const _filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(_filename);

console.log("=== Testing addApi with config file + config folder conflict ===");

const api = await slothlet({
	dir: path.join(__dirname, "api_tests/api_test_mixed"),
	mode: "eager",
	runtime: "async",
	hooks: false,
	debug: true
});

console.log("\nBefore addApi:");
console.log("api.config exists:", typeof api.config);

await api.addApi("config", path.join(__dirname, "test-addapi-conflict"));
await api.addApi("config", path.join(__dirname, "api_tests/api_smart_flatten_folder_config"));

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

console.log("\nExpected behavior:");
console.log("- api.config.getRootConfig() should exist (from root-level config.mjs)");
console.log("- api.config.config.getSubConfig() should exist (from config/config.mjs)");

console.log("\nActual behavior:");
console.log("api.config.getRootConfig exists:", typeof api.config.getRootConfig === "function");
console.log("api.config.setRootConfig exists:", typeof api.config.setRootConfig === "function");
console.log("api.config.config exists:", typeof api.config.config === "object");
if (api.config.config) {
	console.log("api.config.config.getSubConfig exists:", typeof api.config.config.getSubConfig === "function");
	console.log("api.config.config.setSubConfig exists:", typeof api.config.config.setSubConfig === "function");
}

api.shutdown();
