/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permission-manager-direct-edges.test.vitest.mjs
 *	@Date: 2026-11-25T01:34:43-08:00 (1795599283)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:11:48-08:00 (1795601508)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview PermissionManager driven directly, for answers the end-to-end suites reach only on some hosts or not
 * at all: the manager while it is off, a run's copy taking a write made in the run, the queries a module's code makes
 * of it with no context manager, principals that went stale, conditions that hold accessors or cycles, patterns with
 * negation or repeated globstars, and the ownership checks behind module privacy.
 *
 * @description
 * A run's copy is chosen the way an instance chooses it: the instance object's write-target function answers the
 * copy (`helpers/flow-stores`), and the copy is the manager's own fork. Each expected value is the documented answer:
 * a write made in a run lands in the run's copy and leaves the instance's manager as it was.
 * @module tests/vitests/suites/permissions/permission-manager-direct-edges
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { PermissionManager } from "#handlers/permission-manager";
import { FORK, WRITE_TARGET } from "#helpers/flow-stores";
import { SlothletError } from "@cldmv/slothlet/errors";

const managers = [];

afterEach(async () => {
	while (managers.length) await managers.pop().shutdown();
});

/**
 * Build a standalone manager.
 * @param {object[]} [rules] - Config rules.
 * @param {object} [extra] - Extra permission config.
 * @param {object} [handlers] - Handlers the manager reads (ownership, apiManager).
 * @returns {PermissionManager} The manager.
 */
const makeManager = (rules = [], extra = {}, handlers = {}) => {
	const manager = new PermissionManager({
		config: { permissions: { mode: "on", policy: "deny", rules, ...extra } },
		handlers,
		debug: vi.fn(),
		SlothletError
	});
	managers.push(manager);
	return manager;
};

/**
 * A module's wrapper as the manager reads it.
 * @param {string} moduleID - The module.
 * @param {string} [apiPath] - Its api path.
 * @returns {object} The wrapper.
 */
const writer = (moduleID, apiPath = moduleID) => ({ ____slothletInternal: { moduleID, apiPath } });

/**
 * An ownership registry answering a fixed path → module map.
 * @param {Record<string, string>} owners - Path → moduleID.
 * @returns {object} The registry.
 */
const ownershipOf = (owners) => ({
	getCurrentOwner: (path) => (Object.hasOwn(owners, path) ? { moduleID: owners[path] } : null)
});

describe("PermissionManager > a write made in a run lands in the run's copy", () => {
	/**
	 * A manager whose instance routes writes to a copy, as a run does.
	 * @param {object[]} [rules] - Config rules.
	 * @returns {{ manager: PermissionManager, copy: PermissionManager }} The instance's manager and the run's copy.
	 */
	const inRun = (rules = []) => {
		const manager = makeManager(rules);
		const copy = manager[FORK]();
		managers.push(copy);
		manager.slothlet[WRITE_TARGET] = (component) => (component === manager ? copy : component);
		return { manager, copy };
	};

	it("rules, event rules and principals", () => {
		const { manager, copy } = inRun([{ caller: "a.**", target: "b.**", effect: "allow" }]);
		const id = manager.getRulesForPath("b.x").find((rule) => rule.caller === "a.**").id;
		expect(manager.removeRule(id)).toBe(true);
		expect(copy.getRulesForPath("b.x").some((rule) => rule.caller === "a.**")).toBe(false);
		expect(manager.getRulesForPath("b.x").some((rule) => rule.caller === "a.**")).toBe(true);

		const eventId = manager.addEventRule({ caller: "a.**", event: "e.*", effect: "deny" });
		expect(copy.resolveEventLevel("a.x", "e.go")).toBe("deny");
		expect(manager.resolveEventLevel("a.x", "e.go")).not.toBe("deny");
		expect(manager.removeEventRule(eventId)).toBe(true);
		expect(copy.resolveEventLevel("a.x", "e.go")).not.toBe("deny");

		manager.reservePrincipal("roles", "mod_roles");
		expect(manager.unregisterPrincipal("roles", "mod_roles")).toBe(true);
	});

	it("the mode, the seal, read gating, the default routine rules and imported rules", () => {
		const { manager, copy } = inRun();
		manager.setReadGating(false);
		expect(copy.isReadGatingEnabled()).toBe(false);
		expect(manager.isReadGatingEnabled()).toBe(true);
		manager.applyDefaultRoutineRules([{ name: "slothlet.run", mode: "deny" }]);
		manager.importRules([{ rule: { caller: "z.**", target: "y.**", effect: "allow" }, ownerModuleID: null }]);
		expect(copy.getRulesForCaller("z.q").some((rule) => rule.target === "y.**")).toBe(true);
		expect(manager.getRulesForCaller("z.q").some((rule) => rule.target === "y.**")).toBe(false);
		manager.disable();
		expect(copy.isEnabled()).toBe(false);
		expect(manager.isEnabled()).toBe(true);
		manager.enable();
		expect(copy.isEnabled()).toBe(true);
		manager.setMode("off");
		expect(copy.mode()).toBe("off");
		expect(manager.mode()).toBe("on");
		manager.seal();
		expect(copy.isSealed()).toBe(true);
		expect(manager.isSealed()).toBe(false);
	});

	it("a copy keeps the pins of function conditions module code registered", () => {
		const manager = makeManager();
		manager.slothlet.contextManager = { runInContext: (_id, fn, _this, args) => fn(...args) };
		const condition = manager.pinConditions([() => true, { user: "x" }, () => true], writer("mod_a", "a"));
		expect(Array.isArray(condition) && Object.isFrozen(condition)).toBe(true);
		manager.addRule({ caller: "a.**", target: "b.**", effect: "allow", condition }, "mod_a");
		const copy = manager[FORK]();
		managers.push(copy);
		expect(copy.checkAccess("a.x", "b.y", null, null, { user: "x" })).toBe(true);
		manager.removeModuleRules?.("mod_a");
	});
});

