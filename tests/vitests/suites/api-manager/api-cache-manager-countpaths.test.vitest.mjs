/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-cache-manager-countpaths.test.vitest.mjs
 *	@Date: 2026-03-03 00:00:00 -08:00 (1772726400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 00:00:00 -08:00 (1772726400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage test for api-cache-manager.mjs `_countPaths` underscore-key guard (line 275).
 *
 * @description
 * `_countPaths` walks an API object tree counting addressable paths. When a key starts
 * with `_` or `__` it executes `continue` (line 275) to skip internal/private properties.
 *
 * The continue is never hit in normal usage because slothlet sanitizes module names
 * (removing underscore prefixes).  To exercise line 275, we access the `apiCacheManager`
 * component directly via `resolveWrapper` and call `_countPaths` with a plain object
 * that contains underscore-prefixed keys.
 *
 * Line 275 is the `continue` inside:
 * ```
 * if (key.startsWith("__") || key.startsWith("_")) {
 *     continue;  // line 275
 * }
 * ```
 *
 * @module tests/vitests/suites/api-manager/api-cache-manager-countpaths
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

let api;

afterEach(async () => {
	await api?.shutdown().catch(() => {});
	api = null;
});

// ─── _countPaths — underscore key skip (line 275) ────────────────────────────

describe("ApiCacheManager._countPaths — underscore-prefixed key guard (line 275)", () => {
	/**
	 * Get a raw Slothlet instance from the returned api object.
	 *
	 * @param {object} _api - Slothlet API object.
	 * @param {string} key - A non-slothlet key present in the api.
	 * @returns {object} Raw Slothlet instance.
	 */
	function getSlFromApi(_api, key) {
		return resolveWrapper(_api[key])?.slothlet;
	}

	it("_countPaths skips keys starting with '_' and counts remaining keys (line 275)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });

		const sl = getSlFromApi(api, "math");
		expect(sl).toBeDefined();
		expect(sl.handlers.apiCacheManager).toBeDefined();

		// Object with a mix of normal and underscore-prefixed keys
		const target = {
			publicA: () => {},
			_privateB: () => {},
			publicC: () => {},
			__internalD: () => {}
		};

		// Only 'publicA' and 'publicC' count — '_privateB' and '__internalD' hit line 275
		const count = sl.handlers.apiCacheManager._countPaths(target);
		expect(count).toBe(2);
	});

	it("_countPaths returns 0 for an object with only underscore-prefixed keys (line 275)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });

		const sl = getSlFromApi(api, "math");

		const target = { _a: 1, __b: 2, _c: 3 };
		// All keys start with '_' or '__' → all hit line 275 (continue) → count stays 0
		const count = sl.handlers.apiCacheManager._countPaths(target);
		expect(count).toBe(0);
	});

	it("_countPaths recurses into nested objects and skips underscore keys there too (line 275)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });

		const sl = getSlFromApi(api, "math");

		const nested = { _hidden: () => {}, visible: () => {} };
		const target = { pub: nested, _skip: { x: 1 } };

		// top-level: 'pub' counts (1), '_skip' hits line 275 (skipped)
		// recurse into nested: 'visible' counts (+1), '_hidden' hits line 275 (skipped)
		// total: 2
		const count = sl.handlers.apiCacheManager._countPaths(target);
		expect(count).toBe(2);
	});
});
