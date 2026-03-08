/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/node/entrypoint-cjs.cjs
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
 * @fileoverview Node-only CJS entrypoint validation for index.cjs.
 * Verifies that requiring the package resolves and can load a basic API.
 */

"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const slothlet = require("../../index.cjs");

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
 * Runs the CommonJS entrypoint test.
 * @returns {Promise<void>}
 */
async function runCjsEntrypointTest() {
	console.log("🚀 CJS entrypoint test (index.cjs)");

	let api;
	try {
		api = await slothlet({
			dir: TEST_DIR,
			context: { user: "entrypoint-cjs" },
			api: { collision: { initial: "replace" } }
		});
		assertApi(api);
		assert.ok(api.slothlet, "api.slothlet management object should exist");
		assert.strictEqual(typeof api.slothlet.shutdown, "function", "api.slothlet.shutdown should be a function");
		console.log("✅ CJS entrypoint loaded and API responded correctly");
	} catch (error) {
		console.error("❌ CJS entrypoint test failed:", error.message);
		console.error(error);
		process.exit(1);
	} finally {
		if (api?.shutdown) {
			await api.shutdown();
		}
	}
}

runCjsEntrypointTest();