describe("PermissionManager > while off, disabled or shut down", () => {
	it("a config mode of false is off", () => {
		const manager = makeManager([], { mode: false });
		expect(manager.mode()).toBe("off");
		expect(manager.report()).toEqual({ mode: "off", baseline: { met: null, checks: [] }, capabilities: expect.any(Array) });
	});

	it("off: no write rules apply, no read could be refused, nothing is granted beyond the built-in rules", () => {
		const manager = makeManager([{ caller: "r.**", target: "o.**:write", effect: "allow" }], { mode: "off" });
		expect(manager.writeRulesFor("r.x")).toBe("");
		expect(manager.readMayRefuseBeneath("r.x", "o")).toBe(false);
		expect(manager.isWriteGranted("r.x", "o.v")).toBe(false);
		expect(manager.mayReachPrivate("r.x", "o", null, null)).toBe(true);
		expect(() => manager.assertCapabilityForPaths(["r.x"], "code", "new Function")).not.toThrow();
		expect(() => manager.assertGlobalMetadataWrite(writer("mod_r", "r"))).not.toThrow();
	});

	it("disabled: no built-in write rule covers anything", () => {
		const manager = makeManager([], { mode: "disabled" });
		expect(manager.coversWrite("slothlet.metadata")).toBe(false);
	});

	it("a manager shut down while on delivers no event to a module", async () => {
		const manager = new PermissionManager({
			config: { permissions: { mode: "on", policy: "allow", rules: [] } },
			handlers: {},
			debug: vi.fn(),
			SlothletError
		});
		await manager.shutdown();
		expect(manager.resolveEventLevel("a.x", "e")).toBe("deny");
		expect(manager.resolveEventLevel(null, "e")).toBe("allow");
	});
});

