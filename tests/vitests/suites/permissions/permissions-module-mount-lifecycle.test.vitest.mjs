/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-module-mount-lifecycle.test.vitest.mjs
 *	@Date: 2026-10-19T06:05:38-07:00 (1792415138)
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
 * @fileoverview What a module's removal takes with it, and what it leaves (#625).
 *
 * A module keeps its rules, rule history, principals, listeners, mounter records, and id until its last live mount is
 * gone, however that happens: removed by its moduleID, or its path removed (a removed path takes the paths under
 * it, so a mount inside it is gone). A moduleID the host mounts at several paths
 * keeps all of it until its last mount goes; removing one mount removes only that mount's paths. A module mounted
 * below a removed module is another module, and stays.
 * The record of which module mounted another is bound to that mount and is cleared when the mounting module is
 * removed, so a module that later takes the freed id inherits nothing. Live state after a removal matches what a
 * reload then produces.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/`, `guest/` (mounted under several ids and paths).
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const GUEST = path.join(FIXTURE, "guest");
const HOLDER = path.join(FIXTURE, "holder");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

/**
 * The report expected when every change has the same outcome.
 * @param {Record<string, string>} report - Outcomes by change.
 * @param {string} outcome - The outcome.
 * @returns {Record<string, string>} The same keys, each `outcome`.
 */
const every = (report, outcome) => Object.fromEntries(Object.keys(report).map((key) => [key, outcome]));

describe.each(CONFIGS)("module mount lifecycle (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module.
	 * @param {object} [options] - Further slothlet options; the permission system is on unless they say otherwise, as write rules apply only then.
	 * @returns {Promise<object>} The composed api.
	 */
	async function boot(options = { permissions: {} }) {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
		return api;
	}

	it("does not let a module that takes a removed mounter's id remove what that mounter mounted", async () => {
		await boot({
			permissions: {
				rules: [
					{ caller: "guest.**", target: "shared.**:write", effect: "allow" },
					{ caller: "guest.**", target: "shared:write", effect: "allow" }
				]
			}
		});
		await api.slothlet.api.add("guest", GUEST, { moduleID: "guest" });
		await api.slothlet.api.add("other", GUEST, { moduleID: "other" });
		expect(await api.guest.x.addAt("shared.kid", GUEST, { moduleID: "kid" })).toBe("done");
		await api.slothlet.api.remove("guest");
		expect(typeof api.shared.kid.x.listSelf).toBe("function");
		expect(await api.other.x.addAt("other.imp", GUEST, { moduleID: "guest" })).toBe("done");
		expect(await withSuppressedSlothletErrorOutput(() => api.other.imp.x.removeAt("shared.kid"))).toBe("LOOSE_SET_NOT_OWNED");
		await api.slothlet.reload();
		expect(await withSuppressedSlothletErrorOutput(() => api.other.imp.x.removeAt("shared.kid"))).toBe("LOOSE_SET_NOT_OWNED");
		expect(typeof api.shared.kid.x.listSelf).toBe("function");
		// The mounted module stays its own: it may still remove itself.
		expect(await api.shared.kid.x.removeAt("shared.kid")).toBe(true);
	});

	/**
	 * Mount the guest code at `guest` as `g1` and at `other`; `g1` mounts `guest.kid` as `kid`, which grants
	 * `other` writes into its subtree.
	 * @returns {Promise<object>} The composed api.
	 */
	async function nestKid() {
		await boot();
		await api.slothlet.api.add("guest", GUEST, { moduleID: "g1" });
		await api.slothlet.api.add("other", GUEST, { moduleID: "other" });
		expect(await api.guest.x.addAt("guest.kid", GUEST, { moduleID: "kid" })).toBe("done");
		expect(await api.guest.kid.x.addRuleFor({ caller: "other.**", target: "guest.kid.**:write", effect: "allow" })).toMatch(/^perm-/);
		return api;
	}

	it("leaves a module mounted below a module removed by its moduleID mounted, with its rules", async () => {
		await nestKid();
		await api.slothlet.api.remove("g1");
		expect(typeof api.guest.kid.x.listSelf).toBe("function");
		expect(api.slothlet.permissions.global.rulesByModule("kid")).toHaveLength(1);
		const granted = await api.other.x.writeAt("guest.kid.x");
		expect(granted).toEqual(every(granted, "done"));
		expect(await withSuppressedSlothletErrorOutput(() => api.other.x.addAt("other.k", GUEST, { moduleID: "kid" }))).toBe(
			"MODULE_ID_IN_USE"
		);
	});

	it("takes both modules when the path they are mounted under is removed", async () => {
		await nestKid();
		await api.slothlet.api.remove("guest");
		expect(api.slothlet.permissions.global.rulesByModule("kid")).toEqual([]);
		expect(await api.other.x.addAt("other.k", GUEST, { moduleID: "kid" })).toBe("done");
		expect(await api.other.x.addAt("other.g", GUEST, { moduleID: "g1" })).toBe("done");
	});

	describe("a container the removed module owns", () => {
		/**
		 * Mount `holder` at `guest` as `g1` (it owns `guest.kid` and `guest.deep.inner`), and the guest code merged into
		 * `guest.kid` as `kid`.
		 * @returns {Promise<object>} The composed api.
		 */
		async function holder() {
			await boot();
			await api.slothlet.api.add("guest", HOLDER, { moduleID: "g1" });
			await api.slothlet.api.add("guest.kid", GUEST, { moduleID: "kid", collisionMode: "merge" });
			return api;
		}

		/**
		 * What is left of the tree under `guest`.
		 * @returns {object} The keys at `guest` and `guest.kid`, or `"gone"`.
		 */
		const tree = () => ({
			guest: api.guest === undefined ? "gone" : Object.keys(api.guest).sort(),
			kid: api.guest?.kid === undefined ? "gone" : Object.keys(api.guest.kid).sort()
		});

		it("stays while it holds another module's content, and an empty chain of its containers is pruned", async () => {
			await holder();
			await api.slothlet.api.remove("g1");
			const live = tree();
			expect(live).toEqual({ guest: ["kid"], kid: ["x"] });
			expect(typeof api.guest.kid.x.listSelf).toBe("function");
			await api.slothlet.reload();
			expect(tree()).toEqual(live);
		});

		it("goes with the removed module when the other module's content is gone", async () => {
			await holder();
			await api.slothlet.api.remove("kid");
			await api.slothlet.api.remove("g1");
			const live = tree();
			expect(live).toEqual({ guest: "gone", kid: "gone" });
			await api.slothlet.reload();
			expect(tree()).toEqual(live);
		});
	});

	it("keeps a moduleID the host mounted at two paths whole until its last mount is removed", async () => {
		await boot();
		await api.slothlet.api.add("other", GUEST, { moduleID: "other" });
		await api.slothlet.api.add("p1", GUEST, { moduleID: "m" });
		await api.slothlet.api.add("p2", GUEST, { moduleID: "m" });
		expect(await api.p1.x.addRuleFor({ caller: "other.**", target: "p1.**:write", effect: "allow" })).toMatch(/^perm-/);
		expect(api.slothlet.permissions.global.rulesByModule("m")).toHaveLength(1);
		expect(await api.slothlet.api.remove("p2")).toBe(true);
		expect(api.p2).toBeUndefined();
		expect(api.slothlet.permissions.global.rulesByModule("m")).toHaveLength(1);
		const own = await api.p1.x.writeAt("p1.x");
		expect(own).toEqual(every(own, "done"));
		const granted = await api.other.x.writeAt("p1.x");
		expect(granted).toEqual(every(granted, "done"));
		expect(await api.slothlet.api.remove("p1")).toBe(true);
		expect(api.slothlet.permissions.global.rulesByModule("m")).toEqual([]);
		expect(await api.other.x.addAt("other.m", GUEST, { moduleID: "m" })).toBe("done");
	});

	const GONE = { guest: "gone", kid: "gone", kidRules: 0, g1Rules: 0, kidFree: "done" };
	// Removing a module by its moduleID, or its share of a path, takes only that module: the module mounted below it
	// stays, with its rules and id.
	const KID_STAYS = { guest: "object", kid: "object", kidRules: 1, g1Rules: 0, kidFree: "MODULE_ID_IN_USE" };
	it.each([
		["by moduleID", (a) => a.slothlet.api.remove("g1"), KID_STAYS],
		["by path", (a) => a.slothlet.api.remove("guest"), GONE],
		["scoped", (a) => a.slothlet.api.remove("g1", "guest"), KID_STAYS]
	])("leaves the same state after a removal %s as a reload then produces", async (_label, remove, expected) => {
		await boot();
		await api.slothlet.api.add("guest", GUEST, { moduleID: "g1" });
		await api.slothlet.api.add("other", GUEST, { moduleID: "other" });
		await api.guest.x.addAt("guest.kid", GUEST, { moduleID: "kid" });
		await api.guest.kid.x.addRuleFor({ caller: "other.**", target: "guest.kid.**:write", effect: "allow" });
		await remove(api);
		/**
		 * The state a removal leaves.
		 * @returns {Promise<object>} What is mounted, which rules remain, and whether `other` may write there.
		 */
		const state = async () => ({
			guest: api.guest === undefined ? "gone" : typeof api.guest,
			kid: api.guest?.kid === undefined ? "gone" : typeof api.guest.kid,
			kidRules: api.slothlet.permissions.global.rulesByModule("kid").length,
			g1Rules: api.slothlet.permissions.global.rulesByModule("g1").length,
			kidFree: await withSuppressedSlothletErrorOutput(() => api.other.x.addAt("other.free", GUEST, { moduleID: "kid" }))
		});
		const live = await state();
		if (live.kidFree === "done") await api.slothlet.api.remove("other.free");
		await api.slothlet.reload();
		expect(await state()).toEqual(live);
		expect(live).toEqual(expected);
	});
});
