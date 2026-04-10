/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-routing.test.vitest.mjs
 *	@Date: 2026-04-01 22:41:41 -07:00 (1775108501)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:49 -07:00 (1775108929)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Versioning routing — verify callers with version metadata route correctly.
 *
 * Uses `versionDispatcher` function that reads caller.metadata.callerVersion.
 * Verifies: v1 caller → v1 impl, v2 caller → v2 impl.
 *
 * @module tests/vitests/suites/versioning/versioning-routing
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > Routing > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("routes caller with v2 version metadata to v2 impl", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			versionDispatcher: (allVersions, caller) => caller.metadata?.callerVersion ?? null
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		// Tag the v2-caller with callerVersion "v2" via regular metadata
		api.slothlet.metadata.setFor("v2Caller", { callerVersion: "v2" });

		const result = await api.v2Caller.callLogin("testUser", "pass");
		expect(result.version).toBe("v2");
		expect(result.user).toBe("testUser");
	});

	it("routes caller with v1 version metadata to v1 impl", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			versionDispatcher: (allVersions, caller) => caller.metadata?.callerVersion ?? null
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		// Tag v1-caller with callerVersion "v1"
		api.slothlet.metadata.setFor("v1Caller", { callerVersion: "v1" });

		const result = await api.v1Caller.callLogin("testUser");
		expect(result.version).toBe("v1");
		expect(result.user).toBe("testUser");
	});

	it("routes via string discriminator using caller versionMetadata.version", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers`, versionDispatcher: "version" });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		// Register v2Caller as a versioned module so it gets version metadata
		await api.slothlet.api.add("vCaller", `${BASE}/callers/v2-caller.mjs`, {}, { version: "v2" });

		// Call through the versioned path — caller has versionMetadata.version = "v2"
		const result = api.v2.vCaller.callLogin("alice", "secret");
		expect(result.version).toBe("v2");
	});
});
