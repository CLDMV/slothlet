/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-caller-identity-concurrent.test.vitest.mjs
 *	@Date: 2026-07-29 12:00:00 -07:00 (1785351600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-29 12:00:00 -07:00 (1785351600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Caller identity must survive two calls being in flight at once.
 *
 * @description
 * Two module calls that suspend at the same time have overlapping lifetimes, and the live
 * runtime's single "current module" field can only name one of them. Whichever entered last owns
 * it, so the other resumes carrying an identity that is not its own — and since identity decides
 * what a caller may do, it inherits that module's rights outright. The async runtime is unaffected;
 * AsyncLocalStorage gives it a per-flow store.
 *
 * Ordering matters. The *unprivileged* module has to enter first and the privileged one second, so
 * the unprivileged one resumes while the privileged identity is the most recent. Reverse it and the
 * same defect merely produces a spurious denial instead of a leak — which is why both directions
 * are asserted below.
 *
 * The browser leg of this lives in `browser/browser-permission-bypass`, where it matters most: a
 * browser has no `node:async_hooks` at all, so it always runs this manager.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Caller Identity Under Concurrency > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * `callers.paymentsCaller` may write; `callers.untrustedCaller` may not.
	 * @returns {Promise<object>} The bound api.
	 */
	const boot = async () =>
		await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "callers.paymentsCaller.**", target: "db.write.**", effect: "allow" },
					{ caller: "**", target: "callers.**", effect: "allow" }
				]
			}
		});

	/**
	 * Run both callers so they suspend together, then release them in the same turn.
	 * @param {object} instance - Bound api.
	 * @param {boolean} unprivilegedFirst - Which caller enters (and so suspends) first.
	 * @returns {Promise<{untrusted: object, payments: object}>} Both outcomes.
	 */
	const raceBoth = async (instance, unprivilegedFirst) => {
		let release;
		const gate = new Promise((resolve) => (release = resolve));
		const calls = unprivilegedFirst
			? [instance.callers.untrustedCaller.gatedDbWrite(gate), instance.callers.paymentsCaller.gatedDbWrite(gate)]
			: [instance.callers.paymentsCaller.gatedDbWrite(gate), instance.callers.untrustedCaller.gatedDbWrite(gate)];
		const settled = Promise.all(calls);
		release();
		const results = await settled;
		return unprivilegedFirst ? { untrusted: results[0], payments: results[1] } : { untrusted: results[1], payments: results[0] };
	};

	it("an unprivileged module does not inherit a concurrent caller's rights", async () => {
		api = await boot();
		const { untrusted, payments } = await raceBoth(api, true);

		expect(untrusted.ok).toBe(false);
		expect(untrusted.code).toMatch(/PERMISSION_DENIED/);
		// The permitted caller is unaffected — this is about attribution, not blanket denial.
		expect(payments).toMatchObject({ ok: true, module: "db.write" });
	});

	it("sibling functions of one module are resolved individually, not collapsed by file", async () => {
		// `untrustedCaller.gatedSibling` may write; `untrustedCaller.gatedDbWrite` may not. Both
		// suspend together and both reach the gate through the same file, so file-level attribution
		// alone cannot separate them. The security property — the denied one stays denied — must
		// hold regardless of how precisely the caller can be identified.
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "callers.untrustedCaller.gatedSibling", target: "db.write.**", effect: "allow" },
					{ caller: "**", target: "callers.**", effect: "allow" }
				]
			}
		});

		let release;
		const gate = new Promise((resolve) => (release = resolve));
		const settled = Promise.all([api.callers.untrustedCaller.gatedDbWrite(gate), api.callers.untrustedCaller.gatedSibling(gate)]);
		release();
		const [denied, permitted] = await settled;

		expect(denied.ok).toBe(false);
		expect(denied.code).toMatch(/PERMISSION_DENIED/);
		// Sharing a file with a denied sibling must not cost the permitted function its rights.
		// This holds on every runtime and mode: where the stack alone could not name the caller — a
		// lazy call resolves in a later turn, by which point the caller's frame is gone — the
		// identity resolved synchronously at capture time is carried forward instead.
		expect(permitted).toMatchObject({ ok: true, result: { module: "db.write" } });
	});

	it("the same function suspended twice is not treated as ambiguous with itself", async () => {
		// Two invocations of one function have identical identity — enforcement keys on the api
		// path, not on the invocation — so neither may be denied for the other's sake.
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "callers.paymentsCaller.**", target: "db.write.**", effect: "allow" },
					{ caller: "**", target: "callers.**", effect: "allow" }
				]
			}
		});

		let release;
		const gate = new Promise((resolve) => (release = resolve));
		const settled = Promise.all([api.callers.paymentsCaller.gatedDbWrite(gate), api.callers.paymentsCaller.gatedDbWrite(gate)]);
		release();
		const [first, second] = await settled;

		expect(first).toMatchObject({ ok: true, module: "db.write" });
		expect(second).toMatchObject({ ok: true, module: "db.write" });
	});

	it("a permitted module is not denied because a concurrent caller entered after it", async () => {
		api = await boot();
		const { untrusted, payments } = await raceBoth(api, false);

		expect(payments).toMatchObject({ ok: true, module: "db.write" });
		expect(untrusted.ok).toBe(false);
	});
});
