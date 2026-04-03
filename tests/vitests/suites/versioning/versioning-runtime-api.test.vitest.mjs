/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-runtime-api.test.vitest.mjs
 *	@Date: 2026-04-01 22:43:53 -07:00 (1775108633)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:49 -07:00 (1775108929)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Runtime API — test api.slothlet.versioning.list, setDefault,
 * unregister, and getVersionMetadata.
 *
 * @module tests/vitests/suites/versioning/versioning-runtime-api
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > Runtime API > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("version.list returns correct structure", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true, metadata: { stable: true } });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2", metadata: { stable: false } });

		const info = api.slothlet.versioning.list("auth");

		expect(info).toHaveProperty("versions");
		expect(info).toHaveProperty("default", "v1");
		expect(Object.keys(info.versions)).toHaveLength(2);

		const v1entry = info.versions.v1;
		expect(v1entry).toHaveProperty("versionTag", "v1");
		expect(v1entry).toHaveProperty("moduleID");
		expect(v1entry).toHaveProperty("isDefault", true);
		expect(v1entry).toHaveProperty("versionedPath", "v1.auth");
	});

	it("version.setDefault changes the default", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		expect(api.slothlet.versioning.list("auth").default).toBe("v1");
		api.slothlet.versioning.setDefault("auth", "v2");
		expect(api.slothlet.versioning.list("auth").default).toBe("v2");
	});

	it("version.getVersionMetadata returns stored metadata", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", metadata: { stable: true, tier: "ga" } });

		const info = api.slothlet.versioning.list("auth");
		const v1ModuleID = info.versions.v1.moduleID;

		const meta = api.slothlet.versioning.getVersionMetadata(v1ModuleID);
		expect(meta).toHaveProperty("version", "v1"); // auto-injected
		expect(meta).toHaveProperty("stable", true);
		expect(meta).toHaveProperty("tier", "ga");
	});

	it("version.unregister removes a version and updates list", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		const result = await api.slothlet.versioning.unregister("auth", "v2");
		expect(result).toBe(true);

		const info = api.slothlet.versioning.list("auth");
		expect(Object.keys(info.versions)).toHaveLength(1);
		expect(info.versions).toHaveProperty("v1");
	});

	it("version.list returns undefined for unknown path", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		const info = api.slothlet.versioning.list("nonexistent");
		expect(info).toBeUndefined();
	});
});
