/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-module-mounts.test.vitest.mjs
 *	@Date: 2026-10-19T00:11:55-07:00 (1792393915)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-19T11:34:42-07:00 (1792434882)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `api.add` and `api.remove` from module code are writes; a module's rules for its subtree cover
 * what is mounted below it; removing a module by its path takes its rules with it; a rule's condition is read
 * once (#625).
 *
 * Module code mounting at a path, replacing an existing subtree, or removing one writes there: it needs to own the
 * path (the ownership registry) or a `:write` allow naming it, and the framework's write rules apply. Host code is
 * unchanged. A rule a module registers for its own subtree matches its pattern as written, so it covers every
 * module mounted below that path too.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/` (also mounted as `parent` and `parent.child`),
 * `guest/` (also mounted as `mgr`, `other`, `third`, `mp`).
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const GUEST = path.join(FIXTURE, "guest");
const VICTIM = path.join(FIXTURE, "victim");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

const DELEGATE = { caller: "mgr.**", target: "slothlet.permissions.addRule", effect: "allow" };

/**
 * The report expected when every change has the same outcome.
 * @param {Record<string, string>} report - Outcomes by change.
 * @param {string} outcome - The outcome.
 * @returns {Record<string, string>} The same keys, each `outcome`.
 */
const every = (report, outcome) => Object.fromEntries(Object.keys(report).map((key) => [key, outcome]));

describe.each(CONFIGS)("module mounts and rule reach (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and mount `victim`, and the guest code as `guest`, `mgr`, and `other`.
	 * @param {object} [options] - Further slothlet options; the permission system is on unless they say otherwise, as write rules apply only then.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(options = { permissions: {} }) {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
		await api.slothlet.api.add("victim", VICTIM, { moduleID: "victim" });
		for (const name of ["guest", "mgr", "other"]) await api.slothlet.api.add(name, GUEST, { moduleID: name });
		return api;
	}

	describe("api.add and api.remove from module code are writes", () => {
		it("refuses mounting under another module's path, a manager's included", async () => {
			await load({ permissions: { rules: [DELEGATE] } });
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.addAt("mgr.evil", GUEST, { moduleID: "evil" }))).toBe(
				"LOOSE_SET_NOT_OWNED"
			);
			expect(api.mgr.evil).toBeUndefined();
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.addAt("victim.extra", GUEST, { moduleID: "extra" }))).toBe(
				"LOOSE_SET_NOT_OWNED"
			);
			expect(api.victim.extra).toBeUndefined();
		});

		it("refuses replacing another module's subtree", async () => {
			await load();
			expect(
				await withSuppressedSlothletErrorOutput(() => api.guest.x.addAt("victim", GUEST, { moduleID: "imp", forceOverwrite: true }))
			).toBe("LOOSE_SET_NOT_OWNED");
			expect(await api.victim.v.secret()).toBe("SECRET");
			expect(api.victim.x).toBeUndefined();
		});

		it("refuses removing another module, by path, by moduleID, or scoped", async () => {
			await load();
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.removeAt("victim"))).toBe("LOOSE_SET_NOT_OWNED");
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.removeAt("victim.v"))).toBe("LOOSE_SET_NOT_OWNED");
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.removeAt("victim", "victim.v"))).toBe("LOOSE_SET_NOT_OWNED");
			expect(await api.victim.v.secret()).toBe("SECRET");
		});

		it("refuses mounting at the framework namespace", async () => {
			await load();
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.addAt("slothlet.evil", GUEST, { moduleID: "evil" }))).toBe(
				"PERMISSION_DENIED"
			);
		});

		it("lets a module mount under its own path, and the mounted module remove itself", async () => {
			await load();
			expect(await api.guest.x.addAt("guest.sub2", GUEST, { moduleID: "sub2" })).toBe("done");
			expect(typeof api.guest.sub2.x.listSelf).toBe("function");
			expect(await api.guest.sub2.x.removeAt("guest.sub2")).toBe(true);
			expect(api.guest.sub2).toBeUndefined();
		});

		it("lets a host write grant allow mounting and removing under another module's path", async () => {
			await load({
				permissions: {
					rules: [
						{ caller: "guest.**", target: "victim.**:write", effect: "allow" },
						{ caller: "guest.**", target: "victim:write", effect: "allow" }
					]
				}
			});
			expect(await api.guest.x.addAt("victim.extra", GUEST, { moduleID: "extra" })).toBe("done");
			expect(typeof api.victim.extra.x.listSelf).toBe("function");
			expect(await api.guest.x.removeAt("victim.extra")).toBe(true);
		});

		it("lets a host write deny refuse mounting under the module's own path", async () => {
			await load({ permissions: { rules: [{ caller: "guest.**", target: "guest.blocked:write", effect: "deny" }] } });
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.addAt("guest.blocked", GUEST, { moduleID: "blocked" }))).toBe(
				"PERMISSION_DENIED"
			);
		});

		it("leaves the host mounting and removing anywhere", async () => {
			await load();
			await api.slothlet.api.add("victim.hostExtra", GUEST, { moduleID: "host-extra" });
			expect(typeof api.victim.hostExtra.x.listSelf).toBe("function");
			expect(await api.slothlet.api.remove("victim.hostExtra")).toBe(true);
		});
	});

	describe("a moduleID module code mounts with", () => {
		it("is refused when it belongs to another mounted module", async () => {
			await load();
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.addAt("guest.imp", GUEST, { moduleID: "victim" }))).toBe(
				"MODULE_ID_IN_USE"
			);
			expect(api.guest.imp).toBeUndefined();
			expect(await api.victim.v.secret()).toBe("SECRET");
		});

		it("is allowed when it is the module's own, or not mounted", async () => {
			await load();
			expect(await api.guest.x.addAt("guest.own", GUEST, { moduleID: "guest" })).toBe("done");
			expect(typeof api.guest.own.x.listSelf).toBe("function");
			expect(await api.guest.x.addAt("guest.fresh", GUEST, { moduleID: "fresh" })).toBe("done");
			expect(typeof api.guest.fresh.x.listSelf).toBe("function");
		});

		it("leaves the host re-using a moduleID", async () => {
			await load();
			await api.slothlet.api.add("victim2", VICTIM, { moduleID: "victim" });
			expect(await api.victim2.v.secret()).toBe("SECRET");
		});
	});

	describe("a mount a module added", () => {
		it("is the adding module's to remove, by path, by moduleID, or scoped within it", async () => {
			await load();
			expect(await api.guest.x.addAt("guest.kid", GUEST, { moduleID: "kid" })).toBe("done");
			expect(await api.guest.x.removeAt("kid", "guest.kid.x")).toBe(true);
			expect(await api.guest.x.removeAt("guest.kid")).toBe(true);
			expect(api.guest.kid).toBeUndefined();
			expect(await api.guest.x.addAt("guest.kid", GUEST, { moduleID: "kid" })).toBe("done");
			expect(await api.guest.x.removeAt("kid")).toBe(true);
			expect(api.guest.kid).toBeUndefined();
		});

		it("is not a sibling module's to remove", async () => {
			await load();
			expect(await api.guest.x.addAt("guest.kid", GUEST, { moduleID: "kid" })).toBe("done");
			expect(await withSuppressedSlothletErrorOutput(() => api.other.x.removeAt("guest.kid"))).toBe("LOOSE_SET_NOT_OWNED");
			expect(await withSuppressedSlothletErrorOutput(() => api.other.x.removeAt("kid"))).toBe("LOOSE_SET_NOT_OWNED");
			expect(typeof api.guest.kid.x.listSelf).toBe("function");
		});

		it("is not the module's to remove when the host mounted it below the module's path", async () => {
			await load();
			await api.slothlet.api.add("guest.hostkid", GUEST, { moduleID: "hostkid" });
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.removeAt("guest.hostkid"))).toBe("LOOSE_SET_NOT_OWNED");
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.removeAt("hostkid"))).toBe("LOOSE_SET_NOT_OWNED");
			expect(typeof api.guest.hostkid.x.listSelf).toBe("function");
		});

		it("stays the adding module's to remove across a reload, and not a sibling's", async () => {
			await load();
			expect(await api.guest.x.addAt("guest.kid", GUEST, { moduleID: "kid" })).toBe("done");
			await api.slothlet.api.add("guest.hostkid", GUEST, { moduleID: "hostkid" });
			await api.slothlet.reload();
			expect(await withSuppressedSlothletErrorOutput(() => api.other.x.removeAt("guest.kid"))).toBe("LOOSE_SET_NOT_OWNED");
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.removeAt("guest.hostkid"))).toBe("LOOSE_SET_NOT_OWNED");
			expect(await api.guest.x.removeAt("guest.kid")).toBe(true);
			expect(api.guest.kid).toBeUndefined();
		});
	});

	describe("a parent module's rules for its subtree", () => {
		/**
		 * Mount the victim code at `parent` and again at `parent.child`, as two modules, and the guest code at `third`.
		 * @param {object} [options] - Further slothlet options; the permission system is on unless they say otherwise, as write rules apply only then.
		 * @returns {Promise<object>} The composed api.
		 */
		async function nest(options = { permissions: {} }) {
			api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
			await api.slothlet.api.add("parent", VICTIM, { moduleID: "parent" });
			await api.slothlet.api.add("parent.child", VICTIM, { moduleID: "child" });
			await api.slothlet.api.add("third", GUEST, { moduleID: "third" });
			return api;
		}

		it("cover a module mounted below the parent: a parent.**:write allow", async () => {
			await nest();
			expect(await api.parent.v.grant({ caller: "third.**", target: "parent.**:write", effect: "allow" })).toMatch(/^perm-/);
			const parent = await api.third.x.writeAt("parent.v");
			expect(parent).toEqual(every(parent, "done"));
			const child = await api.third.x.writeAt("parent.child.v");
			expect(child).toEqual(every(child, "done"));
		});

		it("cover a module mounted below the parent: a parent.** call rule", async () => {
			await nest({ permissions: {} });
			expect(await api.parent.v.grant({ caller: "third.**", target: "parent.**.secret", effect: "deny" })).toMatch(/^perm-/);
			expect(await withSuppressedSlothletErrorOutput(() => api.third.x.callAt("parent.v.secret"))).toBe("PERMISSION_DENIED");
			expect(await withSuppressedSlothletErrorOutput(() => api.third.x.callAt("parent.child.v.secret"))).toBe("PERMISSION_DENIED");
		});
	});

	describe("removing a module by its path", () => {
		it("takes its rules and their history with it when the path is not its moduleID", async () => {
			await load();
			await api.slothlet.api.add("mp", GUEST, { moduleID: "mpid" });
			expect(await api.mp.x.addRuleFor({ caller: "guest.**", target: "mp.**:write", effect: "allow" })).toMatch(/^perm-/);
			expect(await api.guest.x.writeAt("mp.x")).toEqual(every(await api.guest.x.writeAt("mp.x"), "done"));
			expect(await api.slothlet.api.remove("mp")).toBe(true);
			expect(api.slothlet.permissions.global.rulesByModule("mpid")).toEqual([]);
			await api.slothlet.api.add("mp", GUEST, { moduleID: "mpid" });
			const refused = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("mp.x"));
			expect(refused).toEqual(every(refused, "LOOSE_SET_NOT_OWNED"));
			await api.slothlet.reload();
			const still = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("mp.x"));
			expect(still).toEqual(every(still, "LOOSE_SET_NOT_OWNED"));
		});
	});

	describe("a rule's condition", () => {
		it("is read once, so changing it afterwards changes nothing", async () => {
			await load();
			expect(await api.guest.x.addKeptConditionalRule()).toMatch(/^perm-/);
			await api.guest.x.changeKeptCondition("b");
			const inA = await api.slothlet.context.run({ tenant: "a" }, () => api.other.x.writeAt("guest.x"));
			expect(inA).toEqual(every(inA, "done"));
			const inB = await api.slothlet.context.run({ tenant: "b" }, () =>
				withSuppressedSlothletErrorOutputSync(() => api.other.x.writeAt("guest.x"))
			);
			expect(inB).toEqual(every(inB, "LOOSE_SET_NOT_OWNED"));
		});
	});
});
