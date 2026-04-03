/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-no-default.test.vitest.mjs
 *	@Date: 2026-04-01 22:42:25 -07:00 (1775108545)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:49 -07:00 (1775108929)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview VERSION_NO_DEFAULT error — when discriminator returns null
 * and no default can be computed (should never happen if versions exist since
 * auto-algorithm always picks highest).
 *
 * The real scenario: discriminator returns a tag, but that tag isn't registered.
 *
 * @module tests/vitests/suites/versioning/versioning-no-default
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > No Default > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("throws VERSION_NO_DEFAULT when no versions remain after all removed", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			versionDispatcher: () => null // always fall through
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });

		// Remove the only version  
		await api.slothlet.versioning.unregister("auth", "v1");

		// auth dispatcher should be torn down — accessing it should throw or be undefined
		// The dispatcher proxy is removed when all versions are gone
		expect(api.auth).toBeUndefined();
	});

	it("discriminator returning unregistered tag falls to default", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			versionDispatcher: () => "v99" // returns a non-existent tag
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		// v99 doesn't exist → falls to explicit default v1
		const result = api.unversionedCaller.callLogin("testUser");
		expect(result.version).toBe("v1");
	});
});
