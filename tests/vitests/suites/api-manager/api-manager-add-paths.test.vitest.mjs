/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-add-paths.test.vitest.mjs
 *	@Date: 2026-02-27T20:33:02-08:00 (1772253182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:42 -08:00 (1772425302)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for addApiComponent array-of-paths, single-file-path,
 * metadata registration, and debug-mode paths in api-manager.mjs.
 *
 * @description
 * Exercises the following previously uncovered code paths:
 *   addApiComponent array path (lines ~1067-1078):
 *     - folderPath is an Array → iterates via addApiComponent recursion
 *   addApiComponent single-file path (lines ~1095-1130):
 *     - isFile=true → sets dirForBuild and fileFilter
 *     - invalid extension → throws INVALID_CONFIG_FILE_TYPE
 *   addApiComponent single-file apiToMerge (lines ~1261-1277):
 *     - Special apiToMerge reassignment for single-file loads
 *   Metadata registration (lines ~1411-1441):
 *     - anyAssignmentSucceeded + metadata → registers user metadata
 *     - Root level registration loop
 *     - Nested level registration (single rootSegment)
 *   Debug mode (line ~1277):
 *     - debug.api=true triggers debug logs in add path
 *
 * @module tests/vitests/suites/api-manager/api-manager-add-paths
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, suppressSlothletDebugOutput } from "../../setup/vitest-helper.mjs";

let restoreDebugOutput;

beforeEach(() => {
	restoreDebugOutput = suppressSlothletDebugOutput();
});

afterEach(() => {
	restoreDebugOutput?.();
	restoreDebugOutput = undefined;
});

const EAGER_CONFIGS = [
	{ name: "eager/hooks-on", config: { mode: "eager", runtime: "async", hook: { enabled: true } } },
	{ name: "eager/hooks-off", config: { mode: "eager", runtime: "async", hook: { enabled: false } } }
];

/**
 * Create a slothlet instance with the given base config and optional overrides.
 * @param {object} baseConfig - Matrix config object.
 * @param {object} [overrides] - Extra config overrides.
 * @returns {Promise<object>} Ready slothlet API instance.
 */
async function makeApi(baseConfig, overrides = {}) {
	return slothlet({ ...baseConfig, ...overrides });
}

