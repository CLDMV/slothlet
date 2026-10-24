/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-module-multi-mount.test.vitest.mjs
 *	@Date: 2026-10-19T07:44:45-07:00 (1792421085)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-19T08:46:06-07:00 (1792424766)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module mounted at several paths, removals that are all-or-nothing, and mount points two modules
 * share (#625).
 *
 * Module code removing a module by its moduleID, a path, or its share of a path removes every path the removal
 * reaches: each is checked first — owned, granted, or a mount the caller performed — and if any is refused nothing
 * changes. A removal by moduleID removes every mount of the module, and a reload afterwards produces the same
 * state. Two modules mounted at the same point share that point's subtree only, not each other's other mounts.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/` (mounted as `vic` at several paths),
 * `guest/`.
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

/**
 * The report expected when every change has the same outcome.
 * @param {Record<string, string>} report - Outcomes by change.
 * @param {string} outcome - The outcome.
 * @returns {Record<string, string>} The same keys, each `outcome`.
 */
const every = (report, outcome) => Object.fromEntries(Object.keys(report).map((key) => [key, outcome]));

describe.each(CONFIGS)("modules mounted at several paths (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and mount the guest code at `guest`, as the module `gmod` (so `"guest"` names its path).
	 * @param {object} [options] - Further slothlet options.
	 * @returns {Promise<object>} The composed api.
	 */
	async function boot(options = {}) {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
		await api.slothlet.api.add("guest", GUEST, { moduleID: "gmod" });
		return api;
	}

	it("refuses module code removing a module by moduleID when one of its mounts is out of reach, and changes nothing", async () => {
		await boot({
			permissions: {
				rules: [
					{ caller: "guest.**", target: "guest.vic:write", effect: "allow" },
					{ caller: "guest.**", target: "guest.vic.**:write", effect: "allow" }
				]
			}
		});
		await api.slothlet.api.add("elsewhere", VICTIM, { moduleID: "vic" });
		await api.slothlet.api.add("guest.vic", VICTIM, { moduleID: "vic" });
		expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.removeAt("vic"))).toBe("LOOSE_SET_NOT_OWNED");
		expect(await api.elsewhere.v.secret()).toBe("SECRET");
		expect(await api.guest.vic.v.secret()).toBe("SECRET");
		expect(await api.slothlet.api.remove("vic")).toBe(true);
		expect(api.elsewhere).toBeUndefined();
		expect(api.guest.vic).toBeUndefined();
	});

	it("removes every mount of a module the host removes by moduleID, and a reload keeps it removed", async () => {
		await boot();
		await api.slothlet.api.add("other", GUEST, { moduleID: "other" });
		await api.slothlet.api.add("a", VICTIM, { moduleID: "vic" });
		await api.slothlet.api.add("b", VICTIM, { moduleID: "vic" });
		expect(await api.a.v.grant({ caller: "other.**", target: "a.**:write", effect: "allow" })).toMatch(/^perm-/);
		expect(await api.slothlet.api.remove("vic")).toBe(true);
		const live = { a: api.a === undefined, b: api.b === undefined, rules: api.slothlet.permissions.global.rulesByModule("vic").length };
		expect(live).toEqual({ a: true, b: true, rules: 0 });
		await api.slothlet.reload();
		expect({ a: api.a === undefined, b: api.b === undefined, rules: api.slothlet.permissions.global.rulesByModule("vic").length }).toEqual(
			live
		);
	});

	it.each([
		["the module mounting itself there, with a grant there only", true],
		["the host merging it there, with no grant, so sharing is what allows the write at shared", false]
	])("does not extend a shared mount point to the other module's other mounts: %s", async (_label, byModule) => {
		await boot(
			byModule
				? {
						permissions: {
							rules: [
								{ caller: "guest.**", target: "shared:write", effect: "allow" },
								{ caller: "guest.**", target: "shared.**:write", effect: "allow" }
							]
						}
					}
				: {}
		);
		await api.slothlet.api.add("a", VICTIM, { moduleID: "vic" });
		await api.slothlet.api.add("shared", VICTIM, { moduleID: "vic" });
		if (byModule) expect(await api.guest.x.addAt("shared", GUEST, { moduleID: "gmod", collisionMode: "merge" })).toBe("done");
		else await api.slothlet.api.add("shared", GUEST, { moduleID: "gmod", collisionMode: "merge" });
		const sharedWrites = await api.guest.x.writeAt("shared.v");
		expect(sharedWrites).toEqual(every(sharedWrites, "done"));
		const refused = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("a.v"));
		expect(refused).toEqual(every(refused, "LOOSE_SET_NOT_OWNED"));
	});

	describe("a mount the caller performed, with the host's mount of the same module inside it", () => {
		/**
		 * The guest mounts `kid` at `guest.k`; the host mounts `kid` again at `guest.k.zone`.
		 * @returns {Promise<object>} The composed api.
		 */
		async function nested() {
			await boot();
			expect(await api.guest.x.addAt("guest.k", GUEST, { moduleID: "kid" })).toBe("done");
			await api.slothlet.api.add("guest.k.zone", VICTIM, { moduleID: "kid" });
			return api;
		}

		it.each([
			["by moduleID", (a) => a.guest.x.removeAt("kid")],
			["by path", (a) => a.guest.x.removeAt("guest.k")],
			["scoped", (a) => a.guest.x.removeAt("kid", "guest.k.zone")]
		])("refuses the caller removing it %s, and changes nothing", async (_label, remove) => {
			await nested();
			expect(await withSuppressedSlothletErrorOutput(() => remove(api))).toBe("LOOSE_SET_NOT_OWNED");
			expect(typeof api.guest.k.x.listSelf).toBe("function");
			expect(await api.guest.k.zone.v.secret()).toBe("SECRET");
		});

		it("lets the caller remove what it mounted when no host mount is inside it", async () => {
			await boot();
			expect(await api.guest.x.addAt("guest.k", GUEST, { moduleID: "kid" })).toBe("done");
			expect(await api.guest.x.removeAt("kid", "guest.k.x")).toBe(true);
			expect(await api.guest.x.removeAt("kid")).toBe(true);
			expect(api.guest.k).toBeUndefined();
		});
	});

	describe("removing a module by its moduleID", () => {
		it("removes the module with that exact id, not one whose id starts with it, for the host", async () => {
			await boot();
			await api.slothlet.api.add("vicpath", VICTIM, { moduleID: "vic" });
			await api.slothlet.api.add("other", GUEST, { moduleID: "vic_x" });
			expect(await api.slothlet.api.remove("vic")).toBe(true);
			expect(api.vicpath).toBeUndefined();
			expect(typeof api.other.x.listSelf).toBe("function");
		});

		it("removes the module with that exact id, not one whose id starts with it, for module code", async () => {
			await boot();
			expect(await api.guest.x.addAt("guest.vic", VICTIM, { moduleID: "vic" })).toBe("done");
			await api.slothlet.api.add("other", GUEST, { moduleID: "vic_x" });
			expect(await api.guest.x.removeAt("vic")).toBe(true);
			expect(api.guest.vic).toBeUndefined();
			expect(typeof api.other.x.listSelf).toBe("function");
		});
	});

	it("refuses module code removing its own path while a module the host mounted below it sits there, and changes nothing", async () => {
		await boot();
		await api.slothlet.api.add("guest.hostkid", GUEST, { moduleID: "hostkid" });
		expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.removeAt("guest"))).toBe("LOOSE_SET_NOT_OWNED");
		expect(typeof api.guest.x.listSelf).toBe("function");
		expect(typeof api.guest.hostkid.x.listSelf).toBe("function");
	});

	it("lets module code remove its own path with a module it mounted below it", async () => {
		await boot();
		expect(await api.guest.x.addAt("guest.kid", GUEST, { moduleID: "kid" })).toBe("done");
		expect(await api.guest.x.removeAt("guest")).toBe(true);
		expect(api.guest).toBeUndefined();
	});
});
