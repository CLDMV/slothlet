/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-write-grant.test.vitest.mjs
 *	@Date: 2026-10-18T20:37:09-07:00 (1792381029)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T23:11:31-07:00 (1792390291)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A host write rule grants a module a write outside what it owns (#625).
 *
 * A module writes only under the subtree it owns. An explicit `:write` allow rule of the host (instance config
 * or runtime) that matches the writing module and the written path grants the write instead: the ownership rule
 * is not applied to it. That holds for a member written by name, for a symbol-keyed member (matched against the
 * path of the node it is written on), for a change to a node itself (its prototype, its extensibility), and for a
 * plain value reached through a node, such as a class's prototype. `defaultPolicy: "allow"` grants nothing; a more
 * specific host deny wins over a broader grant; a grant names its caller, so another module gets nothing from it.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/`, `guest/` (also mounted as `other`).
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

const GRANT = [
	{ caller: "guest.**", target: "victim.**:write", effect: "allow" },
	{ caller: "guest.**", target: "victim:write", effect: "allow" }
];

/**
 * The report expected when every change has the same outcome.
 * @param {Record<string, string>} report - Outcomes by change.
 * @param {string} outcome - The outcome.
 * @returns {Record<string, string>} The same keys, each `outcome`.
 */
const every = (report, outcome) => Object.fromEntries(Object.keys(report).map((key) => [key, outcome]));

describe.each(CONFIGS)("host write grants (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and mount `victim`, `guest`, and the guest code again as `other`.
	 * @param {object} [options] - Further slothlet options.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(options = {}) {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
		await api.slothlet.api.add("victim", path.join(FIXTURE, "victim"), { moduleID: "victim" });
		await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
		await api.slothlet.api.add("other", path.join(FIXTURE, "guest"), { moduleID: "other" });
		return api;
	}

	it("lets a module write another module's members, by name and by symbol key, when a host rule grants it", async () => {
		await load({ permissions: { rules: GRANT } });
		const report = await api.guest.x.writeVictim();
		expect(report).toEqual(every(report, "done"));
		expect(api.victim.v.noteDefined).toBe(2);
		expect(api.victim.v.Account.prototype.granted).toBe(1);
		expect(Object.isFrozen(api.victim.v.conf)).toBe(true);
	});

	it("lets a module write later, from outside any call, through another module's node a host rule grants it", async () => {
		await load({ permissions: { rules: GRANT } });
		const later = await api.guest.x.keepVictimNode();
		expect(later()).toBe("done");
		expect(api.victim.v.keptNote).toBe(1);
	});

	it("lets a host rule added at runtime grant the write", async () => {
		await load({ permissions: {} });
		for (const rule of GRANT) api.slothlet.permissions.addRule(rule);
		const report = await api.guest.x.writeVictim();
		expect(report).toEqual(every(report, "done"));
	});

	it.each([
		["no permissions config", {}],
		["permissions with defaults", { permissions: {} }],
		["defaultPolicy allow, no write rule", { permissions: { defaultPolicy: "allow" } }]
	])("refuses the writes with no granting rule: %s", async (_label, options) => {
		await load(options);
		const report = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeVictim());
		expect(report).toEqual(every(report, "LOOSE_SET_NOT_OWNED"));
		expect(api.victim.v.noteDefined).toBeUndefined();
	});

	it("lets a more specific host deny win over a broader grant", async () => {
		await load({ permissions: { rules: [...GRANT, { caller: "guest.**", target: "victim.v.note:write", effect: "deny" }] } });
		const report = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeVictim());
		expect(report.assignName).toBe("PERMISSION_DENIED");
		expect(report.assignSymbol).toBe("done");
		expect(api.victim.v.note).toBeUndefined();
	});

	it("decides a conditional grant on every write, by the context it is made in", async () => {
		await load({ permissions: { rules: GRANT.map((rule) => ({ ...rule, condition: { tenant: "a" } })) } });
		const inside = await api.slothlet.context.run({ tenant: "a" }, () => api.guest.x.writeVictim());
		expect(inside).toEqual(every(inside, "done"));
		const outside = await api.slothlet.context.run({ tenant: "b" }, () =>
			withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeVictim())
		);
		expect(outside.assignName).toBe("LOOSE_SET_NOT_OWNED");
		const again = await api.slothlet.context.run({ tenant: "a" }, () => api.guest.x.writeAt("victim.v"));
		expect(again).toEqual(every(again, "done"));
	});

	it("grants only the caller the rule names", async () => {
		await load({ permissions: { rules: GRANT } });
		const report = withSuppressedSlothletErrorOutputSync(() => api.other.x.writeVictim());
		expect(report).toEqual(every(report, "LOOSE_SET_NOT_OWNED"));
		const later = await api.other.x.keepVictimNode();
		expect(withSuppressedSlothletErrorOutputSync(() => later())).toBe("RUNTIME_NO_ACTIVE_CONTEXT_SELF");
	});
});
