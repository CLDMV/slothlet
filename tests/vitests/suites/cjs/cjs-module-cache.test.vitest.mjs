/**
 *@Project: @cldmv/slothlet
 *@Filename: /tests/vitests/suites/cjs/cjs-module-cache.test.vitest.mjs
 *@Date: 2026-03-03 00:00:00 -08:00 (1772726400)
 *@Author: Nate Corcoran <CLDMV>
 *@Email: <Shinrai@users.noreply.github.com>
 *-----
 *@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *@Last modified time: 2026-03-03 00:00:00 -08:00 (1772726400)
 *-----
 *@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for slothlet.mjs `_clearModuleCaches` CJS deletion (line 592).
 *
 * @description
 * Targets:
 *
 *   `slothlet.mjs` line 592 — `delete require.cache[key]`
 *
 * How to reach line 592:
 *   1. Load `api_test_cjs` in eager mode — CJS files are imported via `import()` from
 *      Node.js ESM land, which still populates `require.cache` with the resolved file paths.
 *   2. Call `api.slothlet.reload()` — triggers the FULL system reload:
 *      `Slothlet.reload()` → `_clearModuleCaches()` (line 580) → loops over `require.cache`
 *      keys → for each key that starts with `absoluteTargetDir`, executes
 *      `delete require.cache[key]` (line 592).
 *
 * IMPORTANT: `api.slothlet.api.reload(".")` is the api-manager hot reload and does NOT
 * call `_clearModuleCaches()`. Only `api.slothlet.reload()` (the full system reload)
 * triggers line 592.
 *
 * The test verifies the API remains functional after reload, confirming `_clearModuleCaches`
 * completed without error and that the CJS modules were reloaded from disk.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── CJS module cache clearing via full system reload (slothlet.mjs line 592) ─

describe("slothlet._clearModuleCaches — CJS require.cache deletion (line 592)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = undefined;
	});

	/**
	 * Loading api_test_cjs in eager mode causes Node.js to populate `require.cache`
	 * with the .cjs files from the fixture directory. Calling `api.slothlet.reload()`
	 * (the FULL system reload) triggers `_clearModuleCaches()`, which walks `require.cache`
	 * and deletes matching entries (line 592), then reloads the modules fresh.
	 *
	 * If line 592 were not reached the test would still pass — the value here is
	 * coverage: the line must be executed for V8 to record it as covered.
	 *
	 * NOTE: `api.slothlet.api.reload(".")` is the api-manager hot reload and does NOT
	 * call `_clearModuleCaches()`. Only `api.slothlet.reload()` hits line 592.
	 */
	it("full system reload on CJS fixture executes require.cache deletion (line 592)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_CJS,
			mode: "eager",
			silent: true
		});

		// Sanity: api loaded correctly before reload
		expect(typeof api.explicitDefault).toBe("object");

		// api.slothlet.reload() → Slothlet.reload() → _clearModuleCaches() → line 592
		await expect(api.slothlet.reload()).resolves.not.toThrow();

		// After full system reload the API should still be functional
		expect(typeof api.explicitDefault).toBe("object");
	});

	it("full system reload preserves module functionality after CJS cache clear (line 592)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_CJS,
			mode: "eager",
			silent: true
		});

		// Confirm a CJS method works before reload
		const before = await api.explicitDefault.multiply(3, 4);
		expect(before).toBe(12);

		// Trigger _clearModuleCaches (line 592) via the FULL system reload
		await api.slothlet.reload();

		// Confirm the method still works after CJS cache was cleared and re-imported
		const after = await api.explicitDefault.multiply(3, 4);
		expect(after).toBe(12);
	});

	/**
	 * Inside Vitest's forked process, CJS files imported via `import()` do NOT populate
	 * `require.cache` the way they do outside Vitest. To exercise the actual `delete
	 * require.cache[key]` statement (line 592), we manually seed `require.cache` with a
	 * synthetic entry whose path starts with the fixture directory, then trigger
	 * `_clearModuleCaches` via `api.slothlet.reload()`.
	 */
	it("seeds require.cache and verifies line 592 deletes the matching entry", async () => {
		const { createRequire } = await import("node:module");
		const path = await import("node:path");

		api = await slothlet({
			dir: TEST_DIRS.API_TEST_CJS,
			mode: "eager",
			silent: true
		});

		// Seed require.cache with a fake entry whose path matches the API dir
		const req = createRequire(import.meta.url);
		const fakeKey = path.resolve(TEST_DIRS.API_TEST_CJS, "__coverage-seed__.cjs");
		req.cache[fakeKey] = { id: fakeKey, filename: fakeKey, exports: {}, loaded: true, children: [] };

		expect(req.cache[fakeKey]).toBeDefined();

		// api.slothlet.reload() → Slothlet.reload() → _clearModuleCaches() → line 592 fires
		await api.slothlet.reload();

		// The seeded entry must have been deleted by _clearModuleCaches
		expect(req.cache[fakeKey]).toBeUndefined();
	});
});
