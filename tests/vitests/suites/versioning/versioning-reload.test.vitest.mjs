/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-reload.test.vitest.mjs
 *	@Date: 2026-04-01 22:43:31 -07:00 (1775108611)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:49 -07:00 (1775108929)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Versioning reload — after a versioned module is reloaded,
 * the dispatcher still routes correctly.
 *
 * @module tests/vitests/suites/versioning/versioning-reload
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > Reload > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("dispatcher routes correctly after module reload", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			versionDispatcher: () => null // always use default
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		// Verify initial routing
		const before = api.unversionedCaller.callLogin("testUser");
		expect(before.version).toBe("v1");

		// Get the moduleID for v1.auth and reload it
		const list = api.slothlet.versioning.list("auth");
		const v1ModuleID = list.versions.v1?.moduleID;
		expect(v1ModuleID).toBeDefined();

		await api.slothlet.api.reload(v1ModuleID);

		// Routing should still work after reload
		const after = api.unversionedCaller.callLogin("testUser");
		expect(after.version).toBe("v1");
	});

	it("version list is intact after reload", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		const list = api.slothlet.versioning.list("auth");
		const v1ID = list.versions.v1?.moduleID;

		await api.slothlet.api.reload(v1ID);

		const listAfter = api.slothlet.versioning.list("auth");
		expect(Object.keys(listAfter.versions)).toHaveLength(2);
		expect(listAfter.default).toBe("v1");
	});
});
