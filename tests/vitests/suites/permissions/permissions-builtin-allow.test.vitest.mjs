/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-builtin-allow.test.vitest.mjs
 *	@Date: 2026-05-19T12:00:00-07:00 (1779217200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:15-07:00 (1791090915)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
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

	it("slothlet.pin and slothlet.bind are allowed under defaultPolicy deny with no rules", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: { defaultPolicy: "deny" }
		});

		const global = api.slothlet.permissions.global;
		expect(global.check.access("anyModule", "slothlet.pin")).toBe(true);
		expect(global.check.access("anyModule", "slothlet.bind")).toBe(true);
	});

	it("other slothlet.* routes stay denied under defaultPolicy deny", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: { defaultPolicy: "deny" }
		});

		const global = api.slothlet.permissions.global;
		// The built-in allows are scoped to pin/bind only — nothing else is carved out.
		expect(global.check.access("anyModule", "slothlet.api.add")).toBe(false);
		expect(global.check.access("anyModule", "slothlet.permissions.control.enable")).toBe(false);
	});

	it("a more specific user deny rule still overrides the built-in pin allow", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [{ caller: "untrusted.plugin", target: "slothlet.pin", effect: "deny" }]
			}
		});

		const global = api.slothlet.permissions.global;
		// Exact caller + exact target outranks the built-in `**` → pin allow.
		expect(global.check.access("untrusted.plugin", "slothlet.pin")).toBe(false);
		// Other callers are unaffected — the built-in allow still applies.
		expect(global.check.access("trusted.module", "slothlet.pin")).toBe(true);
	});
});
