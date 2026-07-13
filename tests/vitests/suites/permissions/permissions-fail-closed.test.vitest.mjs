/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-fail-closed.test.vitest.mjs
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
 * @fileoverview H3 — fail closed on absent caller identity. Permission enforcement now denies a
 * call/read that occurs inside an active context with no resolvable (or forged) caller identity.
 * Genuinely host-initiated calls stay allowed via the trusted-root marker, and
 * `permissions.failOpenOnAbsentCaller: true` restores the legacy fail-open behaviour.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { genuineWrappers } from "#handlers/trusted-root";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

// Reach the instance's contextManager + instanceID via a resolved wrapper (ComponentBase exposes
// `.slothlet`). Used to drive runInContext with a forged / stripped caller identity.
function instanceHandles(api) {
	const sl = resolveWrapper(api.payments).slothlet;
	return { cm: sl.contextManager, instanceID: sl.instanceID };
}

describe.each(getMatrixConfigs())("Permissions > Fail Closed (H3) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("host-initiated call is allowed under defaultPolicy:deny (trusted root)", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "deny" } });
		const result = await api.payments.charge.process(100);
		expect(result.ok).toBe(true);
	});

	it("a forged caller wrapper (not in genuineWrappers) is denied", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "deny" } });
		const { cm, instanceID } = instanceHandles(api);
		const forged = { ____slothletInternal: { apiPath: "attacker", filePath: null } };
		expect(genuineWrappers.has(forged)).toBe(false);

		// Enforcement throws synchronously from the callback, so runInContext rethrows synchronously —
		// capture with try/catch rather than `.rejects` (which needs a promise).
		let denied = false;
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await cm.runInContext(instanceID, () => api.payments.charge.process(1), null, [], forged);
			} catch (err) {
				denied = /PERMISSION_DENIED/.test(err.message);
			}
		});
		expect(denied).toBe(true);
	});

	it("a forged caller wrapper reading a terminal data value is denied (read gate)", async () => {
		// Mirrors the forged-call case above, but exercises the read gate's fail-closed deny
		// (unified-wrapper `runtime_enforceReadGate`): a terminal Buffer read off a module API
		// path inside a forged context must throw before any rule check. readGating defaults on.
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "deny" } });
		const { cm, instanceID } = instanceHandles(api);
		const forged = { ____slothletInternal: { apiPath: "attacker", filePath: null } };
		expect(genuineWrappers.has(forged)).toBe(false);

		// The read throws synchronously from getTrap, so runInContext rethrows synchronously.
		let denied = false;
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await cm.runInContext(instanceID, () => api.db.secrets.token, null, [], forged);
			} catch (err) {
				denied = /PERMISSION_DENIED/.test(err.message);
			}
		});
		expect(denied).toBe(true);
	});
});

describe.each(getMatrixConfigs({ runtime: "async" }))("Permissions > Fail Closed (H3) [async] > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("a stripped-context caller (active context, no caller, not trusted root) is denied", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "deny" } });
		const { cm, instanceID } = instanceHandles(api);

		// runInContext with a null caller creates an execution store with no currentWrapper that does
		// NOT carry the trusted-root marker (async execution stores are shallow copies; the marker is
		// non-enumerable and not copied) — the "identity stripped mid-request" shape.
		let denied = false;
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await cm.runInContext(instanceID, () => api.payments.charge.process(1), null, [], null);
			} catch (err) {
				denied = /PERMISSION_DENIED/.test(err.message);
			}
		});
		expect(denied).toBe(true);
	});

	it("a stripped-context caller reading a terminal data value is denied (read gate)", async () => {
		// Read-gate counterpart of the stripped-context call case above. A null caller yields an
		// execution store with no currentWrapper and no trusted-root marker; a terminal Buffer read
		// off a module API path then fails closed in `runtime_enforceReadGate`. Async-only, matching
		// the call case: live-mode stores propagate the host trusted-root marker differently.
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "deny" } });
		const { cm, instanceID } = instanceHandles(api);

		let denied = false;
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await cm.runInContext(instanceID, () => api.db.secrets.token, null, [], null);
			} catch (err) {
				denied = /PERMISSION_DENIED/.test(err.message);
			}
		});
		expect(denied).toBe(true);
	});

	it("failOpenOnAbsentCaller:true restores the legacy allow behaviour", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: { defaultPolicy: "deny", failOpenOnAbsentCaller: true }
		});
		const { cm, instanceID } = instanceHandles(api);

		const result = await cm.runInContext(instanceID, () => api.payments.charge.process(1), null, [], null);
		expect(result.ok).toBe(true);
	});
});
