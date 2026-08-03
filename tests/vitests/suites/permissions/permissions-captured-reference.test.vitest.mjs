/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-captured-reference.test.vitest.mjs
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
 * @fileoverview A captured api reference carries the identity of whoever captured it.
 *
 * @description
 * Every other route to a denied target was closed by making sure the *invocation* is attributed: the
 * runtime carries identity across `await`, and the scheduling boundaries capture it at registration.
 * One route survives all of that, because it never asks who is calling. A module reads an api function
 * into a variable while it holds it, and invokes that variable later from a boundary the patches do not
 * reach — `node:timers`, whose ESM named exports are a snapshot taken at first link and so cannot be
 * patched after the fact. At the moment of the call nothing reads `self`, so the executing-module guard
 * has nothing to refuse, and the call arrives with no caller at all. An absent caller reads as
 * host-initiated and exempt.
 *
 * The fix records the reader at the point the reference is taken, which is the one moment its identity
 * is known — the same principle the boundary patches use, applied one step earlier, at acquisition
 * rather than at scheduling.
 *
 * The second case is the trap that comes with it. If a captured identity *replaced* the live caller,
 * a permitted module could take a reference and hand it to an unprivileged one, which would then call
 * it with borrowed authority — a worse hole than the one being closed. So the captured identity is a
 * floor, not a substitute: both it and whoever is actually calling have to pass.
 *
 * The third case guards the cache the fix needs. Handing back a fresh view per read would break
 * reference equality, and code that compares or de-duplicates api functions — `removeListener`, a
 * `Map` key, a memo — would silently stop matching.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > captured references > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Only `callers.paymentsCaller` may write; everyone may reach the caller modules.
	 * @returns {Promise<object>} Bound api.
	 */
	const onlyPaymentsMayWrite = async () =>
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

	it("refuses a reference an unprivileged module captured and invoked past every patched boundary", async () => {
		api = await onlyPaymentsMayWrite();

		expect(await api.callers.untrustedCaller.stashInsertRef()).toBe("stashed");
		expect(await api.callers.untrustedCaller.invokeStashedFromUnpatched()).toBe("armed");

		let outcome = null;
		for (let attempt = 0; attempt < 200 && !outcome; attempt++) {
			outcome = await api.callers.untrustedCaller.readStashedOutcome();
			if (!outcome) await new Promise((resolve) => setTimeout(resolve, 20));
		}

		expect(outcome).not.toBeNull();
		expect(outcome.ok).toBe(false);
		expect(outcome.code).toMatch(/PERMISSION_DENIED/);
	});

	it("does not let a permitted module lend its access by handing over a captured reference", async () => {
		api = await onlyPaymentsMayWrite();

		const outcome = await api.callers.paymentsCaller.lendInsertRef();

		expect(outcome.ok).toBe(false);
		expect(outcome.code).toMatch(/PERMISSION_DENIED/);
	});

	it("does not let an unprivileged module get its work done through a privileged one", async () => {
		api = await onlyPaymentsMayWrite();

		// The mirror of the case above. There the capturer was permitted and the caller was not; here the
		// capturer is not and the caller is. Both have to be refused, or the captured identity is only
		// half a check — and eager and lazy composition must agree on that.
		const outcome = await api.callers.untrustedCaller.captureAndHandOff();

		expect(outcome.ok).toBe(false);
		expect(outcome.code).toMatch(/PERMISSION_DENIED/);
	});

	it("is on without being asked for, and can be turned off for compatibility", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				references: { capture: false },
				rules: [
					{ caller: "callers.paymentsCaller.**", target: "db.write.**", effect: "allow" },
					{ caller: "**", target: "callers.**", effect: "allow" }
				]
			}
		});

		// The opt-out exists for code written against earlier versions, which could stash a reference and
		// call it from host context expecting the host's standing. Turning it off restores exactly that,
		// so the escape hatch has to be demonstrably an escape hatch — otherwise it is dead config.
		expect(await api.callers.untrustedCaller.stashInsertRef()).toBe("stashed");
		expect(await api.callers.untrustedCaller.invokeStashedFromUnpatched()).toBe("armed");

		let outcome = null;
		for (let attempt = 0; attempt < 200 && !outcome; attempt++) {
			outcome = await api.callers.untrustedCaller.readStashedOutcome();
			if (!outcome) await new Promise((resolve) => setTimeout(resolve, 20));
		}

		// Only the live-caller check applies now, and a callback off an unpatched boundary has no caller,
		// so under the live runtime this is the old fail-open result. The async runtime never inherited it.
		expect(outcome).not.toBeNull();
		expect(outcome.ok).toBe(config.runtime === "live");
	});

	it("keeps reference equality across repeated reads", async () => {
		api = await onlyPaymentsMayWrite();

		// Two reads of the same path must hand back the same object, or anything comparing or
		// de-duplicating api functions quietly stops matching.
		expect(await api.callers.paymentsCaller.sameRefTwice()).toBe(true);
	});

	it("leaves the permitted module's own use of a captured reference working", async () => {
		api = await onlyPaymentsMayWrite();

		expect(await api.callers.paymentsCaller.useOwnCapturedRef()).toMatchObject({ ok: true });
	});
});
