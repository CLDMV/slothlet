/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/versioning/versioning-remove-all.test.vitest.mjs
 *	@Date: 2026-04-01T22:43:19-07:00 (1775108599)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:17-08:00 (1795869197)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Remove all versions — after unregistering every version,
 * the dispatcher is torn down and the logical path is gone.
 *
 * @module tests/vitests/suites/versioning/versioning-remove-all
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > Remove All > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("removes dispatcher when all versions are unregistered", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, { version: { tag: "v1" } });
		await api.slothlet.api.add("auth", `${BASE}/v2`, { version: { tag: "v2" } });

		expect(api.auth).toBeDefined();

		// Remove all
		await api.slothlet.versioning.remove("auth", "v1");
		await api.slothlet.versioning.remove("auth", "v2");

		// Dispatcher torn down — api.auth should be undefined
		expect(api.auth).toBeUndefined();
	});

	it("version.list returns undefined when all versions are unregistered", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, { version: { tag: "v1" } });

		await api.slothlet.versioning.remove("auth", "v1");

		// After teardown the path is removed from the registry entirely;
		// list() returns undefined (not { default: null }) for unknown paths.
		const info = api.slothlet.versioning.list("auth");
		expect(info).toBeUndefined();
	});
});