describe("PermissionManager > checks with no context manager", () => {
	it("a capability opened by a rule, and one a caller with no api path asks for", () => {
		const manager = makeManager([{ caller: "ext.**", target: "capability:code", effect: "allow" }]);
		expect(() => manager.assertCapability(writer("mod_ext", "ext.render"), "code", "new Function")).not.toThrow();
		expect(() => manager.assertCapability({ ____slothletInternal: { moduleID: "m" } }, "code", "new Function")).toThrow(
			expect.objectContaining({ code: "PERMISSION_CAPABILITY_REFUSED" })
		);
		expect(() => manager.assertCapabilityForPaths(["ext.a", "other.b"], "code", "new Function")).toThrow(
			expect.objectContaining({ code: "PERMISSION_CAPABILITY_REFUSED" })
		);
		const report = manager.capabilityReport();
		expect(report.find((entry) => entry.name === "code").allowed).toEqual(["ext.**"]);
	});

	it("capabilities opened for several callers are listed most specific first", () => {
		const manager = makeManager([
			{ caller: "ext.**", target: "capability:code", effect: "allow" },
			{ caller: "ext.render", target: "capability:code", effect: "allow" }
		]);
		expect(manager.capabilityReport().find((entry) => entry.name === "code").allowed).toEqual(["ext.render", "ext.**"]);
		const globs = makeManager([
			{ caller: "ext.**", target: "capability:code", effect: "allow" },
			{ caller: "ext.zz.**", target: "capability:code", effect: "allow" }
		]);
		expect(globs.capabilityReport().find((entry) => entry.name === "code").allowed).toEqual(["ext.zz.**", "ext.**"]);
	});

	it("a capability or global metadata allow whose condition does not match opens nothing", () => {
		const manager = makeManager([
			{ caller: "ext.**", target: "capability:code", effect: "allow", condition: { user: "admin" } },
			{ caller: "ext.**", target: "slothlet.metadata.global", effect: "allow", condition: { user: "admin" } }
		]);
		expect(() => manager.assertCapability(writer("mod_ext", "ext.render"), "code", "new Function")).toThrow(
			expect.objectContaining({ code: "PERMISSION_CAPABILITY_REFUSED" })
		);
		expect(() => manager.assertGlobalMetadataWrite(writer("mod_ext", "ext.render"))).toThrow(
			expect.objectContaining({ code: "PERMISSION_DENIED" })
		);
	});

	it("global metadata written by a module with no api path is refused by the built-in deny", () => {
		const manager = makeManager();
		expect(() => manager.assertGlobalMetadataWrite({ ____slothletInternal: { moduleID: "m" } })).toThrow(
			expect.objectContaining({ code: "PERMISSION_DENIED" })
		);
	});
});

