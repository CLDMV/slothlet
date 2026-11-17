/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-error-invalid-rule.test.vitest.mjs
 *	@Date: 2026-04-14T17:20:03-07:00 (1776212403)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:27-08:00 (1794882627)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Error Invalid Rule > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("PERMISSION_RULE_INVALID for rule missing caller", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: []
			}
		});

		try {
			api.slothlet.permissions.rules.add({
				target: "payments.**",
				effect: "allow"
			});
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err.message).toContain("PERMISSION_RULE_INVALID");
		}
	});

	it("PERMISSION_RULE_INVALID for rule missing target", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: []
			}
		});

		try {
			api.slothlet.permissions.rules.add({
				caller: "callers.**",
				effect: "allow"
			});
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err.message).toContain("PERMISSION_RULE_INVALID");
		}
	});

	it("PERMISSION_RULE_INVALID for rule with invalid effect", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: []
			}
		});

		try {
			api.slothlet.permissions.rules.add({
				caller: "callers.**",
				target: "payments.**",
				effect: "invalid"
			});
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err.message).toContain("PERMISSION_RULE_INVALID");
		}
	});

	it("PERMISSION_RULE_INVALID for null rule (non-object)", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: []
			}
		});

		try {
			api.slothlet.permissions.rules.add(null);
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err.message).toContain("PERMISSION_RULE_INVALID");
		}
	});

	it("PERMISSION_RULE_INVALID for string rule (non-object)", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow",
				rules: []
			}
		});

		try {
			api.slothlet.permissions.rules.add("invalid-string");
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err.message).toContain("PERMISSION_RULE_INVALID");
		}
	});
});
