/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-fn-discriminator.test.vitest.mjs
 *	@Date: 2026-04-01 22:42:48 -07:00 (1775108568)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:49 -07:00 (1775108929)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Function discriminator — verify the allVersions and caller argument
 * shapes passed to the discriminator function.
 *
 * @module tests/vitests/suites/versioning/versioning-fn-discriminator
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > Function Discriminator > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("discriminator receives correct allVersions shape", async () => {
		const receivedArgs = [];

		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			versionDispatcher: (allVersions, caller) => {
				receivedArgs.push({ allVersions, caller });
				return null; // fall to default
			}
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true, metadata: { stable: true } });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2", metadata: { stable: false } });

		// Trigger a dispatch
		api.unversionedCaller.callLogin("testUser");

		expect(receivedArgs.length).toBeGreaterThan(0);
		const { allVersions } = receivedArgs[0];

		// allVersions has both registered tags
		expect(allVersions).toHaveProperty("v1");
		expect(allVersions).toHaveProperty("v2");

		// Each entry has version, default, metadata, versionMetadata fields
		expect(allVersions.v1).toHaveProperty("version", "v1");
		expect(allVersions.v1).toHaveProperty("default");
		expect(allVersions.v1).toHaveProperty("metadata");
		expect(allVersions.v1).toHaveProperty("versionMetadata");
		// versionMetadata comes from versionConfig.metadata { stable: true }
		expect(allVersions.v1.versionMetadata).toHaveProperty("stable", true);

		// metadata and versionMetadata are separate (not merged)
		expect(allVersions.v1.versionMetadata).not.toHaveProperty("apiPath");
	});

	it("discriminator receives correct caller shape", async () => {
		let capturedCaller = null;

		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			versionDispatcher: (allVersions, caller) => {
				capturedCaller = caller;
				return "v1";
			}
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		api.unversionedCaller.callLogin("testUser");

		expect(capturedCaller).not.toBeNull();
		// caller has the 4 fields
		expect(capturedCaller).toHaveProperty("version");
		expect(capturedCaller).toHaveProperty("default");
		expect(capturedCaller).toHaveProperty("metadata");
		expect(capturedCaller).toHaveProperty("versionMetadata");
		// unversionedCaller has no version metadata → null
		expect(capturedCaller.version).toBeNull();
		expect(capturedCaller.versionMetadata).toBeNull();
	});

	it("function discriminator can route based on caller regular metadata", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			versionDispatcher: (allVersions, caller) => caller.metadata?.targetVersion ?? null
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		api.slothlet.metadata.setFor("v2Caller", { targetVersion: "v2" });

		const result = api.v2Caller.callLogin("user", "pass");
		expect(result.version).toBe("v2");
	});
});
