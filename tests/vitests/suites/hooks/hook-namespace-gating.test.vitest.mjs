/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hook-namespace-gating.test.vitest.mjs
 *	@Date: 2026-11-15T12:00:00-08:00 (1794772800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T12:00:00-08:00 (1794772800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #821 — `api.slothlet.hook` exists only when hooks are enabled (or `diagnostics: true` is set).
 * The builder removed a key named `hooks` while the namespace is `hook`, so it was there with hooks off.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(["eager", "lazy"])("api.slothlet.hook follows the hook config (#821) > %s", (mode) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("is absent when hooks are off", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode });
		expect(api.slothlet.hook).toBeUndefined();
	});

	it("is absent for hook: false", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode, hook: false });
		expect(api.slothlet.hook).toBeUndefined();
	});

	it("is present when hooks are enabled", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode, hook: true });
		expect(typeof api.slothlet.hook.on).toBe("function");
	});

	it("is present with diagnostics even when hooks are off", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode, diagnostics: true });
		expect(typeof api.slothlet.hook.on).toBe("function");
	});
});
