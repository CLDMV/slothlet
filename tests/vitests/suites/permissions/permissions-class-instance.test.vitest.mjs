/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-class-instance.test.vitest.mjs
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
 * @fileoverview #183 review, Gap 1 — a class instance returned by a module carries the creating
 * module's identity for permission enforcement. A `self.*` call from one of its methods is checked
 * as the creating module (`callers.classService`): allowed when that module is allowed, denied when
 * that module is denied — identical to the module's plain functions. This guards against both the
 * pre-#183 bypass (class methods exempt from enforcement) and the #183 regression (class methods
 * spuriously hard-denied whenever permissions were enabled).
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs({ runtime: "async" }))("Permissions > Class-instance identity [async] > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("class-instance method's self.* call is ALLOWED when the creating module is allowed", async () => {
		// The #183 regression: with permissions enabled, this threw PERMISSION_DENIED even under
		// defaultPolicy:allow because the class-method call presented no caller identity.
		// (In lazy mode the factory's first call materializes async, so `makeService()` resolves to
		// the wrapped instance — await it before reaching the method.)
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "allow" } });
		const svc = await api.callers.classService.makeService();
		const result = await svc.readViaMethod();
		expect(result).toMatchObject({ ok: true, module: "db.read" });
	});

	it("class-instance method's self.* call is DENIED when the creating module is denied the target", async () => {
		// The pre-#183 hole: class methods bypassed enforcement entirely. The method must be checked
		// as the creating module's leaf (`callers.classService.makeService`), so a deny rule covering
		// that module (`callers.classService.**`) blocks the call.
		api = await slothlet({
			...config,
			base: BASE,
			permissions: { defaultPolicy: "allow", rules: [{ caller: "callers.classService.**", target: "db.read.**", effect: "deny" }] }
		});
		const svc = await api.callers.classService.makeService();
		let denied = false;
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await svc.readViaMethod();
			} catch (err) {
				denied = /PERMISSION_DENIED/.test(err.message);
			}
		});
		expect(denied).toBe(true);
	});

	it("class-instance method resolves to the SAME caller identity as the module's plain function", async () => {
		// Same deny rule denies both the class method and the plain function — proving the class
		// instance runs as its creating module, not as host and not as a distinct identity.
		api = await slothlet({
			...config,
			base: BASE,
			permissions: { defaultPolicy: "allow", rules: [{ caller: "callers.classService.**", target: "db.read.**", effect: "deny" }] }
		});
		let fnDenied = false;
		let methodDenied = false;
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.callers.classService.readViaFunction();
			} catch (err) {
				fnDenied = /PERMISSION_DENIED/.test(err.message);
			}
			try {
				const svc = await api.callers.classService.makeService();
				await svc.readViaMethod();
			} catch (err) {
				methodDenied = /PERMISSION_DENIED/.test(err.message);
			}
		});
		expect(fnDenied).toBe(true);
		expect(methodDenied).toBe(true);
	});
});
