/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-module-entry-points.test.vitest.mjs
 *	@Date: 2026-10-19T09:38:54-07:00 (1792427934)
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
 * @fileoverview Every way module code writes into the api is held to the write permissions (#625).
 *
 * A manifest's rules apply as declared when the host mounts its module; when module code mounts it, they are that
 * module's rules and placed like `addRule`'s, so a rule beyond the caller's subtree refuses the whole mount. An
 * `api.add` from module code writes at every path its content creates or merges into, whatever the collision mode,
 * all checked before anything changes; in lazy mode its content is loaded for the check. A path with surrounding
 * whitespace is checked as the path it mounts. The framework's metadata, versioning, and reload setters, called by
 * module code on another module's paths, are writes there. `metadata.setGlobal` is the host's while the permission
 * system is on, unless an allow lifts it. `api.modules.removeModule` from module code removes every matching mount or
 * none. A refused `api.add` leaves no ownership entries behind. The host is unchanged throughout.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/`, `guest/` (also mounted as `atk`, `other`),
 * `holder/`, and the manifest modules `modules/evilgrant` and `modules/goodgrant`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

/** Honors a per-call `collisionMode` / `mutateExisting`, which `api.add` otherwise ignores. */
const OVERRIDE = { api: { mutations: { allowCollisionOverride: true } } };

/** Turns the permission system on, so a write rule grants a write. */
const PERMISSIONS_ON = { permissions: { defaultPolicy: "allow" } };

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const GUEST = path.join(FIXTURE, "guest");
const VICTIM = path.join(FIXTURE, "victim");
const HOLDER = path.join(FIXTURE, "holder");
const EVIL = path.join(FIXTURE, "modules", "evilgrant");
const GOOD = path.join(FIXTURE, "modules", "goodgrant");

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

describe.each(CONFIGS)("module-code entry points (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and mount `victim`, and the guest code at `guest`, `atk`, and `other`.
	 * @param {object} [options] - Further slothlet options.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(options = {}) {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
		await api.slothlet.api.add("victim", VICTIM, { moduleID: "victim" });
		for (const name of ["guest", "atk", "other"]) await api.slothlet.api.add(name, GUEST, { moduleID: name });
		return api;
	}

	describe("mounting a module with a manifest", () => {
		const evilResult = () => ({
			packageName: "evil",
			mountPath: ["guest", "sub"],
			apiDir: path.join(EVIL, "evilgrant", "api"),
			manifest: {
				version: "1.0.0",
				permissions: [
					{ caller: "guest.**", target: "victim.**:write", effect: "allow" },
					{ caller: "guest.**", target: "slothlet.permissions.addRule", effect: "allow" }
				]
			}
		});

		it.each([
			["addModule", () => evilResult()],
			["addModules", () => [evilResult()]],
			["addDiscovered", () => ({ scanRoot: EVIL })]
		])("refuses module code mounting one whose rules reach beyond its subtree through %s, and mounts nothing", async (entry, arg) => {
			await load();
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.mountModule(entry, arg()))).toBe("INVALID_PERMISSION_RULE");
			expect(api.guest.sub).toBeUndefined();
			const refused = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("victim.v"));
			expect(refused).toEqual(every(refused, "LOOSE_SET_NOT_OWNED"));
			expect(
				withSuppressedSlothletErrorOutputSync(() => api.guest.x.addRuleFor({ caller: "guest.**", target: "victim.**", effect: "allow" }))
			).toBe("INVALID_PERMISSION_RULE");
		});

		it("lets module code mount one whose rules stay in its subtree", async () => {
			await load(PERMISSIONS_ON);
			expect(await api.guest.x.mountModule("addDiscovered", { scanRoot: GOOD })).toBe("done");
			expect(api.guest.good.info.name()).toBe("info");
			const granted = await api.other.x.writeAt("guest.x");
			expect(granted).toEqual(every(granted, "done"));
		});

		it("applies a manifest the host mounts as declared", async () => {
			await load(PERMISSIONS_ON);
			await api.slothlet.api.modules.addDiscovered({ scanRoot: EVIL });
			const granted = await api.guest.x.writeAt("victim.v");
			expect(granted).toEqual(every(granted, "done"));
		});
	});

	describe("an api.add's content", () => {
		it.each([
			["merge", { collisionMode: "merge" }],
			["mutateExisting", { mutateExisting: true }],
			["skip", { collisionMode: "skip" }],
			["warn", { collisionMode: "warn" }],
			["default", {}]
		])("does not land in a module the host mounted below the caller's path (%s)", async (_label, options) => {
			await load(OVERRIDE);
			await api.slothlet.api.add("atk.hostmount", GUEST, { moduleID: "hostmount" });
			const outcome = await withSuppressedSlothletErrorOutput(() => api.atk.x.addInjected("atk", "hostmount", options));
			expect(outcome).toBe("LOOSE_SET_NOT_OWNED");
			expect(api.atk.hostmount.injected).toBeUndefined();
			expect(typeof api.atk.hostmount.x.listSelf).toBe("function");
		});

		it("does not get past a host write deny below the caller's path", async () => {
			await load({ ...OVERRIDE, permissions: { rules: [{ caller: "atk.**", target: "atk.locked:write", effect: "deny" }] } });
			expect(await withSuppressedSlothletErrorOutput(() => api.atk.x.addInjected("atk", "locked", { collisionMode: "merge" }))).toBe(
				"PERMISSION_DENIED"
			);
			expect(api.atk.locked).toBeUndefined();
		});

		it("does not land a folder's content in a module the host mounted below the caller's path", async () => {
			await load(OVERRIDE);
			await api.slothlet.api.add("atk.kid", GUEST, { moduleID: "hostkid" });
			expect(
				await withSuppressedSlothletErrorOutput(() => api.atk.x.addAt("atk", HOLDER, { moduleID: "atkholder", collisionMode: "merge" }))
			).toBe("LOOSE_SET_NOT_OWNED");
			expect(api.atk.kid.note).toBeUndefined();
			expect(api.atk.deep).toBeUndefined();
		});

		it("lands content under the caller's own path", async () => {
			await load(OVERRIDE);
			expect(await api.atk.x.addInjected("atk", "fresh", { collisionMode: "merge" })).toBe("done");
			expect(await api.atk.fresh.injected()).toBe("injected");
		});
	});

	describe("a path with surrounding whitespace", () => {
		it("is checked as the path it mounts", async () => {
			await load({ permissions: { rules: [{ caller: "guest.**", target: "guest.locked:write", effect: "deny" }] } });
			await api.slothlet.api.add("guest.hostmount", GUEST, { moduleID: "hostmount" });
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.addAt("guest.locked ", GUEST, { moduleID: "lk" }))).toBe(
				"PERMISSION_DENIED"
			);
			expect(api.guest.locked).toBeUndefined();
			expect(
				await withSuppressedSlothletErrorOutput(() =>
					api.guest.x.addAt("guest.hostmount ", VICTIM, { moduleID: "hm2", forceOverwrite: true })
				)
			).toBe("LOOSE_SET_NOT_OWNED");
			expect(typeof api.guest.hostmount.x.listSelf).toBe("function");
		});
	});

	describe("a versioned add", () => {
		it("is refused when its tagged mount is granted but its dispatcher path is another module's", async () => {
			await load({
				permissions: {
					rules: [
						{ caller: "guest.**", target: "v1:write", effect: "allow" },
						{ caller: "guest.**", target: "v1.**:write", effect: "allow" }
					]
				}
			});
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.addAtVersion("victim.lib", GUEST, { moduleID: "gv" }, "v1"))).toBe(
				"LOOSE_SET_NOT_OWNED"
			);
			expect(api.v1?.victim).toBeUndefined();
			expect(api.victim.lib).toBeUndefined();
		});
	});

	describe("the framework's setters", () => {
		/**
		 * Load, and have the host mount the victim code as two versions of `vlib`.
		 * @returns {Promise<object>} The composed api.
		 */
		async function versioned() {
			await load();
			await api.slothlet.api.add("vlib", VICTIM, { moduleID: "vv1" }, { version: "v1", default: true });
			await api.slothlet.api.add("vlib", VICTIM, { moduleID: "vv2" }, { version: "v2" });
			return api;
		}

		it.each([
			["metadata.setFor", "setFor", "victim.v"],
			["metadata.removeFor", "removeFor", "victim.v"],
			["metadata.set", "set", "victim.v.secret"],
			["api.reload by moduleID", "reload", "victim"],
			["api.reload by path", "reload", "victim.v"]
		])("refuses module code calling %s on another module's path", async (_label, what, target) => {
			await load();
			api.slothlet.metadata.setFor("victim.v", "kept", 1);
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.callSetter(what, target))).toBe("LOOSE_SET_NOT_OWNED");
			expect(await api.victim.v.secret()).toBe("SECRET");
			expect(api.slothlet.metadata.getFor("victim.v")).toMatchObject({ kept: 1 });
			expect(api.slothlet.metadata.getFor("victim.v").planted).toBeUndefined();
			expect(api.slothlet.metadata.getFor("victim.v.secret").planted).toBeUndefined();
		});

		it("refuses module code removing another module's metadata", async () => {
			await load();
			api.slothlet.metadata.setFor("victim.v", "planted", 1);
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.callSetter("removeFor", "victim.v"))).toBe("LOOSE_SET_NOT_OWNED");
			expect(api.slothlet.metadata.getFor("victim.v").planted).toBe(1);
		});

		it.each([
			["versioning.setDefault", "setDefault"],
			["versioning.setVersionMetadata", "setVersionMetadata"],
			["metadata.setForVersion", "setForVersion"]
		])("refuses module code calling %s on another module's versions", async (_label, what) => {
			await versioned();
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.callSetter(what, "vlib", "v2"))).toBe("LOOSE_SET_NOT_OWNED");
			expect(api.slothlet.versioning.list("vlib").default).toBe("v1");
			expect(api.slothlet.versioning.getVersionMetadata("vlib", "v2")?.planted).toBeUndefined();
			expect(api.slothlet.metadata.getForVersion("vlib", "v2")?.planted).toBeUndefined();
		});

		it("lets module code call them on its own paths, and leaves the host calling them anywhere", async () => {
			await versioned();
			expect(await api.guest.x.callSetter("setFor", "guest.x")).toBe("done");
			expect(api.slothlet.metadata.getFor("guest.x").planted).toBe(1);
			expect(await api.guest.x.callSetter("reload", "guest")).toBe("done");
			api.slothlet.metadata.setFor("victim.v", "hostSet", 1);
			expect(api.slothlet.metadata.getFor("victim.v").hostSet).toBe(1);
			api.slothlet.versioning.setDefault("vlib", "v2");
			expect(api.slothlet.versioning.list("vlib").default).toBe("v2");
		});
	});

	describe("metadata.setGlobal", () => {
		it("is refused to module code with the permission system on, and changes nothing", async () => {
			await load({ permissions: { defaultPolicy: "allow" } });
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.callSetter("setGlobal", ""))).toBe("PERMISSION_DENIED");
			expect(api.slothlet.metadata.getFor("victim.v").planted).toBeUndefined();
			api.slothlet.metadata.setGlobal("hostGlobal", 1);
			expect(api.slothlet.metadata.getFor("victim.v").hostGlobal).toBe(1);
		});

		it("is granted to module code by an allow", async () => {
			await load({
				permissions: { defaultPolicy: "allow", rules: [{ caller: "guest.**", target: "slothlet.metadata.setGlobal", effect: "allow" }] }
			});
			expect(await api.guest.x.callSetter("setGlobal", "")).toBe("done");
			expect(api.slothlet.metadata.getFor("victim.v").planted).toBe(1);
		});

		it("is left to module code with the permission system off", async () => {
			await load();
			expect(await api.guest.x.callSetter("setGlobal", "")).toBe("done");
			expect(api.slothlet.metadata.getFor("victim.v").planted).toBe(1);
		});
	});

	describe("api.modules.removeModule", () => {
		/**
		 * A discover result for a `good` package version mounted at `mountPath`.
		 * @param {string} version - The version.
		 * @param {string[]} mountPath - Where it mounts.
		 * @returns {object} The discover result.
		 */
		const goodResult = (version, mountPath) => ({
			packageName: "good",
			mountPath,
			apiDir: path.join(GOOD, "goodgrant", "api"),
			manifest: { version }
		});

		/**
		 * Load, have the guest mount `good@1.0.0` under its own path, and the host mount `good@2.0.0` at `victim.good`.
		 * @returns {Promise<object>} The composed api.
		 */
		async function mounted() {
			await load();
			expect(await api.guest.x.mountModule("addModule", goodResult("1.0.0", ["guest", "good"]))).toBe("done");
			await api.slothlet.api.modules.addModule(goodResult("2.0.0", ["victim", "good"]));
			return api;
		}

		it("refuses module code removing every match when one of them is not its own, and removes none", async () => {
			await mounted();
			expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.removeModuleNamed("good"))).toBe("LOOSE_SET_NOT_OWNED");
			expect(api.guest.good.info.name()).toBe("info");
			expect(api.victim.good.info.name()).toBe("info");
		});

		it("lets module code remove the mount it made", async () => {
			await mounted();
			expect(await api.guest.x.removeModuleNamed("good", { version: "1.0.0" })).toBe(true);
			expect(api.guest.good).toBeUndefined();
			expect(api.victim.good.info.name()).toBe("info");
		});
	});

	describe("a refused api.add", () => {
		it("leaves no ownership entries behind", async () => {
			await load({ ...OVERRIDE, diagnostics: true });
			await api.slothlet.api.add("atk.kid", GUEST, { moduleID: "hostkid" });
			const before = api.slothlet.diag.getOwnership();
			expect(
				await withSuppressedSlothletErrorOutput(() => api.atk.x.addAt("atk", HOLDER, { moduleID: "atkpay", collisionMode: "merge" }))
			).toBe("LOOSE_SET_NOT_OWNED");
			const after = api.slothlet.diag.getOwnership();
			expect(after.modules.map((entry) => entry.moduleID)).not.toContain("atkpay");
			expect(after.totalPaths).toBe(before.totalPaths);
			for (const apiPath of ["atk.deep", "atk.deep.inner", "atk.deep.inner.leaf", "atk.kid.note"]) {
				expect(api.slothlet.diag.owner.get(apiPath)?.has("atkpay") ?? false).toBe(false);
			}
		});
	});
});
