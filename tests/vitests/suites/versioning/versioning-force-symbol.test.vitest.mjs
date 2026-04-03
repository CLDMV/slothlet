/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-force-symbol.test.vitest.mjs
 *	@Date: 2026-04-01 22:44:08 -07:00 (1775108648)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:49 -07:00 (1775108929)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Force version symbol — context[Symbol.for("slothlet.versioning.force")]
 * should override the discriminator entirely.
 *
 * @module tests/vitests/suites/versioning/versioning-force-symbol
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

const FORCE_VERSION = Symbol.for("slothlet.versioning.force");

describe.each(getMatrixConfigs())("Versioning > Force Symbol > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("forced version overrides discriminator", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			versionDispatcher: () => "v2" // would normally route to v2
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		// Without force — discriminator returns v2
		const withoutForce = api.unversionedCaller.callLogin("testUser");
		expect(withoutForce.version).toBe("v2");

		// With force = "v1" in context — should override discriminator
		let forcedResult;
		await api.slothlet.context.run({ [FORCE_VERSION]: "v1" }, async () => {
			forcedResult = api.unversionedCaller.callLogin("testUser");
		});
		expect(forcedResult.version).toBe("v1");
	});

	it("forced version to unknown tag falls back to discriminator", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			versionDispatcher: () => null
		});

		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		// Force to a non-existent version — should fall back to default
		let result;
		await api.slothlet.context.run({ [FORCE_VERSION]: "v99" }, async () => {
			result = api.unversionedCaller.callLogin("testUser");
		});
		// Falls back to default (v1)
		expect(result.version).toBe("v1");
	});
});
