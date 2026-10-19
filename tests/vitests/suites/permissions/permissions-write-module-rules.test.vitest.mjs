/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-write-module-rules.test.vitest.mjs
 *	@Date: 2026-10-18T20:43:32-07:00 (1792381412)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T21:35:52-07:00 (1792384552)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Rules a module registers: for its own subtree by default, beyond it once allowed; and what a
 * manifest declares (#625).
 *
 * Permissions, write permission among them, are granted by the host and by modules. Module code registers rules —
 * through `self.slothlet.permissions.addRule` / `removeRule` and the `permissions` option of an `api.add` it
 * makes — for targets inside its own subtree (checked on the pattern's literal prefix), of any kind: call, hook,
 * or `:write`, allow or deny. Any other target, the framework's own among them, is the built-in default
 * `{ caller: "**", target: "slothlet.permissions.addRule", effect: "deny" }`, which an explicit allow for the
 * module — the host's or its manifest's — lifts. A manifest is not restricted: mounting it is the consumer's
 * choice. Module rules (a manifest's or module code's) sit below the host's: at equal specificity the host
 * wins, both ways. A write allow is a grant: another module's write goes through whatever it owns.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/`, `guest/` (also mounted as `other` and
 * `mgr`), and the manifest modules under `modules/` (`vault-*` mounted at `vault`, `vault-manager` at `vaultmgr`).
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

const GUEST_ALLOW_VICTIM = { caller: "guest.**", target: "victim.**:write", effect: "allow" };
const GUEST_DENY_VICTIM = { caller: "guest.**", target: "victim.**:write", effect: "deny" };

/**
 * The report expected when every change has the same outcome.
 * @param {Record<string, string>} report - Outcomes by change.
 * @param {string} outcome - The outcome.
 * @returns {Record<string, string>} The same keys, each `outcome`.
 */
const every = (report, outcome) => Object.fromEntries(Object.keys(report).map((key) => [key, outcome]));

describe.each(CONFIGS)("module write rules (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and mount `victim`, and the guest code as `guest`, `other`, and `mgr`.
	 * @param {object} [options] - Further slothlet options.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(options = {}) {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
		await api.slothlet.api.add("victim", path.join(FIXTURE, "victim"), { moduleID: "victim" });
		for (const name of ["guest", "other", "mgr"]) await api.slothlet.api.add(name, path.join(FIXTURE, "guest"), { moduleID: name });
		return api;
	}

	/**
	 * Mount one of the manifest modules at `vault`.
	 * @param {string} name - The fixture package (`vault-grant`, …).
	 * @returns {Promise<string>} `"done"`, or the code the mount was refused with.
	 */
	async function mountVault(name) {
		try {
			await api.slothlet.api.modules.addModule(`@local/${name}`, { discover: { scanRoot: path.join(FIXTURE, "modules", name) } });
			return "done";
		} catch (error) {
			return error?.code ?? String(error);
		}
	}

	describe("through the manifest", () => {
		it("lets the module grant another module writes into its subtree, and refuses a third module", async () => {
			await load();
			expect(await mountVault("vault-grant")).toBe("done");
			const granted = await api.guest.x.writeAt("vault.store");
			expect(granted).toEqual(every(granted, "done"));
			const refused = withSuppressedSlothletErrorOutputSync(() => api.other.x.writeAt("vault.store"));
			expect(refused).toEqual(every(refused, "LOOSE_SET_NOT_OWNED"));
		});

		it("lets the manifest grant one module writes into another module's subtree", async () => {
			await load();
			expect(await mountVault("vault-grant-other")).toBe("done");
			const granted = await api.guest.x.writeAt("victim.v");
			expect(granted).toEqual(every(granted, "done"));
		});

		it("lets the host win over the module's deny with an allow of its own", async () => {
			await load({ permissions: { rules: [{ caller: "guest.**", target: "vault.**:write", effect: "allow" }] } });
			expect(await mountVault("vault-deny")).toBe("done");
			const report = await api.guest.x.writeAt("vault.store");
			expect(report).toEqual(every(report, "done"));
		});

		it("lets the host win over the module's allow with a deny of its own", async () => {
			await load({ permissions: { rules: [{ caller: "guest.**", target: "vault.**:write", effect: "deny" }] } });
			expect(await mountVault("vault-grant")).toBe("done");
			const report = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("vault.store"));
			expect(report).toEqual(every(report, "PERMISSION_DENIED"));
		});

		it("lets the manifest allow its module a call past a more general host deny", async () => {
			await load({ permissions: { rules: [{ caller: "**", target: "victim.**", effect: "deny" }] } });
			expect(await mountVault("vault-manager")).toBe("done");
			expect(await api.vaultmgr.ops.callVictim()).toBe(100);
			expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.callVictim())).toBe("PERMISSION_DENIED");
		});
	});

	describe("through addRule from the module's code", () => {
		it("lets the module grant another module writes into its subtree, and refuses a third module", async () => {
			await load();
			expect(typeof (await api.victim.v.grant(GUEST_ALLOW_VICTIM))).toBe("string");
			const granted = await api.guest.x.writeAt("victim.v");
			expect(granted).toEqual(every(granted, "done"));
			const refused = withSuppressedSlothletErrorOutputSync(() => api.other.x.writeAt("victim.v"));
			expect(refused).toEqual(every(refused, "LOOSE_SET_NOT_OWNED"));
		});

		it("lets the host win over the module's deny with an allow of its own", async () => {
			await load({ permissions: { rules: [GUEST_ALLOW_VICTIM] } });
			await api.victim.v.grant(GUEST_DENY_VICTIM);
			const report = await api.guest.x.writeAt("victim.v");
			expect(report).toEqual(every(report, "done"));
		});

		it("lets the host win over the module's allow with a deny of its own", async () => {
			await load({ permissions: { rules: [GUEST_DENY_VICTIM] } });
			await api.victim.v.grant(GUEST_ALLOW_VICTIM);
			const report = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("victim.v"));
			expect(report).toEqual(every(report, "PERMISSION_DENIED"));
		});

		it.each([["other.**:write"], ["**:write"], ["*.x:write"], ["slothlet.**:write"], ["victim.**.__metadata:write"]])(
			"refuses the module a write rule on %s",
			async (target) => {
				await load();
				expect(withSuppressedSlothletErrorOutputSync(() => api.victim.v.grant({ caller: "guest.**", target, effect: "allow" }))).toBe(
					"INVALID_PERMISSION_RULE"
				);
			}
		);

		it("refuses module code granting itself a call past a host deny (the 3.22.1 escape)", async () => {
			await load({ permissions: { rules: [{ caller: "**", target: "victim.**", effect: "deny" }] } });
			expect(
				withSuppressedSlothletErrorOutputSync(() => api.guest.x.addRuleFor({ caller: "guest.**", target: "victim.**", effect: "allow" }))
			).toBe("INVALID_PERMISSION_RULE");
			expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.callVictim())).toBe("PERMISSION_DENIED");
		});

		it("lets the module remove its own rule, and refuses another module removing it", async () => {
			await load();
			const ruleId = await api.victim.v.grant(GUEST_ALLOW_VICTIM);
			expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.removeRuleFor(ruleId))).toBe("INVALID_PERMISSION_RULE");
			expect(await api.victim.v.revoke(ruleId)).toBe(true);
			const refused = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("victim.v"));
			expect(refused).toEqual(every(refused, "LOOSE_SET_NOT_OWNED"));
		});

		it("still refuses another module's write into the module's internal keys under a grant", async () => {
			await load();
			await api.victim.v.grant({ caller: "guest.**", target: "victim.**:write", effect: "allow" });
			const report = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeVictimMetadata());
			expect(report).toBe("PERMISSION_DENIED");
		});
	});

	describe("through the permissions option of an api.add the module makes", () => {
		it("lets the module grant the module it mounts writes into its subtree, and refuses a third module", async () => {
			await load();
			expect(await api.victim.v.mountHelper(path.join(FIXTURE, "guest"), { allow: ["victim.**:write"] })).toBe("done");
			const granted = await api.victim.helper.x.writeAt("victim.v");
			expect(granted).toEqual(every(granted, "done"));
			const refused = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("victim.v"));
			expect(refused).toEqual(every(refused, "LOOSE_SET_NOT_OWNED"));
		});

		it("lets the host win over the module's deny with an allow of its own", async () => {
			await load({ permissions: { rules: [{ caller: "victim.helper.**", target: "victim.**:write", effect: "allow" }] } });
			expect(await api.victim.v.mountHelper(path.join(FIXTURE, "guest"), { deny: ["victim.**:write"] })).toBe("done");
			const report = await api.victim.helper.x.writeAt("victim.v");
			expect(report).toEqual(every(report, "done"));
		});

		it("lets the host win over the module's allow with a deny of its own", async () => {
			await load({ permissions: { rules: [{ caller: "victim.helper.**", target: "victim.**:write", effect: "deny" }] } });
			expect(await api.victim.v.mountHelper(path.join(FIXTURE, "guest"), { allow: ["victim.**:write"] })).toBe("done");
			const report = withSuppressedSlothletErrorOutputSync(() => api.victim.helper.x.writeAt("victim.v"));
			expect(report).toEqual(every(report, "PERMISSION_DENIED"));
		});

		it.each([["other.**:write"], ["**:write"], ["slothlet.**:write"]])("refuses mounting with a write rule on %s", async (target) => {
			await load();
			expect(
				await withSuppressedSlothletErrorOutput(() => api.victim.v.mountHelper(path.join(FIXTURE, "guest"), { allow: [target] }))
			).toBe("INVALID_PERMISSION_RULE");
			expect(api.victim.helper).toBeUndefined();
		});

		it("keeps the module's write rule at the module layer across a reload", async () => {
			await load({ permissions: { rules: [{ caller: "victim.helper.**", target: "victim.**:write", effect: "deny" }] } });
			await api.victim.v.mountHelper(path.join(FIXTURE, "guest"), { allow: ["victim.**:write"] });
			await api.slothlet.reload();
			const report = withSuppressedSlothletErrorOutputSync(() => api.victim.helper.x.writeAt("victim.v"));
			expect(report).toEqual(every(report, "PERMISSION_DENIED"));
		});
	});

	it("refuses the write with no rule at all", async () => {
		await load();
		const report = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("victim.v"));
		expect(report).toEqual(every(report, "LOOSE_SET_NOT_OWNED"));
	});

	describe("a module allowed to manage rules beyond its subtree", () => {
		const DELEGATE = { caller: "mgr.**", target: "slothlet.permissions.addRule", effect: "allow" };

		it("lets the manager grant one module writes into another module's subtree, until the rule is removed", async () => {
			await load({ permissions: { rules: [DELEGATE] } });
			const ruleId = await api.mgr.x.addRuleFor(GUEST_ALLOW_VICTIM);
			expect(ruleId).toMatch(/^perm-/);
			const granted = await api.guest.x.writeAt("victim.v");
			expect(granted).toEqual(every(granted, "done"));
			expect(api.slothlet.permissions.removeRule(ruleId)).toBe(true);
			const refused = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("victim.v"));
			expect(refused).toEqual(every(refused, "LOOSE_SET_NOT_OWNED"));
		});

		it("refuses the same rule from a module the host did not delegate to", async () => {
			await load({ permissions: { rules: [DELEGATE] } });
			expect(withSuppressedSlothletErrorOutputSync(() => api.other.x.addRuleFor(GUEST_ALLOW_VICTIM))).toBe("INVALID_PERMISSION_RULE");
		});

		it("refuses a manager under defaultPolicy allow with no explicit host rule", async () => {
			await load({ permissions: { defaultPolicy: "allow" } });
			expect(withSuppressedSlothletErrorOutputSync(() => api.mgr.x.addRuleFor(GUEST_ALLOW_VICTIM))).toBe("INVALID_PERMISSION_RULE");
		});

		it("lets the manager add a write rule on the framework namespace, as the host may", async () => {
			await load({ permissions: { rules: [DELEGATE] } });
			expect(await api.mgr.x.addRuleFor({ caller: "root.**", target: "slothlet.managed:write", effect: "allow" })).toMatch(/^perm-/);
			expect(await api.root.writeManaged()).toBe("done");
			expect(api.slothlet.managed).toBe(1);
		});

		it("lets a module whose own manifest allows it manage rules beyond its subtree", async () => {
			await load();
			expect(await mountVault("vault-manager")).toBe("done");
			expect(await api.vaultmgr.ops.addRuleFor(GUEST_ALLOW_VICTIM)).toMatch(/^perm-/);
			const granted = await api.guest.x.writeAt("victim.v");
			expect(granted).toEqual(every(granted, "done"));
		});

		it("lets the manager remove another module's rule, and refuses a module that is no manager", async () => {
			await load({ permissions: { rules: [DELEGATE] } });
			const ruleId = await api.victim.v.grant(GUEST_ALLOW_VICTIM);
			expect(withSuppressedSlothletErrorOutputSync(() => api.other.x.removeRuleFor(ruleId))).toBe("INVALID_PERMISSION_RULE");
			expect(await api.mgr.x.removeRuleFor(ruleId)).toBe(true);
		});

		it("lets a host deny win over the manager's allow", async () => {
			await load({ permissions: { rules: [DELEGATE, GUEST_DENY_VICTIM] } });
			await api.mgr.x.addRuleFor(GUEST_ALLOW_VICTIM);
			const report = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("victim.v"));
			expect(report).toEqual(every(report, "PERMISSION_DENIED"));
		});
	});
});
