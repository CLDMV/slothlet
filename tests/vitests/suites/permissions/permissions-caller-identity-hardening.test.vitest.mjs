/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-caller-identity-hardening.test.vitest.mjs
 *	@Date: 2026-07-30 12:00:00 -07:00 (1785438000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-30 12:00:00 -07:00 (1785438000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Two hardening properties of concurrent caller resolution that nothing else asserts.
 *
 * @description
 * Both cover fixes that already shipped but had no regression net, so a later change could reopen
 * them silently. Both concern the window where two calls are in flight and the live runtime resolves
 * identity from the call stack rather than from its single caller field.
 *
 * **Internal `slothlet.*` routes.** Call and read enforcement is not the only gate: `api_builder`
 * guards the internal namespace separately, and that guard covers `slothlet.api.add`,
 * `slothlet.permissions.control.*` and rule introspection. It read the caller field directly, so an
 * unprivileged module could borrow a concurrently-suspended sibling's authority over the permission
 * system itself — a strictly worse target than ordinary data, since `control.disable()` lives there.
 *
 * **Stack tampering.** Identity in that window comes from the stack, which makes the stack part of
 * the trust boundary. `Error.prepareStackTrace` is a writable global and `Error` itself is
 * reassignable, so a leaf can blank the frames the resolver reads. An unattributable caller has to
 * be refused; treating it as absent would hand it the host-initiated exemption instead.
 *
 * The suspended sibling is deliberately one that *may* act, so borrowing its identity grants
 * something real — otherwise the rules would have refused the attempt anyway and the test would
 * pass without proving anything.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Caller Identity Hardening > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Run an unprivileged and a permitted caller so both suspend, then release them together.
	 * @param {Function} untrusted - Bound unprivileged entry point taking a gate.
	 * @param {Function} permitted - Bound permitted entry point taking a gate.
	 * @returns {Promise<Array>} `[untrustedOutcome, permittedOutcome]`.
	 */
	const race = async (untrusted, permitted) => {
		let release;
		const gate = new Promise((resolve) => (release = resolve));
		const settled = Promise.all([untrusted(gate), permitted(gate)]);
		release();
		return await settled;
	};

	it("an unprivileged module cannot borrow a concurrent caller's access to internal slothlet.* routes", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "callers.paymentsCaller.**", target: "slothlet.**", effect: "allow" },
					{ caller: "**", target: "callers.**", effect: "allow" }
				]
			}
		});

		const [untrusted, permitted] = await race(
			api.callers.untrustedCaller.gatedInternalRoute,
			api.callers.paymentsCaller.gatedInternalRoute
		);

		expect(untrusted.ok).toBe(false);
		expect(untrusted.code).toMatch(/PERMISSION_DENIED/);
		// The permitted caller keeps its access — this is about attribution, not blanket refusal.
		expect(permitted.ok).toBe(true);
		expect(typeof permitted.count).toBe("number");
	});

	it("blanking the stack does not make a caller unattributable-and-therefore-allowed", async () => {
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

		const [untrusted, permitted] = await race(api.callers.untrustedCaller.gatedWithBlindedStack, api.callers.paymentsCaller.gatedDbWrite);

		// Refused either because it was still attributed correctly, or because it could not be
		// attributed at all — never granted. Both are acceptable; being allowed is not.
		expect(untrusted.ok).toBe(false);
		expect(permitted).toMatchObject({ ok: true, module: "db.write" });
	});
});
