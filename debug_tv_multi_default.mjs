/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /debug_tv_multi_default.mjs
 *	@Date: 2025-10-25 12:42:20 -07:00 (1761421340)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-25 12:47:15 -07:00 (1761421635)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

import slothlet from "./index.mjs";

const api = await slothlet({ dir: "./api_tests/api_tv_test", lazy: true, debug: true });

console.log("\n=== MULTI-DEFAULT DETECTION TEST ===");
console.log("Files WITH defaults (should preserve namespaces):");
console.log("- config.mjs, input.mjs, key.mjs, power.mjs, volume.mjs");
console.log("");
console.log("Files WITHOUT defaults (should flatten to root):");
console.log("- app.mjs, channel.mjs, connection.mjs, state.mjs");
console.log("");

console.log("=== ACTUAL RESULTS ===");
console.log("Root level functions (flattened from files without defaults):");
console.log("  api.connect exists:", !!api.connect);
console.log("  api.disconnect exists:", !!api.disconnect);
console.log("  api.getAllApps exists:", !!api.getAllApps);
console.log("  api.down (channel) exists:", !!api.down);
console.log("  api.up (channel) exists:", !!api.up);
console.log("");

console.log("Namespace level (preserved from files with defaults):");
console.log("  api.connection exists:", !!api.connection);
console.log("  api.app exists:", !!api.app);
console.log("  api.config exists:", !!api.config);
console.log("  api.input exists:", !!api.input);
console.log("");

console.log("=== EXPECTED BEHAVIOR ===");
console.log("Should have:");
console.log("  ✓ api.connect() - flattened from connection.mjs");
console.log("  ✓ api.getAllApps() - flattened from app.mjs");
console.log("  ✓ api.config.* - namespace preserved (has default)");
console.log("  ✓ api.input.* - namespace preserved (has default)");
console.log("");

console.log("Should NOT have:");
console.log("  ❌ api.connection.* - should be flattened");
console.log("  ❌ api.app.* - should be flattened");

api.shutdown();
