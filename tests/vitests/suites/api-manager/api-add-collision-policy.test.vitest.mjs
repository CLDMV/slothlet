/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-add-collision-policy.test.vitest.mjs
 *	@Date: 2026-09-20T15:33:32+00:00 (1789918412)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:29:22-08:00 (1794882562)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #380 — api.add collisionMode / mutateExisting / recordHistory policy.
 *
 * These are init-time / internal policy, not per-call knobs. Locked by default: passing them to
 * api.add WARNS (was a silent strip) and the override is ignored — but the add still succeeds (a
 * throw could break a live app). Opt in with `api.mutations.allowCollisionOverride: true` to honor
 * them. `forceOverwrite` stays the always-available targeted escape hatch regardless of the flag.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST;
const ADDDIR = TEST_DIRS.API_TEST_MIXED;

/** Run `fn` while capturing the instance's SlothletWarnings (per instance, #819); return the captured warning codes. */
async function withCapturedWarnings(api, fn) {
	const Warning = api.slothlet.diag.SlothletWarning;
	const prev = Warning.suppressConsole;
	Warning.suppressConsole = true;
	Warning.clearCaptured();
	try {
		await fn();
		return Warning.captured.map((w) => w.code);
	} finally {
		Warning.clearCaptured();
		Warning.suppressConsole = prev;
	}
}

describe.each(getMatrixConfigs())("api.add collision-override policy (#380) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("locked by default: a per-call collisionMode warns and is ignored, but the add still succeeds (no throw)", async () => {
		api = await slothlet({ ...config, diagnostics: true, base: BASE });
		const codes = await withCapturedWarnings(api, () => api.slothlet.api.add("extLocked", ADDDIR, { collisionMode: "replace" }));
		expect(api.extLocked).toBeDefined(); // add succeeded despite the ignored override
		expect(codes).toContain("WARNING_COLLISION_OPTION_LOCKED");
	});

	it("mutateExisting and recordHistory are locked the same way", async () => {
		api = await slothlet({ ...config, diagnostics: true, base: BASE });
		const codes = await withCapturedWarnings(api, () =>
			api.slothlet.api.add("extInternal", ADDDIR, { mutateExisting: true, recordHistory: false })
		);
		expect(api.extInternal).toBeDefined();
		expect(codes).toContain("WARNING_COLLISION_OPTION_LOCKED");
	});

	it("silent suppresses the warning (still ignored, still succeeds)", async () => {
		api = await slothlet({ ...config, diagnostics: true, base: BASE, silent: true });
		const codes = await withCapturedWarnings(api, () => api.slothlet.api.add("extSilent", ADDDIR, { collisionMode: "replace" }));
		expect(api.extSilent).toBeDefined();
		expect(codes).not.toContain("WARNING_COLLISION_OPTION_LOCKED");
	});

	it("unlocked (allowCollisionOverride:true): collisionMode is honored with no warning", async () => {
		api = await slothlet({ ...config, diagnostics: true, base: BASE, api: { mutations: { allowCollisionOverride: true } } });
		const codes = await withCapturedWarnings(api, () => api.slothlet.api.add("extOverride", ADDDIR, { collisionMode: "replace" }));
		expect(api.extOverride).toBeDefined();
		expect(codes).not.toContain("WARNING_COLLISION_OPTION_LOCKED");
	});

	it("forceOverwrite is always honored regardless of the flag (never warns)", async () => {
		api = await slothlet({ ...config, diagnostics: true, base: BASE });
		const codes = await withCapturedWarnings(api, () => api.slothlet.api.add("extForce", ADDDIR, { forceOverwrite: true }));
		expect(api.extForce).toBeDefined();
		expect(codes).not.toContain("WARNING_COLLISION_OPTION_LOCKED");
	});
});
