/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-module-rule-integrity.test.vitest.mjs
 *	@Date: 2026-10-18T22:14:30-07:00 (1792386870)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-26T02:52:54-07:00 (1793008374)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Rules module code registers keep to what the module may register, for as long as the module is
 * there (#625).
 *
 * A rule is read once, when it is registered, and that copy is what is checked, registered, and replayed on a
 * reload: a target that answers differently on a later read, a `permissions` option of an `api.add` whose arrays
 * grow, or a rule object changed afterwards changes nothing. Module code removes only the rules its own code
 * added — a rule manager also other modules' rules, never the host's or the framework's. A path belongs to the
 * module with the deepest mount covering it: a module does not own another module's mount below its own. A
 * module's rules — its manifest's, its code's, and its `api.add`'s — go with it when it is removed.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/`, `guest/` (also mounted as `mgr`, and as
 * nested and co-mounted modules), and the manifest module `modules/vault-grant-other`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { self } from "@cldmv/slothlet/runtime";
import { TEST_DIRS, withSuppressedSlothletErrorOutput, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

const HOST_DENY = { caller: "guest.**", target: "victim.**", effect: "deny" };
const DELEGATE = { caller: "mgr.**", target: "slothlet.permissions.addRule", effect: "allow" };
const GUEST_ALLOW_VICTIM = { caller: "guest.**", target: "victim.**:write", effect: "allow" };

/**
 * The report expected when every change has the same outcome.
 * @param {Record<string, string>} report - Outcomes by change.
 * @param {string} outcome - The outcome.
 * @returns {Record<string, string>} The same keys, each `outcome`.
 */
const every = (report, outcome) => Object.fromEntries(Object.keys(report).map((key) => [key, outcome]));

describe.each(CONFIGS)("module rule integrity (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and mount `victim`, and the guest code as `guest` and `mgr`.
	 * @param {object} [options] - Further slothlet options.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(options = { permissions: { defaultPolicy: "allow", rules: [HOST_DENY] } }) {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
		await api.slothlet.api.add("victim", path.join(FIXTURE, "victim"), { moduleID: "victim" });
		for (const name of ["guest", "mgr"]) await api.slothlet.api.add(name, path.join(FIXTURE, "guest"), { moduleID: name });
		return api;
	}

	describe("a rule is read once", () => {
		it.each([
			["a call target", "victim.v.secret"],
			["a write target", "victim.**:write"],
			["the rule-manager target", "slothlet.permissions.addRule"]
		])("refuses a rule whose target turns into %s after the check", async (_label, late) => {
			await load();
			const outcome = withSuppressedSlothletErrorOutputSync(() => api.guest.x.addShiftingRule("guest.**", late));
			expect(outcome === "INVALID_PERMISSION_RULE" || /^perm-/.test(outcome)).toBe(true);
			expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.callVictimSecret())).toBe("PERMISSION_DENIED");
			const writes = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("victim.v"));
			expect(writes).toEqual(every(writes, "LOOSE_SET_NOT_OWNED"));
			expect(
				withSuppressedSlothletErrorOutputSync(() => api.guest.x.addRuleFor({ caller: "guest.**", target: "victim.**", effect: "allow" }))
			).toBe("INVALID_PERMISSION_RULE");
		});

		it("refuses a rule whose fields are accessors", async () => {
			await load();
			expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.addShiftingRule("guest.**", "guest.**"))).toBe(
				"INVALID_PERMISSION_RULE"
			);
		});

		it.each([["array"], ["entry"]])("refuses an api.add whose permissions option changes after the check (%s)", async (how) => {
			await load();
			const outcome = await withSuppressedSlothletErrorOutput(() => api.guest.x.mountShifting(path.join(FIXTURE, "guest"), how));
			expect(["done", "INVALID_PERMISSION_RULE"]).toContain(outcome);
			expect(api.slothlet.permissions.global.rulesForPath("victim.v.secret").some((rule) => rule.effect === "allow")).toBe(false);
			expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.callVictimSecret())).toBe("PERMISSION_DENIED");
		});

		it("replays the rule as it was added, not as the module changed it afterwards", async () => {
			await load();
			expect(await api.guest.x.addKeptRule()).toMatch(/^perm-/);
			await api.guest.x.changeKeptRule("victim.v.secret");
			await api.slothlet.reload();
			expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.callVictimSecret())).toBe("PERMISSION_DENIED");
		});

		it("replays a module's own rule across a reload exactly as before", async () => {
			await load({ permissions: { defaultPolicy: "allow", rules: [] } });
			expect(await api.victim.v.grant(GUEST_ALLOW_VICTIM)).toMatch(/^perm-/);
			await api.slothlet.reload();
			const granted = await api.guest.x.writeAt("victim.v");
			expect(granted).toEqual(every(granted, "done"));
			// Still at the module layer: an equally specific host deny added after the reload wins.
			api.slothlet.permissions.addRule({ caller: "guest.**", target: "victim.**:write", effect: "deny" });
			const denied = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("victim.v"));
			expect(denied).toEqual(every(denied, "PERMISSION_DENIED"));
		});
	});

	describe("a condition of a rule module code adds runs as that module", () => {
		it("keeps the condition to the module's own writes when another module's call is checked", async () => {
			await load({ permissions: { defaultPolicy: "allow", rules: [] } });
			expect(api.guest.x.addWritingCondition("victim.v")).toMatch(/^perm-/);
			api.guest.x.takeConditionWrites();
			await withSuppressedSlothletErrorOutput(() => api.victim.v.callAt("guest.x.listSelf"));
			const writes = api.guest.x.takeConditionWrites();
			expect(writes.length).toBeGreaterThan(0);
			expect([...new Set(writes)]).toEqual(["LOOSE_SET_NOT_OWNED"]);
			expect(api.victim.v.viaCondition).toBeUndefined();
		});

		it("keeps it so for a rule in the permissions option of an api.add module code makes", async () => {
			await load({ permissions: { defaultPolicy: "allow", rules: [] } });
			// The condition writes the calling module's own node: run as that caller it could, run as the module that
			// mounted the rule it may not.
			const writes = [];
			const condition = () => {
				try {
					self.guest.sub.v.viaCondition = 1;
					writes.push("done");
				} catch (error) {
					writes.push(error?.code ?? String(error));
				}
				return true;
			};
			const permissions = { allow: [{ target: "guest.**", condition }] };
			expect(await api.guest.x.addAt("guest.sub", path.join(FIXTURE, "victim"), { moduleID: "gsub", permissions })).toBe("done");
			await withSuppressedSlothletErrorOutput(() => api.guest.sub.v.callAt("guest.x.listSelf"));
			expect(writes.length).toBeGreaterThan(0);
			expect([...new Set(writes)]).toEqual(["LOOSE_SET_NOT_OWNED"]);
			expect(api.guest.sub.v.viaCondition).toBeUndefined();
		});

		it("stops running it once that module is removed, even when another module takes its moduleID", async () => {
			api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, permissions: {} });
			await api.slothlet.api.add("g", path.join(FIXTURE, "guest"), { moduleID: "gA" });
			const runs = [];
			const condition = () => {
				try {
					self.z.v.viaStale = 1;
					runs.push("done");
				} catch (error) {
					runs.push(error?.code ?? String(error));
				}
				return true;
			};
			const permissions = { allow: [{ target: "g.kid.**:write", condition }] };
			expect(await api.g.x.addAt("g.kid", path.join(FIXTURE, "guest"), { moduleID: "kid", permissions })).toBe("done");
			await api.slothlet.api.remove("gA");
			await api.slothlet.api.add("z", path.join(FIXTURE, "victim"), { moduleID: "gA" });
			await withSuppressedSlothletErrorOutput(() => api.g.kid.x.writeAt("g.kid.x"));
			expect(runs).not.toContain("done");
			expect(api.z.v.viaStale).toBeUndefined();
		});

		it("keeps it so for an event rule's condition", async () => {
			await load({
				permissions: { defaultPolicy: "allow", rules: [{ caller: "guest.**", target: "slothlet.event.rules.add", effect: "allow" }] }
			});
			expect(api.guest.x.addWritingEventCondition("victim.v")).toMatch(/^evt-/);
			api.guest.x.takeConditionWrites();
			api.victim.v.listen("guest.zap");
			await api.guest.x.shout("guest.zap", { n: 1 });
			await new Promise((resolve) => setTimeout(resolve, 20));
			const writes = api.guest.x.takeConditionWrites();
			expect(writes.length).toBeGreaterThan(0);
			expect([...new Set(writes)]).toEqual(["LOOSE_SET_NOT_OWNED"]);
			expect(api.victim.v.viaCondition).toBeUndefined();
		});

		it("keeps it so across a reload", async () => {
			await load({ permissions: { defaultPolicy: "allow", rules: [] } });
			expect(api.guest.x.addWritingCondition("victim.v")).toMatch(/^perm-/);
			await api.slothlet.reload();
			api.guest.x.takeConditionWrites();
			await withSuppressedSlothletErrorOutput(() => api.victim.v.callAt("guest.x.listSelf"));
			const writes = api.guest.x.takeConditionWrites();
			expect(writes.length).toBeGreaterThan(0);
			expect([...new Set(writes)]).toEqual(["LOOSE_SET_NOT_OWNED"]);
			expect(api.victim.v.viaCondition).toBeUndefined();
		});
	});

	describe("event rules module code adds, with the permission system off", () => {
		it("refuses an event rule beyond the module's own events", async () => {
			await load({});
			const before = api.slothlet.event.resolveLevel("victim.v", "victim.ping");
			expect(api.guest.x.addEventRuleFor({ caller: "**", event: "**", effect: "deny" })).toBe("INVALID_PERMISSION_RULE");
			expect(api.guest.x.addEventRuleFor({ caller: "**", event: "victim.**", effect: "deny" })).toBe("INVALID_PERMISSION_RULE");
			expect(api.slothlet.event.resolveLevel("victim.v", "victim.ping")).toBe(before);
		});

		it("lets a module add and remove event rules for its own events", async () => {
			await load({});
			const ruleId = api.guest.x.addEventRuleFor({ caller: "victim.**", event: "guest.**", effect: "deny" });
			expect(ruleId).toMatch(/^evt-/);
			expect(api.slothlet.event.resolveLevel("victim.v", "guest.ping")).toBe("deny");
			expect(api.guest.x.removeEventRuleFor(ruleId)).toBe(true);
			expect(api.slothlet.event.resolveLevel("victim.v", "guest.ping")).not.toBe("deny");
		});

		it("refuses a module removing the host's event rule, even for its own events", async () => {
			await load({});
			const hostId = api.slothlet.event.rules.add({ caller: "victim.**", event: "guest.*", effect: "deny" });
			expect(api.guest.x.removeEventRuleFor(hostId)).toBe("INVALID_PERMISSION_RULE");
			expect(api.slothlet.event.resolveLevel("victim.v", "guest.ping")).toBe("deny");
		});

		it("ranks the module's event rule below the host's, across a reload too", async () => {
			await load({});
			api.slothlet.event.rules.add({ caller: "victim.**", event: "guest.*", effect: "deny" });
			expect(api.guest.x.addEventRuleFor({ caller: "victim.**", event: "guest.*", effect: "allow" })).toMatch(/^evt-/);
			expect(api.slothlet.event.resolveLevel("victim.v", "guest.ping")).toBe("deny");
			await api.slothlet.reload();
			expect(api.slothlet.event.resolveLevel("victim.v", "guest.ping")).toBe("deny");
		});

		it("lets the condition of a module's event rule write anywhere, as nothing decides writes", async () => {
			await load({});
			expect(api.guest.x.addWritingEventCondition("victim.v")).toMatch(/^evt-/);
			api.guest.x.takeConditionWrites();
			api.victim.v.listen("guest.zap");
			await api.guest.x.shout("guest.zap", { n: 1 });
			await new Promise((resolve) => setTimeout(resolve, 20));
			const writes = api.guest.x.takeConditionWrites();
			expect(writes.length).toBeGreaterThan(0);
			expect([...new Set(writes)]).toEqual(["done"]);
			expect(api.victim.v.viaCondition).toBe(1);
		});
	});

	describe("a principal module code registers", () => {
		it("computes its key as that module, whichever caller's call is checked", async () => {
			await load({
				permissions: {
					defaultPolicy: "allow",
					rules: [
						{ caller: "guest.**", target: "slothlet.permissions.principal.register", effect: "allow" },
						{ caller: "victim.**", target: "guest.**", effect: "allow", requires: ["writer"] }
					]
				}
			});
			expect(api.guest.x.registerWritingPrincipal("writer", "victim.v")).toBe("done");
			api.guest.x.takeConditionWrites();
			await withSuppressedSlothletErrorOutput(() => api.victim.v.callAt("guest.x.listSelf"));
			const writes = api.guest.x.takeConditionWrites();
			expect(writes.length).toBeGreaterThan(0);
			expect([...new Set(writes)]).toEqual(["LOOSE_SET_NOT_OWNED"]);
			expect(api.victim.v.viaKey).toBeUndefined();
		});
	});

	describe("a condition is data the framework copied", () => {
		it.each([
			["nested in", "nested", "call"],
			["as", "whole", "call"],
			["nested in an event rule's", "nested", "event"],
			["as an event rule's", "whole", "event"]
		])("refuses a Proxy %s condition, and nothing it could do runs at a later check", async (_label, where, kind) => {
			await load(kind === "event" ? {} : { permissions: { defaultPolicy: "allow", rules: [] } });
			expect(api.guest.x.addProxyCondition("victim.v", where, kind)).toBe("INVALID_PERMISSION_RULE");
			api.guest.x.takeConditionWrites();
			if (kind === "event") {
				api.victim.v.listen("guest.zap");
				await api.guest.x.shout("guest.zap", { n: 1 });
				await new Promise((resolve) => setTimeout(resolve, 20));
			} else {
				await withSuppressedSlothletErrorOutput(() => api.victim.v.callAt("guest.x.listSelf"));
			}
			expect(api.guest.x.takeConditionWrites()).toEqual([]);
			expect(api.victim.v.viaProxy).toBeUndefined();
		});

		it("refuses a Proxy in a condition the host adds", async () => {
			await load({ permissions: { defaultPolicy: "allow", rules: [] } });
			const condition = { tenant: new Proxy({}, {}) };
			expect(() => api.slothlet.permissions.addRule({ caller: "**", target: "guest.**", effect: "allow", condition })).toThrow(
				expect.objectContaining({ code: "INVALID_PERMISSION_RULE" })
			);
		});
	});

	describe("a removed module's event rules", () => {
		it("go with it, and stay gone across a reload", async () => {
			await load({});
			const before = api.slothlet.event.resolveLevel("victim.v", "guest.ping");
			expect(api.guest.x.addEventRuleFor({ caller: "victim.**", event: "guest.**", effect: "deny" })).toMatch(/^evt-/);
			const hostId = api.slothlet.event.rules.add({ caller: "victim.**", event: "victim.*", effect: "deny" });
			expect(api.slothlet.event.resolveLevel("victim.v", "guest.ping")).toBe("deny");
			await api.slothlet.api.remove("guest");
			expect(api.slothlet.event.resolveLevel("victim.v", "guest.ping")).toBe(before);
			expect(api.slothlet.event.resolveLevel("victim.v", "victim.ping")).toBe("deny");
			await api.slothlet.reload();
			expect(api.slothlet.event.resolveLevel("victim.v", "guest.ping")).toBe(before);
			expect(api.slothlet.event.resolveLevel("victim.v", "victim.ping")).toBe("deny");
			expect(typeof hostId).toBe("string");
		});
	});

	describe("removing rules from module code", () => {
		it("refuses a module removing a host rule in its own subtree", async () => {
			await load();
			const ruleId = api.slothlet.permissions.addRule({ caller: "victim.**", target: "guest.x.writeAt", effect: "deny" });
			expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.removeRuleFor(ruleId))).toBe("INVALID_PERMISSION_RULE");
			expect(api.slothlet.permissions.global.rulesForPath("guest.x.writeAt").some((rule) => rule.id === ruleId)).toBe(true);
		});

		it("refuses a module removing another module's rule in its own subtree", async () => {
			await load();
			const ruleId = await api.mgr.x.addRuleFor({ caller: "mgr.**", target: "mgr.**:write", effect: "deny" });
			expect(ruleId).toMatch(/^perm-/);
			expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.removeRuleFor(ruleId))).toBe("INVALID_PERMISSION_RULE");
		});

		it("refuses a rule manager removing a host rule or a built-in one, and lets it remove a module's", async () => {
			await load({ permissions: { defaultPolicy: "allow", rules: [HOST_DENY, DELEGATE] } });
			const hostRule = api.slothlet.permissions.addRule({ caller: "guest.**", target: "victim.v.secret", effect: "deny" });
			expect(withSuppressedSlothletErrorOutputSync(() => api.mgr.x.removeRuleFor(hostRule))).toBe("INVALID_PERMISSION_RULE");
			const builtinRule = api.slothlet.permissions.global
				.rulesForPath("slothlet.restart")
				.find((rule) => rule.ownerModuleID === "__builtin__").id;
			expect(withSuppressedSlothletErrorOutputSync(() => api.mgr.x.removeRuleFor(builtinRule))).toBe("INVALID_PERMISSION_RULE");
			const victimRule = await api.victim.v.grant(GUEST_ALLOW_VICTIM);
			expect(await api.mgr.x.removeRuleFor(victimRule)).toBe(true);
		});
	});

	describe("a module's mount below another module's", () => {
		/**
		 * Mount the guest code at `outer` and again at `outer.inner`, as two modules, with the permission system on:
		 * ownership decides writes only while it is on.
		 * @returns {Promise<object>} The composed api.
		 */
		async function nest() {
			api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, permissions: { defaultPolicy: "allow" } });
			await api.slothlet.api.add("outer", path.join(FIXTURE, "guest"), { moduleID: "outer" });
			await api.slothlet.api.add("outer.inner", path.join(FIXTURE, "guest"), { moduleID: "inner" });
			return api;
		}

		it("is not the outer module's to write", async () => {
			await nest();
			const refused = withSuppressedSlothletErrorOutputSync(() => api.outer.x.writeAt("outer.inner.x"));
			expect(refused).toEqual(every(refused, "LOOSE_SET_NOT_OWNED"));
			const own = await api.outer.inner.x.writeAt("outer.inner.x");
			expect(own).toEqual(every(own, "done"));
			const outerOwn = await api.outer.x.writeAt("outer.x");
			expect(outerOwn).toEqual(every(outerOwn, "done"));
		});

		it("is not the outer module's to register rules for", async () => {
			await nest();
			expect(
				withSuppressedSlothletErrorOutputSync(() =>
					api.outer.x.addRuleFor({ caller: "**", target: "outer.inner.**:write", effect: "allow" })
				)
			).toBe("INVALID_PERMISSION_RULE");
		});

		it("leaves two modules mounted at the same point sharing it", async () => {
			api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true });
			await api.slothlet.api.add("co", path.join(FIXTURE, "guest"), { moduleID: "co-guest" });
			await api.slothlet.api.add("co", path.join(FIXTURE, "victim"), { moduleID: "co-victim" });
			const report = await api.co.x.writeAt("co.v");
			expect(report).toEqual(every(report, "done"));
		});
	});

	describe("a removed module's rules", () => {
		it("go with a rule manager that is removed, and stay gone across a reload", async () => {
			await load({ permissions: { defaultPolicy: "allow", rules: [DELEGATE] } });
			expect(await api.mgr.x.addRuleFor(GUEST_ALLOW_VICTIM)).toMatch(/^perm-/);
			const granted = await api.guest.x.writeAt("victim.v");
			expect(granted).toEqual(every(granted, "done"));
			await api.slothlet.api.remove("mgr");
			const refused = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("victim.v"));
			expect(refused).toEqual(every(refused, "LOOSE_SET_NOT_OWNED"));
			await api.slothlet.reload();
			const still = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("victim.v"));
			expect(still).toEqual(every(still, "LOOSE_SET_NOT_OWNED"));
		});

		it("go with a manifest module that is removed", async () => {
			await load({ permissions: { defaultPolicy: "allow", rules: [] } });
			await api.slothlet.api.modules.addModule("@local/vault-grant-other", {
				discover: { scanRoot: path.join(FIXTURE, "modules", "vault-grant-other") }
			});
			const granted = await api.guest.x.writeAt("victim.v");
			expect(granted).toEqual(every(granted, "done"));
			await api.slothlet.api.remove("vault");
			const refused = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("victim.v"));
			expect(refused).toEqual(every(refused, "LOOSE_SET_NOT_OWNED"));
		});

		it("leave the host's rules naming the module's paths in place", async () => {
			await load({
				permissions: { defaultPolicy: "allow", rules: [GUEST_ALLOW_VICTIM, { caller: "mgr.**", target: "mgr.**", effect: "allow" }] }
			});
			await api.slothlet.api.remove("mgr");
			const granted = await api.guest.x.writeAt("victim.v");
			expect(granted).toEqual(every(granted, "done"));
			expect(api.slothlet.permissions.global.rulesForPath("mgr.x").some((rule) => rule.caller === "mgr.**")).toBe(true);
		});
	});
});
