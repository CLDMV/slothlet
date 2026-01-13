/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/old/test-helper-validation.mjs
 *	@Date: 2026-01-04 16:52:46 -08:00 (1767574366)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-12 15:53:43 -08:00 (1768262023)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */


import { runTestMatrix } from "../test-helper.mjs";

console.log("🧪 Testing the test helper with a simple test...");

await runTestMatrix(
	{},
	async (api, configName, _) => {
		console.log(`   ⚡ ${configName}: API is ${typeof api}, has ${Object.keys(api).length} properties`);

		// Basic validation that the API loaded
		if (typeof api !== "function" && typeof api !== "object") {
			throw new Error(`API should be function or object, got ${typeof api}`);
		}

		if (typeof api === "function" && typeof api.math?.add !== "function") {
			throw new Error("Expected math.add function not found");
		}
	},
	"Test Helper Validation"
);

console.log("✅ Test helper validation complete!");
