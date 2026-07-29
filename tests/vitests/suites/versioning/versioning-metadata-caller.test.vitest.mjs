/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-metadata-caller.test.vitest.mjs
 *	@Date: 2026-04-01 22:44:38 -07:00 (1775108678)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:49 -07:00 (1775108929)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Version metadata isolation — metadata.caller() returns only regular
 * metadata, never version metadata. VersionManager metadata is kept separate.
 *
 * @module tests/vitests/suites/versioning/versioning-metadata-caller
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > Metadata Caller > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("versionConfig.metadata does not appear in the path's metadata", async () => {
		const hookFirings = [];

		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			hook: { enabled: true }
		});

		await api.slothlet.api.add(
			"auth",
			`${BASE}/v1`,
			{ metadata: { regularField: "hello" } },
			{ version: "v1", default: true, metadata: { versionField: "secret" } }
		);

		api.slothlet.hook.on("v1.auth.login:before", (ctx) => {
			hookFirings.push(ctx);
		});

		api.v1.auth.login("testUser");

		// The hook pattern names the path the caller invokes, so it has to fire. This previously
		// matched nothing — the mount pathed its leaves as `v1.auth.auth.login` while the api only
		// ever exposed `v1.auth.login` — which also left the separation below unasserted, since it
		// sat behind a "captured anything?" guard that was never true.
		expect(hookFirings).toHaveLength(1);

		// The separation itself, asserted against the metadata API rather than the hook context:
		// a hook handler receives `{ path, args, api, ctx }` and never carried a `metadata` key.
		const meta = await api.slothlet.metadata.get("v1.auth.login");
		// options.metadata is caller-visible …
		expect(meta).toHaveProperty("regularField", "hello");
		// … versionConfig.metadata belongs to the VersionManager and must not leak into it.
		expect(meta).not.toHaveProperty("versionField");
	});

	it("getVersionMetadata returns versionConfig.metadata not options.metadata", async () => {
		api = await slothlet({ ...config, base: `${BASE}/callers` });

		await api.slothlet.api.add(
			"auth",
			`${BASE}/v1`,
			{ metadata: { regularField: "options-meta" } },
			{ version: "v1", default: true, metadata: { tier: "beta", versionSpecific: true } }
		);

		const versionMeta = api.slothlet.versioning.getVersionMetadata("auth", "v1");

		// versionMeta should have versionConfig.metadata fields
		expect(versionMeta).toHaveProperty("tier", "beta");
		expect(versionMeta).toHaveProperty("versionSpecific", true);
		// Should NOT have the options.metadata fields
		expect(versionMeta).not.toHaveProperty("regularField");
	});
});
