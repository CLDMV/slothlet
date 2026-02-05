/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/test-context-managers.mjs
 *	@Date: 2026-01-15T22:14:31-08:00 (1768544071)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:43 -08:00 (1770266383)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Test both async and live context managers
 */

import slothlet from "@cldmv/slothlet/slothlet";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("=== Testing Context Managers ===\n");

// Test 1: Async runtime
console.log("--- Test 1: Async Runtime ---");
try {
	const api_async = await slothlet({
		dir: join(__dirname, "../api_tests/api_test"),
		mode: "eager",
		runtime: "async"
	});

	console.log("✓ Loaded with async runtime");

	// Test basic function
	const result = await api_async.rootMath.add(2, 3);
	console.log(`✓ rootMath.add(2, 3) = ${result}`);
	console.log("✓ Async runtime working correctly");

	await api_async.shutdown();
	console.log("✓ Shutdown successful\n");
} catch (error) {
	console.error("✗ Async runtime test failed:", error.message);
	if (error.context) {
		console.error("Error context:", JSON.stringify(error.context, null, 2));
	}
	if (error.stack) {
		console.error("Stack trace:", error.stack);
	}
	process.exit(1);
}

// Test 2: Live runtime
console.log("--- Test 2: Live Runtime ---");
try {
	const api_live = await slothlet({
		dir: join(__dirname, "../api_tests/api_test"),
		mode: "eager",
		runtime: "live"
	});

	console.log("✓ Loaded with live runtime");

	// Test basic function
	const result = await api_live.rootMath.add(5, 7);
	console.log(`✓ rootMath.add(5, 7) = ${result}`);
	console.log("✓ Live runtime working correctly");

	await api_live.shutdown();
	console.log("✓ Shutdown successful\n");
} catch (error) {
	console.error("✗ Live runtime test failed:", error.message);
	process.exit(1);
}

console.log("=== All Tests Passed ===");
