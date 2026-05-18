/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-cache-invalidation.test.vitest.mjs
 *	@Date: 2026-05-16T00:00:00-07:00 (1779001200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-16 00:00:00 -07:00 (1779001200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview `apiCacheManager` is invalidated when a module is removed.
 *
 * A cache entry is only valid while the module it describes is mounted. When a
 * module is fully removed — by apiPath or by moduleID, directly or via the
 * operation-history replay of a reload — its cache entry must be dropped, or
 * targeted reload would rebuild from data for a module that no longer exists.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";

const ADD_DIR = "./api_tests/api_test_self_assign";

describe("apiCacheManager invalidation on removal", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	it("api.remove(apiPath) drops the removed module's cache entry (no orphan)", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager", diagnostics: true });

		const baseCount = api.slothlet.diag.caches.getAllModuleIDs().length;

		await api.slothlet.api.add("extras", ADD_DIR, { moduleID: "extras-mod" });
		expect(api.slothlet.diag.caches.getAllModuleIDs().length).toBe(baseCount + 1);

		// Remove BY apiPath — the branch that previously orphaned the cache entry.
		await api.slothlet.api.remove("extras");

		expect(api.slothlet.diag.caches.getAllModuleIDs().length).toBe(baseCount);
		expect(api.extras).toBeUndefined();
	});

	it("api.remove(moduleID) drops the cache entry", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager", diagnostics: true });

		const baseCount = api.slothlet.diag.caches.getAllModuleIDs().length;

		await api.slothlet.api.add("extras", ADD_DIR, { moduleID: "extras-mod" });
		expect(api.slothlet.diag.caches.getAllModuleIDs().length).toBe(baseCount + 1);

		await api.slothlet.api.remove("extras-mod");

		expect(api.slothlet.diag.caches.getAllModuleIDs().length).toBe(baseCount);
	});

	it("reload after a remove leaves no orphaned cache entry", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager", diagnostics: true });

		const baseCount = api.slothlet.diag.caches.getAllModuleIDs().length;

		await api.slothlet.api.add("extras", ADD_DIR, { moduleID: "extras-mod" });
		await api.slothlet.api.remove("extras");
		await api.slothlet.reload();

		// The operation-history replay re-adds then removes "extras"; the
		// replayed remove must fully clean up — no orphan cache entry survives.
		expect(api.slothlet.diag.caches.getAllModuleIDs().length).toBe(baseCount);
		expect(api.extras).toBeUndefined();
	});

	it("a partial removal keeps the cache entry (module still owns paths)", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager", diagnostics: true });

		const baseCount = api.slothlet.diag.caches.getAllModuleIDs().length;

		// api_test_self_assign exposes the `owner` module under "extras.owner".
		await api.slothlet.api.add("extras", ADD_DIR, { moduleID: "extras-mod" });
		expect(api.slothlet.diag.caches.getAllModuleIDs().length).toBe(baseCount + 1);

		// Remove only a sub-path; the module still owns the rest of "extras.*".
		await api.slothlet.api.remove("extras.owner.readSelf");

		// Cache entry retained — the module is not fully removed.
		expect(api.slothlet.diag.caches.getAllModuleIDs().length).toBe(baseCount + 1);
	});
});
