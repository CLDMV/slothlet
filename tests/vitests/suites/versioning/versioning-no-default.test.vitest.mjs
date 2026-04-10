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
 * @fileoverview Fallback and teardown behavior when no version can be resolved.
 *
 * Covers two scenarios:
 *  1. Dispatcher teardown: when the last remaining version is unregistered the
 *     dispatcher is removed from the API tree entirely (api.auth becomes undefined).
 *     The VERSION_NO_DEFAULT error path inside the dispatcher is a defensive guard
 *     annotated v8-ignore because teardownDispatcher() makes it unreachable in
 *     normal usage.
 *  2. Default fallback: a discriminator that returns an unregistered tag causes the
 *     version resolution to fall through to the configured default version.
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

	it("tears down dispatcher when last version is unregistered", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			versionDispatcher: () => null // always fall through
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });

		// Dispatcher exists while the version is registered
		expect(api.auth).toBeDefined();

		// Remove the only version — VersionManager calls teardownDispatcher()
		await api.slothlet.versioning.unregister("auth", "v1");

		// Dispatcher is removed from the API tree; api.auth is now undefined.
		// (VERSION_NO_DEFAULT is a defensive guard inside the dispatcher's get trap
		// and is unreachable here because the proxy itself no longer exists.)
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
