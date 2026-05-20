/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-builtin-allow.test.vitest.mjs
 *	@Date: 2026-05-19 12:00:00 -07:00 (1779217200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-19 12:00:00 -07:00 (1779217200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Built-in Allow (lockCaller / bind) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("slothlet.lockCaller and slothlet.bind are allowed under defaultPolicy deny with no rules", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: { defaultPolicy: "deny" }
		});

		const global = api.slothlet.permissions.global;
		expect(global.checkAccess("anyModule", "slothlet.lockCaller")).toBe(true);
		expect(global.checkAccess("anyModule", "slothlet.bind")).toBe(true);
	});

	it("other slothlet.* routes stay denied under defaultPolicy deny", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: { defaultPolicy: "deny" }
		});

		const global = api.slothlet.permissions.global;
		// The built-in allows are scoped to lockCaller/bind only — nothing else is carved out.
		expect(global.checkAccess("anyModule", "slothlet.api.add")).toBe(false);
		expect(global.checkAccess("anyModule", "slothlet.permissions.control.enable")).toBe(false);
	});

	it("a more specific user deny rule still overrides the built-in lockCaller allow", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [{ caller: "untrusted.plugin", target: "slothlet.lockCaller", effect: "deny" }]
			}
		});

		const global = api.slothlet.permissions.global;
		// Exact caller + exact target outranks the built-in `**` → lockCaller allow.
		expect(global.checkAccess("untrusted.plugin", "slothlet.lockCaller")).toBe(false);
		// Other callers are unaffected — the built-in allow still applies.
		expect(global.checkAccess("trusted.module", "slothlet.lockCaller")).toBe(true);
	});
});
