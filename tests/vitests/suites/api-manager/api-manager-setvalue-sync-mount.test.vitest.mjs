/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-setvalue-sync-mount.test.vitest.mjs
 *	@Date: 2026-10-11T12:53:56-07:00 (1791748436)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T17:01:54-07:00 (1791763314)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A nested mount through loaded nodes lands before `setValueAtPath` yields (#580 review).
 *
 * @description
 * The version manager mounts a dispatcher with `setValueAtPath` and does not await it, relying on the
 * mount landing synchronously when every node on the path is already there. Only a path with a segment
 * a wrapper answers itself (`name`, `length`, …) needs its nodes loaded first, so only such a path waits.
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe("setValueAtPath on a nested path through loaded nodes", () => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("mounts before it yields", async () => {
		api = await slothlet({ mode: "eager", base: TEST_DIRS.API_TEST, silent: true });
		const apiManager = resolveWrapper(api.math).slothlet.handlers.apiManager;
		const pending = apiManager.setValueAtPath(api, ["math", "extra"], () => "extra", {
			collisionMode: "replace",
			moduleID: "test:extra",
			allowOverwrite: true,
			mutateExisting: false
		});
		expect(typeof api.math.extra).toBe("function");
		await pending;
	});
});
