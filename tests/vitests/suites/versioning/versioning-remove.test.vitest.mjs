/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-remove.test.vitest.mjs
 *	@Date: 2026-04-01 22:43:03 -07:00 (1775108583)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-18 09:15:34 -0700 (1781799334)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Remove a version — verify dispatcher falls back to remaining version
 * after one is removed, and the removed versioned namespace is gone. Also covers
 * removeApiComponent's versioned delete-by-path branch (api-manager L~2244-2254):
 * removing a versioned module by its logical API path must unregister the version key
 * and tear down the dispatcher.
 *
 * @module tests/vitests/suites/versioning/versioning-remove
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > Remove > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("after removing v2, dispatcher falls back to v1 and api.v2.auth is gone", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			versionDispatcher: () => null // always fall to default
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		// Both exist before removal
		expect(api.v1.auth).toBeDefined();
		expect(api.v2.auth).toBeDefined();
		expect(api.auth).toBeDefined();

		// Remove v2
		await api.slothlet.versioning.unregister("auth", "v2");

		// v2 namespace should be gone
		expect(api.v2).toBeUndefined();

		// v1 still exists
		expect(api.v1.auth).toBeDefined();

		// Dispatcher still exists and now defaults to v1
		expect(api.auth).toBeDefined();
		const result = api.unversionedCaller.callLogin("testUser");
		expect(result.version).toBe("v1");
	});

	it("version list reflects removal", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		expect(Object.keys(api.slothlet.versioning.list("auth").versions)).toHaveLength(2);

		await api.slothlet.versioning.unregister("auth", "v2");

		const info = api.slothlet.versioning.list("auth");
		expect(Object.keys(info.versions)).toHaveLength(1);
		expect(info.versions).toHaveProperty("v1");
		expect(info.versions).not.toHaveProperty("v2");
	});

	it("remove by logical path unregisters version key and tears down dispatcher (api-manager L~2244-2254)", async () => {
		// Covers removeApiComponent's versioned delete-by-path branch: when a versioned module
		// is removed via api.slothlet.api.remove(<logicalPath>), the versionManager cleanup
		// block fires — getVersionKeyForModule finds the version key, unregisterVersion removes
		// it, and teardownDispatcher clears the dispatcher proxy.
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });

		// Before removal: dispatcher and version registry are live
		expect(api.auth).toBeDefined();
		expect(api.slothlet.versioning.list("auth")).toBeDefined();

		// Remove by logical path — exercises the apiPath branch of removeApiComponent
		// with a versionManager in play (L~2244-2254)
		const result = await api.slothlet.api.remove("auth");

		expect(result).toBe(true);
		// Dispatcher torn down — logical path is gone
		expect(api.auth).toBeUndefined();
		// Version registry cleared — list returns undefined for an unknown path
		expect(api.slothlet.versioning.list("auth")).toBeUndefined();
	});
});
