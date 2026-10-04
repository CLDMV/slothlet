/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/node/entrypoint-cjs.cjs
 *	@Date: 2026-01-10T17:42:21-08:00 (1768095741)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 23:21:43 -07:00 (1791094903)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Node-only CJS entrypoint validation for index.cjs.
 * Verifies that requiring the package resolves and can load a basic API, that `require()` returns
 * the ESM entry's own function with `.defaults` attached synchronously, and that the entry fails
 * with a clear message where Node.js has no require(esm).
 */

"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const slothlet = require("../../index.cjs");

// Captured in the same synchronous tick as the require() above: `.defaults` must already be set.
const defaultsAtRequire = slothlet.defaults;

const REPO_ROOT = path.resolve(__dirname, "../..");
const TEST_DIR = path.resolve(REPO_ROOT, "api_tests/api_test");

/**
 * Asserts require() hands back the ESM entry's own exports, synchronously.
 * @returns {Promise<void>}
 */
async function assertSyncRequire() {
	const esm = await import("../../index.mjs");

	assert.strictEqual(typeof slothlet, "function", "require() should return a function");
	assert.strictEqual(slothlet, esm.default, "require() should return the same function as the ESM default export");
	assert.strictEqual(slothlet.slothlet, esm.slothlet, "the named slothlet alias should match the ESM named export");
	assert.ok(defaultsAtRequire, ".defaults should be present synchronously right after require()");
	assert.strictEqual(defaultsAtRequire, esm.default.defaults, ".defaults should be the ESM entry's own object");
	assert.ok(Array.isArray(defaultsAtRequire.routines), ".defaults.routines should be an array");
	console.log("✅ require() returns the ESM entry synchronously, with .defaults attached");
}

/**
 * Asserts CJS and ESM consumers get an identical object: the same own keys whether the package
 * is loaded with require() or only with import, in any order. The ESM-only case runs in a fresh
 * process, because require() has already run in this one.
 * @returns {void}
 */
function assertIdenticalShape() {
	const keys = (fn) =>
		Object.getOwnPropertyNames(fn)
			.filter((k) => !["length", "name", "prototype"].includes(k))
			.sort();
	const cjsKeys = keys(slothlet);
	const script =
		"import s, { slothlet as n } from './index.mjs';" +
		"const k = Object.getOwnPropertyNames(s).filter((x) => !['length', 'name', 'prototype'].includes(x)).sort();" +
		"console.log(JSON.stringify({ keys: k, alias: s.slothlet === n }));";
	const res = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: REPO_ROOT, encoding: "utf8" });
	assert.strictEqual(res.status, 0, `ESM-only probe failed: ${res.stderr}`);
	const esmOnly = JSON.parse(res.stdout.trim());

	assert.deepStrictEqual(cjsKeys, ["defaults", "slothlet"], "require() should expose exactly defaults and slothlet");
	assert.deepStrictEqual(esmOnly.keys, cjsKeys, "an ESM-only load should expose the same own keys as require()");
	assert.ok(esmOnly.alias, "the ESM default's slothlet property should be the named export");
	console.log("✅ CJS and ESM expose an identical object, independent of load order");
}

/**
 * Asserts the entry fails with a clear message where Node.js has no require(esm).
 * `--no-experimental-require-module` turns require(esm) off, which is what Node.js versions
 * before 20.19 / 22.12 look like to the entry.
 * @returns {void}
 */
function assertRequireEsmCheck() {
	const res = spawnSync(process.execPath, ["--no-experimental-require-module", "-e", "require('./index.cjs')"], {
		cwd: REPO_ROOT,
		encoding: "utf8"
	});

	assert.notStrictEqual(res.status, 0, "require() without require(esm) should exit non-zero");
	assert.match(res.stderr, /ERR_REQUIRE_ESM/);
	assert.match(res.stderr, /require\(\) needs Node\.js \^20\.19\.0 or >=22\.12\.0/);
	assert.match(res.stderr, /import\(\)/);
	console.log("✅ require() without require(esm) fails with ERR_REQUIRE_ESM and points to import()");
}

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
		await assertSyncRequire();
		assertIdenticalShape();
		assertRequireEsmCheck();

		api = await slothlet({
			base: TEST_DIR,
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
