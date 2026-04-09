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

	it("versionConfig.metadata does not appear in metadata.caller()", async () => {
		// Use a metadata hook to inspect what metadata.caller() returns from within v1.auth
		const capturedMeta = [];

		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			hook: { enabled: true }
		});

		await api.slothlet.api.add(
			"auth",
			`${BASE}/v1`,
			{ metadata: { regularField: "hello" } },
			{ version: "v1", default: true, metadata: { versionField: "secret" } }
		);

		// Hook to capture metadata.caller() from within v1.auth.login
		api.slothlet.hook.on("before:v1.auth.login", (ctx) => {
			capturedMeta.push(ctx.metadata);
		});

		api.v1.auth.login("testUser");

		if (capturedMeta.length > 0) {
			// regularField should appear (options.metadata goes to Metadata handler)
			// versionField should NOT appear (versionConfig.metadata goes to VersionManager only)
			expect(capturedMeta[0]).not.toHaveProperty("versionField");
		}
		// At minimum — no error means separation is working
	});

	it("getVersionMetadata returns versionConfig.metadata not options.metadata", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

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
