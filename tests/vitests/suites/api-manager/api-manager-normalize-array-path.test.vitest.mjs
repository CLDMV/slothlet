/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-normalize-array-path.test.vitest.mjs
 *	@Date: 2026-02-27T20:33:02-08:00 (1772253182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:43 -08:00 (1772425303)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for normalizeApiPath() array input and invalid-type paths.
 *
 * @description
 * Exercises the previously uncovered array-input branch in normalizeApiPath:
 *  - valid array of strings  (lines 118-158 in api-manager.mjs)
 *  - empty array             (returns root)
 *  - array with non-string   (throws INVALID_CONFIG_API_PATH_INVALID)
 *  - array with empty string (throws INVALID_CONFIG_API_PATH_INVALID)
 *  - array whose first elem  is "slothlet" (reserved name)
 *  - non-string, non-array   (throws INVALID_CONFIG_API_PATH_INVALID)
 *
 * All paths flow through api.slothlet.api.add() which calls
 * normalizeApiPath() immediately, so we can test from the public surface.
 *
 * @module tests/vitests/suites/api-manager/api-manager-normalize-array-path
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Create a slothlet instance with eager mode for predictable synchronous results.
 * @returns {Promise<object>} Initialized slothlet API instance.
 */
async function makeApi() {
	return slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });
}

describe("normalizeApiPath — array input and invalid types", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	// ------------------------------------------------------------------ valid

	it("accepts valid array path and mounts the module at the joined path", async () => {
		api = await makeApi();
		await api.slothlet.api.add(["extra", "tools"], TEST_DIRS.API_TEST_MIXED);
		// Should be mounted at api.extra.tools.*
		expect(api.extra).toBeDefined();
		expect(api.extra.tools).toBeDefined();
	});

	it("accepts single-element array as a simple namespace", async () => {
		api = await makeApi();
		await api.slothlet.api.add(["singleNs"], TEST_DIRS.API_TEST_MIXED);
		expect(api.singleNs).toBeDefined();
	});

	it("accepts empty array and mounts at the root level (dot-joined produces empty string)", async () => {
		api = await makeApi();
		// empty array → normalizeApiPath returns { apiPath: "", parts: [] } → root mount
		// Should not throw; keys from the added dir appear at the root
		await expect(
			api.slothlet.api.add([], TEST_DIRS.API_TEST_MIXED)
		).resolves.not.toThrow();
	});

	// ---------------------------------------------------------------- invalid: element types

	it("throws when an array element is a number", async () => {
		api = await makeApi();
		await expect(
			api.slothlet.api.add([123, "tools"], TEST_DIRS.API_TEST_MIXED)
		).rejects.toThrow();
	});

	it("throws when an array element is null", async () => {
		api = await makeApi();
		await expect(
			api.slothlet.api.add([null, "tools"], TEST_DIRS.API_TEST_MIXED)
		).rejects.toThrow();
	});

	it("throws when an array element is an empty string", async () => {
		api = await makeApi();
		await expect(
			api.slothlet.api.add(["valid", ""], TEST_DIRS.API_TEST_MIXED)
		).rejects.toThrow();
	});

	it("throws when an array element is a whitespace-only string", async () => {
		api = await makeApi();
		await expect(
			api.slothlet.api.add(["valid", "   "], TEST_DIRS.API_TEST_MIXED)
		).rejects.toThrow();
	});

	// ---------------------------------------------------- invalid: reserved names

	it('throws when first element is the reserved name "slothlet"', async () => {
		api = await makeApi();
		await expect(
			api.slothlet.api.add(["slothlet"], TEST_DIRS.API_TEST_MIXED)
		).rejects.toThrow();
	});

	it('throws when first element is "slothlet" in a multi-segment array', async () => {
		api = await makeApi();
		await expect(
			api.slothlet.api.add(["slothlet", "utils"], TEST_DIRS.API_TEST_MIXED)
		).rejects.toThrow();
	});

	it('throws when single-element array is the reserved name "shutdown"', async () => {
		api = await makeApi();
		await expect(
			api.slothlet.api.add(["shutdown"], TEST_DIRS.API_TEST_MIXED)
		).rejects.toThrow();
	});

	it('throws when single-element array is the reserved name "destroy"', async () => {
		api = await makeApi();
		await expect(
			api.slothlet.api.add(["destroy"], TEST_DIRS.API_TEST_MIXED)
		).rejects.toThrow();
	});

	// -------------------------------------------- invalid: non-string, non-array type

	it("throws when apiPath is a number", async () => {
		api = await makeApi();
		await expect(
			api.slothlet.api.add(42, TEST_DIRS.API_TEST_MIXED)
		).rejects.toThrow();
	});

	it("throws when apiPath is a plain object", async () => {
		api = await makeApi();
		await expect(
			api.slothlet.api.add({ path: "test" }, TEST_DIRS.API_TEST_MIXED)
		).rejects.toThrow();
	});

	it("throws when apiPath is a boolean", async () => {
		api = await makeApi();
		await expect(
			api.slothlet.api.add(true, TEST_DIRS.API_TEST_MIXED)
		).rejects.toThrow();
	});
});
