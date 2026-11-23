/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-global-rules-path-suffixes.test.vitest.mjs
 *	@Date: 2026-11-22T00:00:00-08:00 (1795334400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T00:00:00-08:00 (1795334400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `permissions.global.rules.path()` lists every rule whose target reaches the path, whatever access level
 * or hook type the target names.
 * @description
 * A rule's target may carry a level suffix (`:call`, `:read`, `:access`, `:write`, `:full`) or a hook-type suffix
 * (`:before`, `:hook`, …). Each decides an access at the path its pattern names, so a listing of the rules for that path
 * includes it; a rule on another path does not appear.
 * @module tests/vitests/suites/permissions/permissions-global-rules-path-suffixes
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

/** A rule on `vault.secret` at every level and for hooks, plus wildcard forms. */
const ON_SECRET = [
	"vault.secret",
	"vault.secret:call",
	"vault.secret:read",
	"vault.secret:access",
	"vault.secret:full",
	"vault.secret:write",
	"vault.secret:before",
	"vault.secret:hook",
	"vault.**:call",
	"vault.*:write"
];

/** Rules on other paths, at the same levels. */
const ELSEWHERE = ["vault.other", "vault.other:call", "vault.other:write", "vault.other:before", "other.**:full"];

describe.each(getMatrixConfigs())("Permissions > global.rules.path with level and hook suffixes > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("lists every rule whose target pattern reaches the path, and none on another path", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/payments`,
			permissions: {
				policy: "allow",
				rules: [...ON_SECRET, ...ELSEWHERE].map((target) => ({ caller: "untrusted.**", target, effect: "deny" }))
			}
		});

		const listed = api.slothlet.permissions.global.rules
			.path("vault.secret")
			.filter((rule) => rule.caller === "untrusted.**")
			.map((rule) => rule.target);
		expect(listed.sort()).toEqual([...ON_SECRET].sort());
	});

	it("lists a rule added at runtime with a suffix", async () => {
		api = await slothlet({ ...config, base: `${BASE}/payments`, permissions: { policy: "allow" } });
		const id = api.slothlet.permissions.rules.add({ caller: "untrusted.**", target: "vault.secret:read", effect: "deny" });
		const listed = api.slothlet.permissions.global.rules.path("vault.secret").map((rule) => rule.id);
		expect(listed).toContain(id);
	});
});
