/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/node/entrypoint-esm.mjs
 *	@Date: 2026-01-10T17:42:21-08:00 (1768095741)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:39 -08:00 (1772425299)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Node-only ESM entrypoint validation for index.mjs.
 * Verifies that importing the package resolves and can load a basic API.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DIR = path.resolve(__dirname, "../../api_tests/api_test");

/**
 * Asserts the bound API exposes expected math surface for sanity checks.
 * @param {object} api - Bound slothlet API instance.
 * @returns {void}
 */
function assertApi(api) {
	assert.ok(api, "API instance should be created");
	assert.ok(api.math, "API should expose math namespace");
	assert.strictEqual(typeof api.math.add, "function", "math.add should be a function");
	assert.strictEqual(api.math.add(2, 3), 5, "math.add should add numbers synchronously");
}

/**
 * Runs the ESM entrypoint test.
 * @returns {Promise<void>}
 */
async function runEsmEntrypointTest() {
	console.log("🚀 ESM entrypoint test (index.mjs)");

	let api;
	try {
		api = await slothlet({ dir: TEST_DIR, context: { user: "entrypoint-esm" } });
		assertApi(api);
		console.log("✅ ESM entrypoint loaded and API responded correctly");
	} catch (error) {
		console.error("❌ ESM entrypoint test failed:", error.message);
		process.exit(1);
	} finally {
		if (api?.shutdown) {
			await api.shutdown();
		}
	}
}

await runEsmEntrypointTest();
