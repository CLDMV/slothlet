/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-multi-instance.test.vitest.mjs
 *	@Date: 2026-04-14 20:00:00 -07:00 (1776222000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 20:00:00 -07:00 (1776222000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Multi-Instance Isolation > $name", ({ config }) => {
	const instances = [];

	afterEach(async () => {
		for (const inst of instances) {
			if (inst) await inst.shutdown();
		}
		instances.length = 0;
	});

	it("deny rule on instance A does not leak into instance B", async () => {
		// Instance A: deny callers → admin
		const apiA = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "admin.**", effect: "deny" }]
			}
		});
		instances.push(apiA);

		// Instance B: allow everything (no deny rules)
		const apiB = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});
		instances.push(apiB);

		// Instance A: caller → admin should be DENIED
		try {
			await apiA.callers.paymentsCaller.callAdmin();
			expect.unreachable("Instance A should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}

		// Instance B: caller → admin should SUCCEED (no deny rules)
		const result = await apiB.callers.paymentsCaller.callAdmin();
		expect(result).toEqual({ ok: true, module: "admin", action: "create", name: "test" });
	});

	it("instance A deny does not affect instance B even after interleaved calls", async () => {
		// Instance A: deny callers → payments
		const apiA = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "payments.**", effect: "deny" }]
			}
		});
		instances.push(apiA);

		// Instance B: deny callers → admin (opposite rule)
		const apiB = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "admin.**", effect: "deny" }]
			}
		});
		instances.push(apiB);

		// Instance A: callers → payments denied
		try {
			await apiA.callers.paymentsCaller.callCharge(100);
			expect.unreachable("Instance A callers→payments should be denied");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}

		// Instance A: callers → admin allowed (only payments denied on A)
		const adminResultA = await apiA.callers.paymentsCaller.callAdmin();
		expect(adminResultA).toEqual({ ok: true, module: "admin", action: "create", name: "test" });

		// Instance B: callers → admin denied
		try {
			await apiB.callers.paymentsCaller.callAdmin();
			expect.unreachable("Instance B callers→admin should be denied");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}

		// Instance B: callers → payments allowed (only admin denied on B)
		const chargeResultB = await apiB.callers.paymentsCaller.callCharge(200);
		expect(chargeResultB).toEqual({ ok: true, module: "payments.charge", amount: 200 });
	});

	it("context restoration after async boundary uses correct instance store", async () => {
		// This test specifically targets the LAZY_LIVE fix in the waiting proxy's async apply.
		// After async boundary, runInContext is called with wrapper.instanceID (explicit) not
		// currentInstanceID (global), so the correct per-instance store is used.

		// Instance A: deny callers → admin
		const apiA = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				audit: true,
				rules: [{ caller: "callers.**", target: "admin.**", effect: "deny" }]
			}
		});
		instances.push(apiA);

		// Instance B: allow everything
		const apiB = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				audit: true,
				rules: []
			}
		});
		instances.push(apiB);

		const deniedEventsA = [];
		const deniedEventsB = [];
		apiA.slothlet.lifecycle.on("permission:denied", (data) => deniedEventsA.push(data));
		apiB.slothlet.lifecycle.on("permission:denied", (data) => deniedEventsB.push(data));

		// Fire both calls concurrently — forces the singleton liveContextManager
		// to multiplex two instances. The explicit instanceID ensures correct store.
		// Wrap in async IIFEs so synchronous throws (EAGER mode) become rejected
		// promises instead of escaping the array literal construction.
		const [resultA, resultB] = await Promise.allSettled([
			(async () => apiA.callers.untrustedCaller.callAdmin())(),
			(async () => apiB.callers.untrustedCaller.callAdmin())()
		]);

		// Instance A: denied
		expect(resultA.status).toBe("rejected");
		expect(resultA.reason.message).toMatch(/PERMISSION_DENIED/);

		// Instance B: fulfilled
		expect(resultB.status).toBe("fulfilled");
		expect(resultB.value).toEqual({ ok: true, module: "admin", action: "create", name: "hacker" });

		// Audit events: only instance A should have denied events
		expect(deniedEventsA.length).toBeGreaterThan(0);
		expect(deniedEventsB.length).toBe(0);
	});

	it("permission rules are fully independent per instance", async () => {
		// Instance A: default deny
		const apiA = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [{ caller: "callers.**", target: "db.read.**", effect: "allow" }]
			}
		});
		instances.push(apiA);

		// Instance B: default allow
		const apiB = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});
		instances.push(apiB);

		// Instance A: only db.read is allowed for callers
		const readResult = await apiA.callers.paymentsCaller.callDbRead();
		expect(readResult).toEqual({ ok: true, module: "db.read", sql: "SELECT 1" });

		// Instance A: db.write is denied (default deny, no allow rule)
		try {
			await apiA.callers.paymentsCaller.callDbWrite();
			expect.unreachable("Instance A callers→db.write should be denied");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}

		// Instance B: everything is allowed
		const writeResultB = await apiB.callers.paymentsCaller.callDbWrite();
		expect(writeResultB).toEqual({ ok: true, module: "db.write", action: "insert", data: { data: "test" } });
	});
});
