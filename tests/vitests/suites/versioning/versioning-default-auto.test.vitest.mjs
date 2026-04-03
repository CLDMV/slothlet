/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-default-auto.test.vitest.mjs
 *	@Date: 2026-04-01 22:41:55 -07:00 (1775108515)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:49 -07:00 (1775108929)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Default version auto-selection — no explicit default set,
 * semver algorithm should pick the highest version.
 *
 * @module tests/vitests/suites/versioning/versioning-default-auto
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > Default Auto > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("selects v2 as default when no explicit default is set (v2 > v1)", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		// Register v1 first, then v2 — neither marked as default
		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		const info = api.slothlet.versioning.list("auth");
		expect(info.default).toBe("v2");
	});

	it("unversioned caller uses auto-selected default (highest version)", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			versionDispatcher: () => null // always fall through to default
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		// Should route to v2 (auto-selected default)
		const result = api.unversionedCaller.callLogin("testUser");
		expect(result.version).toBe("v2");
	});

	it("handles numeric prefix versions — picks highest", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v8" });

		const info = api.slothlet.versioning.list("auth");
		// v8 > v1 numerically
		expect(info.default).toBe("v8");
	});
});