describe("PermissionManager > argument checks", () => {
	it("an access operation that is not a string is named by its type", () => {
		const manager = makeManager();
		expect(() => manager.checkAccess("a", "b", null, null, null, { operation: 5 })).toThrow(
			expect.objectContaining({ code: "INVALID_ARGUMENT", details: expect.objectContaining({ received: "number" }) })
		);
		expect(() => manager.checkAccess("a", "b", null, null, null, { operation: "write" })).toThrow(
			expect.objectContaining({ details: expect.objectContaining({ received: "write" }) })
		);
	});

	it("a principal definition that is not an object is refused, named as null or by its type", () => {
		const manager = makeManager();
		expect(() => manager.registerPrincipal("roles", null)).toThrow(
			expect.objectContaining({ code: "INVALID_ARGUMENT", details: expect.objectContaining({ received: "null" }) })
		);
		expect(() => manager.registerPrincipal("roles", 5)).toThrow(
			expect.objectContaining({ code: "INVALID_ARGUMENT", details: expect.objectContaining({ received: "number" }) })
		);
	});

	it("default routine rules given no list add nothing", () => {
		const manager = makeManager();
		const before = manager.exportRules().length;
		manager.applyDefaultRoutineRules(null);
		expect(manager.exportRules().length).toBe(before);
	});

	it("a module's removal takes its requires rules with it", async () => {
		const manager = makeManager([], { policy: "deny" });
		manager.registerPrincipal("roles", { key: (ctx) => ctx.user, resolve: async () => ({}) });
		manager.addRule({ caller: "a.**", target: "b.x", effect: "allow", requires: ["roles"] }, "mod_a");
		const ctx = { user: "u" };
		await manager.resolvePrincipals(manager.stalePrincipals("a.y", "b.x", null, null, ctx));
		expect(manager.checkAccess("a.y", "b.x", null, null, ctx)).toBe(true);
		manager.onModuleRemoved("mod_a");
		expect(manager.checkAccess("a.y", "b.x", null, null, ctx)).toBe(false);
		expect(manager.getRulesByModule("mod_a")).toEqual([]);
	});

	it("under strict, a baseline that is not met refuses to start, naming the checks", async () => {
		const manager = makeManager([], { mode: "strict" });
		await expect(manager.checkBaseline("browser")).rejects.toMatchObject({ code: "PERMISSION_BASELINE_UNMET" });
	});

	it("a module removing a principal the host registered is refused, naming the host", () => {
		const manager = makeManager();
		manager.registerPrincipal("roles", { key: () => "k", resolve: async () => ({}) });
		expect(() => manager.unregisterPrincipal("roles", "mod_x")).toThrow(
			expect.objectContaining({ code: "PERMISSION_PRINCIPAL_NOT_OWNER", details: expect.objectContaining({ owner: "host" }) })
		);
	});

	it("a condition holding an accessor is refused; one holding a shared or cyclic part is copied once", () => {
		const manager = makeManager();
		const withGetter = { user: {} };
		Object.defineProperty(withGetter.user, "id", { get: () => "x", enumerable: true });
		expect(() => manager.addRule({ caller: "a.**", target: "b.**", effect: "allow", condition: withGetter })).toThrow(
			expect.objectContaining({ code: "PERMISSION_RULE_INVALID" })
		);
		const hidden = { user: {} };
		Object.defineProperty(hidden.user, "id", { get: () => "x", enumerable: false });
		expect(() => manager.addRule({ caller: "a.**", target: "b.**", effect: "allow", condition: hidden })).not.toThrow();
		const shared = { id: "u" };
		expect(() =>
			manager.addRule({ caller: "c.**", target: "d.**", effect: "allow", condition: { user: shared, owner: shared } })
		).not.toThrow();
		expect(manager.checkAccess("c.x", "d.y", null, null, { user: { id: "u" }, owner: { id: "u" } })).toBe(true);
		expect(manager.checkAccess("c.x", "d.y", null, null, { user: { id: "u" }, owner: { id: "v" } })).toBe(false);
	});

	it("a requires rule checked with no runtime context finds no identity", () => {
		const manager = makeManager([{ caller: "a.**", target: "b.x", effect: "allow", requires: ["roles"] }]);
		manager.registerPrincipal("roles", { key: (ctx) => ctx.user, resolve: async () => ({}) });
		expect(manager.checkAccess("a.y", "b.x")).toBe(false);
		expect(manager.stalePrincipals("a.y", "b.x", null, null, null)).toEqual([]);
	});

	it("a principal resolved before it was registered again is stale", async () => {
		const manager = makeManager([{ caller: "a.**", target: "b.x", effect: "allow", requires: ["roles"] }]);
		manager.registerPrincipal("roles", { key: (ctx) => ctx.user, resolve: async () => ({}) });
		const ctx = { user: "u" };
		await manager.resolvePrincipals(manager.stalePrincipals("a.y", "b.x", null, null, ctx));
		expect(manager.checkAccess("a.y", "b.x", null, null, ctx)).toBe(true);
		manager.invalidatePrincipal("roles");
		expect(manager.checkAccess("a.y", "b.x", null, null, ctx)).toBe(false);
	});

	it("a principal registered again holds no answer of the one it replaced", async () => {
		const manager = makeManager([{ caller: "a.**", target: "b.x", effect: "allow", requires: ["roles"] }]);
		const ctx = { user: "u" };
		manager.registerPrincipal("roles", { key: (c) => c.user, resolve: async () => ({ v: 1 }) });
		await manager.resolvePrincipals(manager.stalePrincipals("a.y", "b.x", null, null, ctx));
		expect(manager.checkAccess("a.y", "b.x", null, null, ctx)).toBe(true);
		manager.registerPrincipal("roles", { key: (c) => c.user, resolve: async () => ({ v: 2 }) });
		expect(manager.checkAccess("a.y", "b.x", null, null, ctx)).toBe(false);
	});
});

