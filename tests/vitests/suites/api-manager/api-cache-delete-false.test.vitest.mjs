/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-cache-delete-false.test.vitest.mjs
 *	@Date: 2026-03-03 16:00:00 -08:00 (1772726400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 16:00:00 -08:00 (1772726400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for ApiCacheManager.delete() false branch (line 192).
 *
 * @description
 * The delete method:
 *   ```javascript
 *   delete(moduleID) {
 *       const deleted = this.caches.delete(moduleID);
 *       if (deleted) {          // ← line 192 — FALSE branch: moduleID not in map
 *           this.slothlet.debug("cache", { ... });
 *       }
 *       return deleted;
 *   }
 *   ```
 * The false branch fires when `this.caches.delete(moduleID)` returns `false`
 * because `moduleID` is not present in the internal Map. Accessing the cache
 * manager via `sl.handlers.apiCacheManager` and passing an unknown key triggers
 * this branch.
 *
 * @module tests/vitests/suites/api-manager/api-cache-delete-false
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

let api;

afterEach(async () => {
	if (api) {
		await api.slothlet.shutdown();
		api = null;
	}
});

/**
 * Retrieve the internal Slothlet instance from the API proxy.
 *
 * @param {object} apiProxy - Live slothlet API proxy.
 * @param {string} [prop="math"] - A property that has a unified wrapper.
 * @returns {object} Internal Slothlet instance.
 *
 * @example
 * const sl = getSlInstance(api);
 * sl.handlers.apiCacheManager.delete("x");
 */
function getSlInstance(apiProxy, prop = "math") {
	const wrapper = resolveWrapper(apiProxy[prop]);
	if (!wrapper) throw new Error(`resolveWrapper(api.${prop}) returned null`);
	return wrapper.slothlet;
}

// ─── ApiCacheManager.delete — false branch (line 192) ────────────────────────

describe("ApiCacheManager.delete — if(deleted) false branch for non-existent key (line 192)", () => {
	it("returns false and skips debug log when moduleID not in cache (line 192 false branch)", async () => {
		api = await slothlet({
			mode: "eager",
			runtime: "async",
			dir: TEST_DIRS.API_TEST,
			api: { collision: { initial: "replace", api: "replace" } }
		});

		const sl = getSlInstance(api);
		const cacheManager = sl.handlers.apiCacheManager;

		// Deleting a moduleID that was never registered in the cache returns false
		// and skips the debug log block (line 192 false branch)
		const result = cacheManager.delete("__non_existent_module_id_coverage_test__");

		expect(result).toBe(false);
	});

	it("returns true and runs the debug branch when a real moduleID is deleted", async () => {
		api = await slothlet({
			mode: "eager",
			runtime: "async",
			dir: TEST_DIRS.API_TEST,
			api: { collision: { initial: "replace", api: "replace" } }
		});

		const sl = getSlInstance(api);
		const cacheManager = sl.handlers.apiCacheManager;

		// Confirm at least one module ID is registered
		const moduleIds = cacheManager.getAllModuleIDs();
		expect(moduleIds.length).toBeGreaterThan(0);

		// Deleting a real entry returns true and fires the debug branch
		const firstId = moduleIds[0];
		const result = cacheManager.delete(firstId);

		expect(result).toBe(true);
	});
});
