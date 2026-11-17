/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-error-self-modify.test.vitest.mjs
 *	@Date: 2026-04-14T17:19:49-07:00 (1776212389)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:29:49-08:00 (1794882589)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Error Self Modify > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("rules.remove returns true when removing a rule without an owner (public API path)", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/payments`,
			permissions: {
				policy: "allow"
			}
		});

		// api.slothlet.permissions.rules.add always registers with ownerModuleID=null,
		// so the self-modify guard (callerModuleID && ownerModuleID && match) never fires
		// through the public API surface — it requires module-internal rule ownership.
		// This test confirms the happy-path rules.remove works correctly.
		const ruleId = api.slothlet.permissions.rules.add({
			caller: "untrusted.**",
			target: "payments.**",
			effect: "deny"
		});

		const result = api.slothlet.permissions.rules.remove(ruleId);
		expect(result).toBe(true);
	});
});
