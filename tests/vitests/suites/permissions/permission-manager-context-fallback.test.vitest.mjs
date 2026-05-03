/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permission-manager-context-fallback.test.vitest.mjs
 *	@Date: 2026-05-02 18:12:00 -07:00 (1777770720)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-02 18:24:20 -07:00 (1777771460)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import { PermissionManager } from "@cldmv/slothlet/handlers/permission-manager";
import { SlothletError } from "@cldmv/slothlet/errors";

describe("PermissionManager > condition runtimeContext fallback", () => {
	/** @type {PermissionManager|null} */
	let manager = null;

	afterEach(async () => {
		if (manager) {
			await manager.shutdown();
			manager = null;
		}
	});

	it("evaluates conditional rule with both null and object runtime contexts", () => {
		manager = new PermissionManager({
			config: {
				permissions: {
					enabled: true,
					defaultPolicy: "deny",
					rules: [
						{
							caller: "callers.**",
							target: "payments.**",
							effect: "allow",
							condition: (ctx) => ("tenant" in ctx ? ctx.tenant === "tenant-a" : true)
						}
					]
				}
			},
			handlers: {},
			debug() {},
			SlothletError
		});

		expect(manager.checkAccess("callers.paymentsCaller.callCharge", "payments.charge.process", null, null, null)).toBe(true);
		expect(manager.checkAccess("callers.paymentsCaller.callCharge", "payments.charge.process", null, null, { tenant: "tenant-a" })).toBe(
			true
		);
		expect(manager.checkAccess("callers.paymentsCaller.callCharge", "payments.charge.process", null, null, { tenant: "tenant-b" })).toBe(
			false
		);
	});
});
