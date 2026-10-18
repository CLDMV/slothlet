/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-caller-supplied-forged.test.vitest.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #597 — code placed on a leaf's caller is attribution only: the leaf stays its ceiling everywhere.
 *
 * @description
 * A leaf handed a callback can run code under a script filename naming its caller's file, so the code is placed
 * on the caller and reads as the caller's supplied code. The caller's identity is then only ever attribution:
 * every decision taken from it — a hook's owner at registration and at fire time, an event subscription's
 * delivery level, a principal's owner and the identity its resolver runs as — has to hold for the leaf as well,
 * so the leaf gains nothing it could not do itself.
 *
 * Fixture: `victim.caller` may call `vault.secret.secret` (and so hook it) and receives `vault.leak` in full;
 * `attacker.leaf` (mounted as its own module) may do neither. Both may manage principals.
 *
 * @module tests/vitests/suites/permissions/permissions-caller-supplied-forged
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const DIR = TEST_DIRS.API_TEST_CALLER_SUPPLIED_FORGED;

/** Deny by default; the vault's secret is the victim's alone. */
const RULES = [
	{ caller: "victim.**", target: "vault.secret.secret", effect: "allow" },
	{ caller: "victim.**", target: "attacker.**", effect: "allow" },
	{ caller: "victim.**", target: "slothlet.permissions.principal.**", effect: "allow" },
	{ caller: "attacker.**", target: "slothlet.permissions.principal.**", effect: "allow" },
	{ caller: "attacker.**", target: "vault.secret.gate", effect: "allow", requires: ["leak"] }
];

/** The victim receives `vault.leak` in full; the attacker is refused it. */
const EVENTS = {
	default: "notify",
	rules: [
		{ caller: "victim.**", event: "vault.leak", effect: "allow" },
		{ caller: "attacker.**", event: "vault.leak", effect: "deny" }
	]
};

describe.each(getMatrixConfigs())("Permissions > code placed on a caller keeps the leaf as its ceiling (#597) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build the victim's base and mount the attacker as a module of its own.
	 * @returns {Promise<object>} The api.
	 */
	const build = async () => {
		api = await slothlet({
			...config,
			base: path.join(DIR, "base"),
			hook: true,
			permissions: { defaultPolicy: "deny", rules: RULES, events: EVENTS }
		});
		await api.slothlet.api.add("attacker", path.join(DIR, "attacker"), { moduleID: "attacker-mod" });
		return api;
	};

	it("a hook registered on the victim's target is refused", async () => {
		await build();
		const outcome = await withSuppressedSlothletErrorOutput(() => api.victim.caller.callAttacker("hookConcrete"));
		expect(outcome).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});

	it("a glob hook over the victim's target does not fire for it", async () => {
		await build();
		const outcome = await api.victim.caller.callAttacker("hookGlob");
		expect(outcome.ok).toBe(true);
		expect(await api.vault.secret.secret()).toBe("s3cret");
		expect(await api.attacker.leaf.firedCount()).toBe(0);
	});

	it("an event subscription gets the stricter of the two levels", async () => {
		await build();
		expect(await api.victim.caller.callAttacker("subscribe")).toBe("deny");
	});

	it("the victim's principal cannot be unregistered", async () => {
		await build();
		expect(await api.victim.caller.registerRoles()).toBe(true);
		const outcome = await withSuppressedSlothletErrorOutput(() => api.victim.caller.callAttacker("unregisterRoles"));
		expect(outcome).toEqual({ ok: false, code: "PRINCIPAL_NOT_OWNER" });
		expect(await api.victim.caller.hasRoles()).toBe(true);
	});

	it("a principal's resolver runs with the leaf as its ceiling", async () => {
		await build();
		const registered = await api.victim.caller.callAttacker("registerLeak");
		expect(registered.ok).toBe(true);
		await withSuppressedSlothletErrorOutput(() => api.attacker.leaf.callGate());
		expect(await api.attacker.leaf.leakedOutcome()).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});
});
