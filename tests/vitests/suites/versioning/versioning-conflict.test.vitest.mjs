/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-conflict.test.vitest.mjs
 *	@Date: 2026-04-01 22:44:20 -07:00 (1775108660)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:49 -07:00 (1775108929)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Version conflict — registering the same version tag twice
 * should throw VERSION_REGISTER_DUPLICATE.
 *
 * @module tests/vitests/suites/versioning/versioning-conflict
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("Versioning > Conflict > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("throws VERSION_REGISTER_DUPLICATE when registering same version twice", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" });

		// Second registration of same version tag should throw
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1" })
			).rejects.toThrow();
		});
	});

	it("throws INVALID_CONFIG_VERSION_TAG for non-string version", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: 123 })
			).rejects.toThrow();
		});
	});

	it("throws INVALID_CONFIG_VERSION_DISPATCHER for non-string non-function versionDispatcher", async () => {
		// api is intentionally not assigned; slothlet rejects before creating an instance
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				slothlet({ ...config, dir: `${BASE}/callers`, versionDispatcher: 42 })
			).rejects.toThrow();
		});
	});
});
