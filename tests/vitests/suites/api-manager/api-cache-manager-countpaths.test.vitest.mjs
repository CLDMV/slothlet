/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-cache-manager-countpaths.test.vitest.mjs
 *	@Date: 2026-03-03T00:00:00-08:00 (1772524800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T09:16:49-07:00 (1791821809)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
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
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

let api;

afterEach(async () => {
	await api?.shutdown().catch(() => {});
	api = null;
});

// ─── _countPaths — reserved-name skip ────────────────────────────────────────

describe("ApiCacheManager._countPaths — framework-reserved key guard", () => {
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

	it("_countPaths counts a module's _/__-prefixed members and skips the framework's reserved names", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, silent: true });

		const sl = getSlFromApi(api, "math");
		expect(sl).toBeDefined();
		expect(sl.handlers.apiCacheManager).toBeDefined();

		const target = {
			publicA: () => {},
			_privateB: () => {},
			__modulePrivateC: () => {},
			__impl: () => {},
			_materialize: () => {}
		};

		// publicA, _privateB and __modulePrivateC are members; __impl and _materialize are the framework's.
		const count = sl.handlers.apiCacheManager._countPaths(target);
		expect(count).toBe(3);
	});

	it("_countPaths returns 0 for an object holding only framework-reserved names", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, silent: true });

		const sl = getSlFromApi(api, "math");

		const target = { __impl: 1, ____slothletInternal: 2, _materialize: 3 };
		const count = sl.handlers.apiCacheManager._countPaths(target);
		expect(count).toBe(0);
	});

	it("_countPaths recurses into nested objects and applies the same rule there", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, silent: true });

		const sl = getSlFromApi(api, "math");

		const nested = { _member: () => {}, __impl: () => {}, visible: () => {} };
		const target = { pub: nested, __filePath: { x: 1 } };

		// top level: pub counts (1), __filePath is framework metadata (skipped)
		// nested: _member and visible count (+2), __impl is skipped
		const count = sl.handlers.apiCacheManager._countPaths(target);
		expect(count).toBe(3);
	});
});
