/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-seal.test.vitest.mjs
 *	@Date: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview H2 — opt-in control-surface seal. `permissions.control.seal()` is a one-way lock:
 * after sealing, enable/disable, addRule/removeRule, and readGating throw PERMISSION_SEALED, while
 * enforcement keeps evaluating and shutdown() still works. seal() is idempotent, and module-land
 * calls to the control surface stay blocked by the pre-existing builtin deny rule.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Control-surface seal (H2) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("after seal(), policy-mutating methods throw PERMISSION_SEALED; sealed === true", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "allow" } });
		const P = api.slothlet.permissions;

		expect(P.control.sealed).toBe(false);
		P.control.seal();
		expect(P.control.sealed).toBe(true);

		expect(() => P.control.enable()).toThrow(/PERMISSION_SEALED/);
		expect(() => P.control.disable()).toThrow(/PERMISSION_SEALED/);
		expect(() => P.addRule({ caller: "a.**", target: "b.**", effect: "deny" })).toThrow(/PERMISSION_SEALED/);
		expect(() => P.removeRule("perm-1")).toThrow(/PERMISSION_SEALED/);
		expect(() => P.control.readGating(false)).toThrow(/PERMISSION_SEALED/);
	});

	it("seal() is idempotent and enforcement still evaluates after sealing", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: { defaultPolicy: "allow", rules: [{ caller: "callers.**", target: "payments.**", effect: "deny" }] }
		});
		const P = api.slothlet.permissions;

		P.control.seal();
		expect(() => P.control.seal()).not.toThrow(); // idempotent
		expect(P.control.sealed).toBe(true);

		// Host call still allowed; inter-module denied rule still enforced post-seal.
		const hostResult = await api.payments.charge.process(1);
		expect(hostResult.ok).toBe(true);
		// The inter-module call can reject asynchronously (lazy) or throw synchronously (eager), so
		// capture with try/catch rather than `.rejects`.
		let denied = false;
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.callers.paymentsCaller.callCharge(100);
			} catch (err) {
				denied = /PERMISSION_DENIED/.test(err.message);
			}
		});
		expect(denied).toBe(true);
	});

	it("shutdown() still works after seal()", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "allow" } });
		api.slothlet.permissions.control.seal();
		await api.shutdown();
		api = null; // shutdown succeeded
		expect(true).toBe(true);
	});

	it("seal survives reload() — the one-way lock is durable (#183 review, Gap 2)", async () => {
		// reload() constructs a fresh PermissionManager (#sealed resets to false). Without the
		// save/re-apply around reload, the control surface would silently unseal — contradicting
		// seal()'s documented one-way guarantee.
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "deny" } });
		const P = api.slothlet.permissions;
		P.control.seal();
		expect(P.control.sealed).toBe(true);

		await api.slothlet.reload();

		expect(api.slothlet.permissions.control.sealed).toBe(true);
		expect(() => api.slothlet.permissions.control.disable()).toThrow(/PERMISSION_SEALED/);
		expect(() => api.slothlet.permissions.addRule({ caller: "a.**", target: "b.**", effect: "allow" })).toThrow(/PERMISSION_SEALED/);
	});

	it("module-land seal() is blocked by the builtin control.** deny rule (regression)", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "allow" } });
		let denied = false;
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.callers.controlCaller.callSeal();
			} catch (err) {
				denied = /PERMISSION_DENIED/.test(err.message);
			}
		});
		expect(denied).toBe(true);
		// The host-side surface stayed unsealed (the module call never reached seal()).
		expect(api.slothlet.permissions.control.sealed).toBe(false);
	});
});