describe("PermissionManager > patterns", () => {
	it("a negated write deny is taken to reach every subtree; a negated write allow covers none", () => {
		const deny = makeManager([{ caller: "r.**", target: "!other.**:write", effect: "deny" }], { policy: "allow" });
		expect(deny.writeSubtree("r.x", "owner.Foo")).toBe("deny");
		const allow = makeManager([{ caller: "r.**", target: "!other.**:write", effect: "allow" }]);
		expect(allow.writeSubtree("r.x", "owner.Foo")).toBe(null);
	});

	it("a deny with repeated globstars reaches the subtree it can match beneath, and only that", () => {
		const manager = makeManager([{ caller: "r.**", target: "a.**.**.z.**.q:write", effect: "deny" }], { policy: "allow" });
		expect(manager.writeSubtree("r.x", "a.b.c")).toBe("deny");
		expect(manager.writeSubtree("r.x", "b.c")).toBe(null);
		const read = makeManager([{ caller: "r.**", target: "a.**.**.z.**.q", effect: "deny" }], { policy: "allow" });
		expect(read.readMayRefuseBeneath("r.x", "a.b.c")).toBe(true);
		expect(read.readMayRefuseBeneath("r.x", "b.c")).toBe(false);
	});

	it("an allow that matches the probe path stands for it; a more specific one beneath is found past it", () => {
		const broad = makeManager([{ caller: "r.**", target: "o.cfg.**", effect: "allow" }]);
		expect(broad.allowsBeneath("r", "o.cfg.nested", "o.cfg.nested.__probe__")).toBe(false);
		const manager = makeManager([
			{ caller: "r.**", target: "o.cfg.**", effect: "allow" },
			{ caller: "r.**", target: "o.cfg.nested.pub", effect: "allow" }
		]);
		expect(manager.allowsBeneath("r", "o.cfg.nested", "o.cfg.nested.__probe__")).toBe(true);
		expect(manager.allowsBeneath(null, "o.cfg.nested", "o.cfg.nested.__probe__")).toBe(false);
	});

	it("a module placing a rule whose target names no path before a hook suffix is left to the rule validation", () => {
		const manager = makeManager([], {}, { apiManager: { ownsPath: () => false } });
		expect(() => manager.placeModuleRule({ target: ":before" }, writer("mod_a", "a"))).toThrow(
			expect.objectContaining({ code: "PERMISSION_RULE_INVALID" })
		);
		expect(() => manager.placeModuleRule({ target: "b.x" }, { ____slothletInternal: { moduleID: "m" } })).toThrow(
			expect.objectContaining({ code: "PERMISSION_RULE_INVALID" })
		);
	});
});

describe("PermissionManager > module privacy by ownership", () => {
	it("a private member a module creates is its own only on a node its module owns", () => {
		const ownership = ownershipOf({ "a.x": "mod_a", a: "mod_a", b: "mod_b" });
		const manager = makeManager([], {}, { ownership });
		const create = (caller, target) => manager.enforceAccess(caller, target, "/m/a.mjs", null, null, null, { newMember: true });
		expect(create("a.x", "a._p")).toBe(true);
		expect(create("a.x", "b._p")).toBe(false);
		expect(create("nobody.x", "a._p")).toBe(false);
		expect(create("a.x", "c._p")).toBe(false);
		expect(manager.mayReachPrivate("a.x", "a", "/m/a.mjs", "/m/b.mjs")).toBe(true);
		expect(manager.mayReachPrivate("a.x", "slothlet.x", null, null)).toBe(true);
		expect(manager.mayReachPrivate(null, "b", null, null)).toBe(true);
	});

	it("reading a private member needs the caller's path to have an owner, and the member's", () => {
		const ownership = ownershipOf({ "a.x": "mod_a", "a._p": "mod_a" });
		const manager = makeManager([], {}, { ownership });
		const read = (caller, target) => manager.enforceAccess(caller, target, "/m/c.mjs", "/m/t.mjs");
		expect(read("a.x", "a._p")).toBe(true);
		expect(read("free.x", "a._p")).toBe(false);
		expect(read("a.x", "a._q")).toBe(false);
	});

	it("with no ownership registry, nothing is a module's own", () => {
		const manager = makeManager([], { owner: true });
		expect(manager.enforceAccess("a.x", "a._p", "/m/c.mjs", "/m/t.mjs")).toBe(false);
		expect(manager.enforceAccess("a.x", "a.y", "/m/c.mjs", "/m/t.mjs")).toBe(false);
	});

	it("a module creates no member in the framework's reserved roots by the owner grant", () => {
		const ownership = ownershipOf({ "a.x": "mod_a" });
		const manager = makeManager([], { owner: true }, { ownership });
		expect(manager.enforceAccess("a.x", "a.fresh", "/m/a.mjs", null, null, null, { newMember: true })).toBe(true);
		expect(manager.enforceAccess("a.x", "shutdown.fresh", "/m/a.mjs", null, null, null, { newMember: true })).toBe(false);
	});

	it("a target path that is not given is no control target", () => {
		const manager = makeManager([], { mode: "off" });
		expect(manager.checkAccess("a.x", undefined)).toBe(true);
	});

	it("a read of a data member with no exact deny above it is decided by the rules alone", () => {
		const manager = makeManager([{ caller: "r.**", target: "o.**", effect: "allow" }]);
		expect(manager.enforceAccess("r.x", "o.data.v", null, null, null, null, { operation: "read", dataMember: () => true })).toBe(true);
	});
});
