/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-cache-invalidation.test.vitest.mjs
 *	@Date: 2026-04-14 17:16:36 -07:00 (1776212196)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:33:58 -07:00 (1776213238)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Cache Invalidation > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("cache clears on addRule — new rule takes effect immediately", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		// First call succeeds (allowed by default)
		const result = await api.callers.paymentsCaller.callCharge(100);
		expect(result.ok).toBe(true);

		// Add deny rule — cache should invalidate
		api.slothlet.permissions.addRule({ caller: "callers.**", target: "payments.**", effect: "deny" });

		// Next call should be denied (cache was cleared)
		try {
			await api.callers.paymentsCaller.callCharge(100);
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}
	});

	it("cache clears on removeRule", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		const ruleId = api.slothlet.permissions.addRule({ caller: "callers.**", target: "payments.**", effect: "deny" });

		// Denied
		try {
			await api.callers.paymentsCaller.callCharge(100);
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}

		// Remove rule — cache should invalidate
		api.slothlet.permissions.removeRule(ruleId);

		// Now allowed
		const result = await api.callers.paymentsCaller.callCharge(100);
		expect(result.ok).toBe(true);
	});

	it("audit events fire on every call, including cache hits", async () => {
		const denied = [];
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "payments.**", effect: "deny" }]
			}
		});

		api.slothlet.lifecycle.on("permission:denied", (payload) => {
			denied.push(payload);
		});

		// First call — cache miss, event fires
		try {
			await api.callers.paymentsCaller.callCharge(100);
		} catch (_) {
			// expected
		}
		expect(denied.length).toBe(1);

		// Second call — cache hit, event must still fire
		try {
			await api.callers.paymentsCaller.callCharge(100);
		} catch (_) {
			// expected
		}
		expect(denied.length).toBe(2);
	});
});
