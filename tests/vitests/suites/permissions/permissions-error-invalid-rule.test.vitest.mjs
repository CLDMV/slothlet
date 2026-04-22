/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-error-invalid-rule.test.vitest.mjs
 *	@Date: 2026-04-14 17:20:03 -07:00 (1776212403)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:33:59 -07:00 (1776213239)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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

	it("INVALID_PERMISSION_RULE for rule missing caller", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});

		try {
			api.slothlet.permissions.addRule({
				target: "payments.**",
				effect: "allow"
			});
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err.message).toContain("INVALID_PERMISSION_RULE");
		}
	});

	it("INVALID_PERMISSION_RULE for rule missing target", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});

		try {
			api.slothlet.permissions.addRule({
				caller: "callers.**",
				effect: "allow"
			});
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err.message).toContain("INVALID_PERMISSION_RULE");
		}
	});

	it("INVALID_PERMISSION_RULE for rule with invalid effect", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});

		try {
			api.slothlet.permissions.addRule({
				caller: "callers.**",
				target: "payments.**",
				effect: "invalid"
			});
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err.message).toContain("INVALID_PERMISSION_RULE");
		}
	});

	it("INVALID_PERMISSION_RULE for null rule (non-object)", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});

		try {
			api.slothlet.permissions.addRule(null);
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err.message).toContain("INVALID_PERMISSION_RULE");
		}
	});

	it("INVALID_PERMISSION_RULE for string rule (non-object)", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});

		try {
			api.slothlet.permissions.addRule("invalid-string");
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err.message).toContain("INVALID_PERMISSION_RULE");
		}
	});
});
