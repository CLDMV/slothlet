/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-module-alias.test.vitest.mjs
 *	@Date: 2026-10-19T11:48:08-07:00 (1792435688)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-23T17:07:43-07:00 (1792800463)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A node a module stored under its own subtree stays its owner's to change (#625).
 *
 * Module code may store another module's node under its own path (`self.guest.x.ref = self.victim.v`), as plain
 * JS stores a reference, and reads and calls through it work. `api.add` and `api.remove` from module code judge
 * each node they walk by its real path and owner, not by the path it was reached at: an add through such an alias
 * into another module's node is refused with nothing planted, and removing the alias drops only the alias, never
 * the node it stands for; the framework's setters are judged the same way. An alias to a node the module owns
 * behaves as that node. A removal the host makes does
 * not walk through an alias either. A path that runs through an accessor — a getter defined on a node, or one on an
 * object stored there — or through a Proxy a module stored is refused to module code without running the getter, and a version dispatcher stored as an
 * alias is judged by the versioned node it routes to. The host is unrestricted: its own add through an alias
 * places into the node the alias stands for. With and without the permission system, in all four mode / runtime
 * configurations.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/`, `guest/`, and `holder/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const GUEST = path.join(FIXTURE, "guest");
const VICTIM = path.join(FIXTURE, "victim");
const HOLDER = path.join(FIXTURE, "holder");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

const PERMISSIONS = [
	{ label: "no permissions config", options: {} },
	{ label: "permissions with defaults", options: { permissions: {} } }
];