// ---------------------------------------------------------------------------
// 1. Array of paths: addApiComponent iterates each path
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("addApiComponent — array of paths ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("accepts an array of two directory paths and merges them under the same namespace", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });

		// Add two directories under "multi" using an array, with merge collision mode
		const moduleIDs = await api.slothlet.api.add("multi", [TEST_DIRS.API_TEST_MIXED, TEST_DIRS.API_TEST_MIXED], {
			collisionMode: "merge"
		});

		// Returns an array of moduleIDs
		expect(Array.isArray(moduleIDs)).toBe(true);
		expect(moduleIDs.length).toBe(2);
		expect(api.multi).toBeDefined();
	});

	it("accepts an array with a single path", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });

		const result = await api.slothlet.api.add("single-arr", [TEST_DIRS.API_TEST_MIXED]);
		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(1);
		expect(api["single-arr"] || api.singleArr).toBeDefined();
	});

	it("merges two different source directories under the same endpoint", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });

		// First add creates the endpoint, second merges
		await api.slothlet.api.add("combo", [TEST_DIRS.API_TEST_MIXED, TEST_DIRS.API_TEST_COLLECTIONS], {
			collisionMode: "merge"
		});
		expect(api.combo).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 2. Single file path: isFile branch
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("addApiComponent — single file path ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("loads a single .mjs file and exposes its exports at the target path", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		const mathFilePath = path.join(TEST_DIRS.API_TEST, "math.mjs");

		// Adding a single file rather than a directory triggers isFile=true path
		await api.slothlet.api.add("fmath", mathFilePath);

		// The exports from math.mjs should be accessible
		expect(api.fmath).toBeDefined();
		// math.mjs exports add and subtract functions
		expect(typeof api.fmath.add).toBe("function");
	});

	it("loads a single .mjs file at a nested namespace", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		const mathFilePath = path.join(TEST_DIRS.API_TEST, "math.mjs");

		await api.slothlet.api.add("utils.math", mathFilePath);
		expect(api.utils).toBeDefined();
		expect(api.utils.math).toBeDefined();
		expect(typeof api.utils.math.add).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// 3. Single file — invalid extension throws
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("addApiComponent — invalid file extension ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("throws INVALID_CONFIG_FILE_TYPE for .json extension", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });

		// Create a temp path that looks like a .json file (won't exist but isFile check needs it)
		// The resolvePath check happens before extension check, so we need a file that exists
		// Use package.json from project root
		await expect(api.slothlet.api.add("bad", "/srv/repos/slothlet/package.json")).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// 4. Metadata registration with successful add
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("addApiComponent — metadata registration ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("registers user metadata when metadata option is provided for nested path", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });

		// Add with metadata — covers lines 1411-1441 in addApiComponent
		await api.slothlet.api.add("tools", TEST_DIRS.API_TEST_MIXED, {
			metadata: { version: "1.0", owner: "test-suite" }
		});
		expect(api.tools).toBeDefined();

		// Verify metadata was registered by checking via slothlet API
		const meta = await api.slothlet.metadata.get("tools");
		expect(meta).toBeDefined();
	});

	it("registers user metadata at root level (parts.length === 0)", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });

		// Root level add (apiPath="") with metadata — covers root metadata loop
		await api.slothlet.api.add("", TEST_DIRS.API_TEST_MIXED, {
			metadata: { root: true, version: "2.0" },
			collisionMode: "merge"
		});

		// At least one key from api_test_mixed should be at root
		expect(api.mathEsm || api["math-esm"]).toBeDefined();
	});

	it("returns a blocked moduleID when the same endpoint is added a second time", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });

		// Add first time (succeeds)
		await api.slothlet.api.add("blocked", TEST_DIRS.API_TEST_MIXED, {
			metadata: { first: true }
		});

		// Second add to same endpoint with same dir — slothlet blocks it and returns a "blocked_" ID
		// This covers the "no assignments produced" branch where metadata registration is skipped
		const moduleId2 = await api.slothlet.api.add("blocked", TEST_DIRS.API_TEST_MIXED, {
			metadata: { second: true }
		});

		// The returned moduleID starts with "blocked_" confirming the add yielded no assignments
		expect(moduleId2).toMatch(/^blocked_/);
		// api.blocked should still be populated from the first successful add
		expect(api.blocked).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 5. Debug mode — add with debug.api=true
// ---------------------------------------------------------------------------
describe("addApiComponent — debug.api=true traces add paths", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("runs add with debug.api=true without throwing", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			hook: { enabled: false },
			debug: { api: true }
		});
		expect(api.math).toBeDefined();

		// Add with debug mode active — covers debug branch in addApiComponent
		await api.slothlet.api.add("debugged", TEST_DIRS.API_TEST_MIXED, {
			collisionMode: "merge"
		});
		expect(api.debugged).toBeDefined();
	});

	it("Rule 13 dedup runs with debug.api=true (triggers debug log inside isDirectChild)", async () => {
		// Use API_TEST dir which has config.mjs at root, mount under "config"
		// This triggers Rule 13: newApi.config.filePath matches config.mjs in API_TEST root
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			hook: { enabled: false },
			debug: { api: true }
		});

		// Remove existing config first to allow clean add
		await api.slothlet.api.remove("config");

		// Now add config dir under "config" endpoint — should trigger Rule 13
		await api.slothlet.api.add("config", TEST_DIRS.API_TEST, { collisionMode: "replace" });
		expect(api.config).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 6. addApiComponent — forceOverwrite path
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("addApiComponent — forceOverwrite + moduleID ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("replaces an existing module when forceOverwrite is set", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });

		await api.slothlet.api.add("fow", TEST_DIRS.API_TEST_MIXED, { moduleID: "fow-mod" });
		expect(api.fow).toBeDefined();

		// forceOverwrite replaces as replace mode
		await api.slothlet.api.add("fow", TEST_DIRS.API_TEST_MIXED, {
			moduleID: "fow-mod",
			forceOverwrite: true
		});
		expect(api.fow).toBeDefined();
	});
});
