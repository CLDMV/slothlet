/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-default-explicit.test.vitest.mjs
 *	@Date: 2026-04-01 22:42:07 -07:00 (1775108527)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:49 -07:00 (1775108929)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Explicit default version — when default:true is set on v1,
 * it should override the auto-selection algorithm even though v2 is higher.
 *
 * @module tests/vitests/suites/versioning/versioning-default-explicit
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > Default Explicit > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("explicit default:true on v1 wins over higher v2", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		// v1 is explicitly marked as default — should win over v2
		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		const info = api.slothlet.versioning.list("auth");
		expect(info.default).toBe("v1");
	});

	it("unversioned caller routes to explicit default v1", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			versionDispatcher: () => null // always fall through to default
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		// Unversioned caller falls back to default (v1)
		const result = api.unversionedCaller.callLogin("testUser");
		expect(result.version).toBe("v1");
	});

	it("setDefault can change default at runtime", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		expect(api.slothlet.versioning.list("auth").default).toBe("v1");

		// Change default to v2
		api.slothlet.versioning.setDefault("auth", "v2");

		expect(api.slothlet.versioning.list("auth").default).toBe("v2");
	});
});