describe.each(CONFIGS)("aliases a module stores (#625) — $mode / $runtime", ({ mode, runtime }) => {
	describe.each(PERMISSIONS)("$label", ({ options }) => {
		let api;

		afterEach(async () => {
			if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
			api = null;
		});

		/**
		 * Load the base module, mount `victim` and the guest code at `guest`, and have the guest store an alias of
		 * `victim.v` at `guest.x.ref`.
		 * @returns {Promise<object>} The composed api.
		 */
		async function load() {
			api = await slothlet({
				base: path.join(FIXTURE, "base"),
				mode,
				runtime,
				silent: true,
				api: { mutations: { allowCollisionOverride: true } },
				...options
			});
			await api.slothlet.api.add("victim", VICTIM, { moduleID: "victim" });
			await api.slothlet.api.add("guest", GUEST, { moduleID: "guest" });
			expect(await api.guest.x.storeAlias("guest.x", "ref", "victim.v")).toBe("done");
			return api;
		}

		/**
		 * Whether the victim's node is whole: its members answer as the victim wrote them.
		 * @returns {Promise<void>} Resolves when every check passed.
		 */
		async function victimIntact() {
			expect(await api.victim.v.secret()).toBe("SECRET");
			expect(typeof api.victim.v.listSelf).toBe("function");
			expect(api.victim.v.planted).toBeUndefined();
			expect(api.victim.v.injected).toBeUndefined();
		}

		it("lets reads and calls go through the alias", async () => {
			await load();
			expect(await api.guest.x.ref.secret()).toBe("SECRET");
			expect(await api.guest.x.callAt("guest.x.ref.secret")).toBe("SECRET");
		});

		it.each([
			["merge", { collisionMode: "merge" }],
			["replace", { collisionMode: "replace" }],
			["forceOverwrite", { forceOverwrite: true }],
			["default", {}]
		])("refuses an add through the alias into the aliased node (%s), and plants nothing", async (_label, addOptions) => {
			await load();
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.addInjected("guest.x.ref", "planted", addOptions))).toBe(
				"LOOSE_SET_NOT_OWNED"
			);
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.addAt("guest.x.ref.deep", HOLDER, { moduleID: "deep" }))).toBe(
				"LOOSE_SET_NOT_OWNED"
			);
			await victimIntact();
			expect(api.victim.v.deep).toBeUndefined();
		});

		it("refuses the framework's setters through the alias", async () => {
			await load();
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.callSetter("setFor", "guest.x.ref"))).toBe("LOOSE_SET_NOT_OWNED");
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.callSetter("reload", "guest.x.ref"))).toBe("LOOSE_SET_NOT_OWNED");
			expect(api.slothlet.metadata.getFor("victim.v").planted).toBeUndefined();
			await victimIntact();
		});

		it("removes only the alias, never the aliased node", async () => {
			await load();
			expect(await api.guest.x.removeAt("guest.x.ref")).toBe(true);
			expect(api.guest.x.ref).toBeUndefined();
			await victimIntact();
		});

		it("does not remove the aliased node's members through the alias", async () => {
			await load();
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.removeAt("guest.x.ref.secret"))).toBe(false);
			await victimIntact();
		});

		it("leaves the aliased node whole when the host removes the module that stored it", async () => {
			await load();
			await api.slothlet.api.remove("guest");
			expect(api.guest).toBeUndefined();
			await victimIntact();
		});

		it("leaves the aliased node whole when the alias replaced a node of the module the host removes", async () => {
			await load();
			expect(await api.guest.x.storeAlias("guest", "x", "victim.v")).toBe("done");
			await api.slothlet.api.remove("guest");
			expect(api.guest).toBeUndefined();
			await victimIntact();
		});

		it("treats an alias to the module's own node as that node", async () => {
			await load();
			expect(await api.guest.x.storeAlias("guest", "mine", "guest.x")).toBe("done");
			expect(await api.guest.x.addInjected("guest.mine", "planted", { collisionMode: "merge" })).toBe("done");
			expect(await api.guest.x.planted.injected()).toBe("injected");
			expect(await api.guest.x.removeAt("guest.mine")).toBe(true);
			expect(api.guest.mine).toBeUndefined();
			expect(typeof api.guest.x.listSelf).toBe("function");
		});

		describe("through an accessor or a version dispatcher", () => {
			/**
			 * Load, and have the host mount the victim code as version `v1` of `victim.lib`.
			 * @returns {Promise<object>} The composed api.
			 */
			async function loadVersioned() {
				await load();
				await api.slothlet.api.add("victim.lib", VICTIM, { moduleID: "vl1" }, { version: "v1" });
				return api;
			}

			/**
			 * Whether the versioned victim node is whole: nothing was placed into it.
			 * @returns {Promise<void>} Resolves when every check passed.
			 */
			async function versionedIntact() {
				expect(await api.v1.victim.lib.v.secret()).toBe("SECRET");
				expect(api.v1.victim.lib.v.zz).toBeUndefined();
				expect(api.v1.victim.lib.zz).toBeUndefined();
			}

			it.each([
				["a getter defined on the module's node", (x) => x.defineGetterAlias("guest.x", "g", "victim.v"), "guest.x.g"],
				["a getter on an object the module stored", (x) => x.storeGetterObject("guest.x", "b", "r", "victim.v"), "guest.x.b.r"],
				["a Proxy the module stored", (x) => x.storeProxyObject("guest.x", "p", "r", "victim.v"), "guest.x.p.r"]
			])("refuses an add through %s, and plants nothing", async (_label, store, at) => {
				await load();
				expect(await store(api.guest.x)).toBe("done");
				expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.addAt(`${at}.zz`, HOLDER, { moduleID: "gz" }))).toBe(
					"LOOSE_SET_NOT_OWNED"
				);
				expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.addInjected(at, "zz", { collisionMode: "merge" }))).toBe(
					"LOOSE_SET_NOT_OWNED"
				);
				expect(api.victim.v.zz).toBeUndefined();
				await victimIntact();
				await api.slothlet.api.remove("guest");
				expect(api.victim.v.zz).toBeUndefined();
				await victimIntact();
			});

			it("refuses the setters and removes nothing through a getter", async () => {
				await load();
				expect(await api.guest.x.defineGetterAlias("guest.x", "g", "victim.v")).toBe("done");
				api.slothlet.metadata.setFor("victim.v", "kept", 1);
				for (const what of ["setFor", "removeFor", "reload"]) {
					expect({ what, outcome: await withSuppressedSlothletErrorOutput(() => api.guest.x.callSetter(what, "guest.x.g")) }).toEqual({
						what,
						outcome: "LOOSE_SET_NOT_OWNED"
					});
				}
				expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.removeAt("guest.x.g.secret"))).toBe(false);
				expect(api.slothlet.metadata.getFor("victim.v").kept).toBe(1);
				expect(api.slothlet.metadata.getFor("victim.v").planted).toBeUndefined();
				await victimIntact();
			});

			it("refuses an add through a version dispatcher stored as an alias, and plants nothing, before and after the host removes the module", async () => {
				await loadVersioned();
				expect(await api.guest.x.storeAlias("guest.x", "vl", "victim.lib")).toBe("done");
				expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.addAt("guest.x.vl.v.zz", HOLDER, { moduleID: "vz" }))).toBe(
					"LOOSE_SET_NOT_OWNED"
				);
				expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.addInjected("guest.x.vl", "zz", { collisionMode: "merge" }))).toBe(
					"LOOSE_SET_NOT_OWNED"
				);
				await versionedIntact();
				await api.slothlet.api.remove("guest");
				await versionedIntact();
			});

			it("refuses the setters and removes nothing through a version dispatcher stored as an alias", async () => {
				await loadVersioned();
				expect(await api.guest.x.storeAlias("guest.x", "vl", "victim.lib")).toBe("done");
				for (const what of ["setFor", "reload"]) {
					expect({ what, outcome: await withSuppressedSlothletErrorOutput(() => api.guest.x.callSetter(what, "guest.x.vl")) }).toEqual({
						what,
						outcome: "LOOSE_SET_NOT_OWNED"
					});
				}
				expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.removeAt("guest.x.vl.v"))).toBe(false);
				await versionedIntact();
			});

			it("leaves the host placing into the node a host alias or getter stands for", async () => {
				await load();
				api.guest.x.hostRef = api.victim.v;
				const node = api.victim.v;
				Object.defineProperty(api.guest.x, "hostGetter", { get: () => node, configurable: true });
				await api.slothlet.api.add("guest.x.hostRef", { exports: { viaRef: { ok: () => "ref" } } }, { moduleID: "hr" });
				await api.slothlet.api.add("guest.x.hostGetter.viaGetter", { exports: { ok: () => "getter" } }, { moduleID: "hg" });
				expect(await api.victim.v.viaRef.ok()).toBe("ref");
				expect(await api.victim.v.viaGetter.ok()).toBe("getter");
			});
		});
	});
});
