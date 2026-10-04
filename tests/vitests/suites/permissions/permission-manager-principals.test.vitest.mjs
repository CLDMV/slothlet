/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permission-manager-principals.test.vitest.mjs
 *	@Date: 2026-09-26 22:18:59 -07:00 (1790486339)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:04:28 -07:00 (1791083068)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #459 — PermissionManager principal registry, driven directly. Covers the edges the
 * end-to-end suite cannot reach deterministically: key functions that throw or return thenables,
 * hostile thenables from conditions, the enforcement pre-rule short-circuits of the stale scan,
 * owner-id normalization, dormant reservations, cache pruning, and in-flight sharing.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { PermissionManager } from "#handlers/permission-manager";
import { MODULE_ID_SEPARATOR } from "#handlers/metadata";
import { SlothletError } from "@cldmv/slothlet/errors";

const CALLER = "client.app.files";
const TARGET = "project.files.list";

/**
 * Build a standalone manager with the given rules.
 * @param {object[]} rules - Config rules.
 * @param {object} [extra] - Extra permission config.
 * @returns {{ manager: PermissionManager, debug: import("vitest").Mock }} The manager and its debug spy.
 */
const makeManager = (rules = [], extra = {}) => {
	const debug = vi.fn();
	const manager = new PermissionManager({
		config: { permissions: { enabled: true, defaultPolicy: "deny", rules, ...extra } },
		handlers: {},
		debug,
		SlothletError
	});
	return { manager, debug };
};

/** A rule that allows the call whenever the "roles" principal is current. */
const REQUIRES_ROLES = { caller: "client.**", target: TARGET, effect: "allow", requires: ["roles"] };

describe("PermissionManager > principals (#459)", () => {
	let manager = null;

	afterEach(async () => {
		if (manager) await manager.shutdown();
		manager = null;
	});

	it("resolves, caches, and serves a principal to a requires rule", async () => {
		({ manager } = makeManager([REQUIRES_ROLES]));
		const resolve = vi.fn(async (user) => ({ user }));
		manager.registerPrincipal("roles", { key: (ctx) => ctx.user, resolve });
		const ctx = { user: "u1" };

		expect(manager.checkAccess(CALLER, TARGET, null, null, ctx)).toBe(false);
		const stale = manager.stalePrincipals(CALLER, TARGET, null, null, ctx);
		expect(stale).toEqual([{ name: "roles", identityKey: "u1" }]);
		await manager.resolvePrincipals(stale);
		expect(manager.checkAccess(CALLER, TARGET, null, null, ctx)).toBe(true);
		expect(manager.stalePrincipals(CALLER, TARGET, null, null, ctx)).toEqual([]);
		expect(resolve).toHaveBeenCalledTimes(1);
	});

	it("concurrent resolves of one identity share a single resolver call", async () => {
		({ manager } = makeManager([REQUIRES_ROLES]));
		const resolve = vi.fn(async () => ({}));
		manager.registerPrincipal("roles", { key: (ctx) => ctx.user, resolve });
		const pairs = [{ name: "roles", identityKey: "u1" }];
		await Promise.all([manager.resolvePrincipals(pairs), manager.resolvePrincipals(pairs)]);
		expect(resolve).toHaveBeenCalledTimes(1);
	});

	it("the stale scan deduplicates identities across rules and skips absent principals", () => {
		({ manager } = makeManager([
			REQUIRES_ROLES,
			{ caller: "client.app.*", target: TARGET, effect: "allow", requires: ["roles", "missing"] }
		]));
		manager.registerPrincipal("roles", { key: (ctx) => ctx.user, resolve: () => ({}) });
		expect(manager.stalePrincipals(CALLER, TARGET, null, null, { user: "u1" })).toEqual([{ name: "roles", identityKey: "u1" }]);
	});

	it("the stale scan short-circuits where enforcement never reaches a rule", () => {
		({ manager } = makeManager([REQUIRES_ROLES, { caller: "**", target: "mod._secret", effect: "allow", requires: ["roles"] }]));
		// No principals registered at all.
		expect(manager.stalePrincipals(CALLER, TARGET, null, null, { user: "u1" })).toEqual([]);
		manager.registerPrincipal("roles", { key: (ctx) => ctx.user, resolve: () => ({}) });
		// Same-file self-call bypass.
		expect(manager.stalePrincipals(CALLER, TARGET, "/a.mjs", "/a.mjs", { user: "u1" })).toEqual([]);
		// Module-private target: decided before rules.
		expect(manager.stalePrincipals(CALLER, "mod._secret", null, null, { user: "u1" })).toEqual([]);
		// No identity for this context.
		expect(manager.stalePrincipals(CALLER, TARGET, null, null, null)).toEqual([]);
		// Disabled enforcement.
		manager.disable();
		expect(manager.stalePrincipals(CALLER, TARGET, null, null, { user: "u1" })).toEqual([]);
	});

	it("a key function that throws or returns a thenable means no identity", () => {
		({ manager } = makeManager([REQUIRES_ROLES]));
		manager.registerPrincipal("roles", {
			key: () => {
				throw new Error("bad key");
			},
			resolve: () => ({})
		});
		expect(manager.stalePrincipals(CALLER, TARGET, null, null, {})).toEqual([]);

		const rejecting = Promise.reject(new Error("async key"));
		manager.registerPrincipal("roles", { key: () => rejecting, resolve: () => ({}) });
		expect(manager.stalePrincipals(CALLER, TARGET, null, null, {})).toEqual([]);

		const hostile = {
			then() {
				throw new Error("hostile then");
			}
		};
		manager.registerPrincipal("roles", { key: () => hostile, resolve: () => ({}) });
		expect(manager.checkAccess(CALLER, TARGET, null, null, {})).toBe(false);
	});

	it("a condition returning a thenable is a non-match, including one whose `then` throws", () => {
		const hostile = {
			then() {
				throw new Error("hostile then");
			}
		};
		let debug;
		({ manager, debug } = makeManager([{ caller: "**", target: TARGET, effect: "allow", condition: () => hostile }]));
		expect(manager.checkAccess(CALLER, TARGET)).toBe(false);
		expect(debug).toHaveBeenCalledWith("permissions", expect.objectContaining({ key: "DEBUG_PERMISSION_CONDITION_THENABLE" }));
	});

	it("reports why a required principal is unavailable", () => {
		let debug;
		({ manager, debug } = makeManager([REQUIRES_ROLES]));
		manager.enforceAccess(CALLER, TARGET, null, null, { user: "u1" });
		expect(debug).toHaveBeenCalledWith(
			"permissions",
			expect.objectContaining({ key: "DEBUG_PERMISSION_PRINCIPAL_UNAVAILABLE", reason: "unregistered" })
		);
		manager.registerPrincipal("roles", { key: (ctx) => ctx.user, resolve: () => ({}) });
		manager.enforceAccess(CALLER, TARGET, null, null, {});
		expect(debug).toHaveBeenCalledWith("permissions", expect.objectContaining({ reason: "no-identity" }));
		manager.enforceAccess(CALLER, TARGET, null, null, { user: "u1" });
		expect(debug).toHaveBeenCalledWith("permissions", expect.objectContaining({ reason: "stale" }));
	});

	it("a resolver that throws is reported and leaves the pair unresolved", async () => {
		let debug;
		({ manager, debug } = makeManager([REQUIRES_ROLES]));
		manager.registerPrincipal("roles", {
			key: (ctx) => ctx.user,
			resolve: () => {
				throw "not an Error";
			}
		});
		await manager.resolvePrincipals([{ name: "roles", identityKey: "u1" }]);
		expect(debug).toHaveBeenCalledWith(
			"permissions",
			expect.objectContaining({ key: "DEBUG_PERMISSION_PRINCIPAL_RESOLVE_FAILED", error: "not an Error" })
		);
		expect(manager.checkAccess(CALLER, TARGET, null, null, { user: "u1" })).toBe(false);
	});

	it("resolving an unknown principal is a no-op", async () => {
		({ manager } = makeManager());
		await expect(manager.resolvePrincipals([{ name: "ghost", identityKey: "u1" }])).resolves.toBeUndefined();
	});

	it("a per-identity invalidation with nothing in flight just drops the cached value", async () => {
		({ manager } = makeManager([REQUIRES_ROLES]));
		manager.registerPrincipal("roles", { key: (ctx) => ctx.user, resolve: () => ({}) });
		await manager.resolvePrincipals([{ name: "roles", identityKey: "u1" }]);
		expect(manager.invalidatePrincipal("roles", "u1")).toBe(true);
		expect(manager.checkAccess(CALLER, TARGET, null, null, { user: "u1" })).toBe(false);
	});

	it("a re-registration mid-resolve discards the old resolver's answer", async () => {
		({ manager } = makeManager([REQUIRES_ROLES]));
		let release;
		const gate = new Promise((resolve) => (release = resolve));
		manager.registerPrincipal("roles", { key: (ctx) => ctx.user, resolve: () => gate });
		const pending = manager.resolvePrincipals([{ name: "roles", identityKey: "u1" }]);
		manager.registerPrincipal("roles", { key: (ctx) => ctx.user, resolve: () => ({}) });
		release({});
		await pending;
		expect(manager.checkAccess(CALLER, TARGET, null, null, { user: "u1" })).toBe(false);
	});

	it("maxAge expiry makes a value stale; grace accepts it only for the promoted re-check", async () => {
		vi.useFakeTimers();
		try {
			({ manager } = makeManager([REQUIRES_ROLES]));
			manager.registerPrincipal("roles", { key: (ctx) => ctx.user, resolve: () => ({}), maxAge: 1000 });
			await manager.resolvePrincipals([{ name: "roles", identityKey: "u1" }]);
			expect(manager.enforceAccess(CALLER, TARGET, null, null, { user: "u1" })).toBe(true);
			vi.advanceTimersByTime(1001);
			expect(manager.enforceAccess(CALLER, TARGET, null, null, { user: "u1" })).toBe(false);
			expect(manager.enforceAccess(CALLER, TARGET, null, null, { user: "u1" }, null, { principalGrace: true })).toBe(true);
			// Grace ends with the enforcement that asked for it.
			expect(manager.enforceAccess(CALLER, TARGET, null, null, { user: "u1" })).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it("expired identities are pruned once a maxAge principal's cache grows past the threshold", async () => {
		vi.useFakeTimers();
		try {
			({ manager } = makeManager([REQUIRES_ROLES]));
			manager.registerPrincipal("roles", { key: (ctx) => ctx.user, resolve: () => ({}), maxAge: 10 });
			await manager.resolvePrincipals(Array.from({ length: 1025 }, (_, i) => ({ name: "roles", identityKey: `u${i}` })));
			vi.advanceTimersByTime(20);
			await manager.resolvePrincipals([{ name: "roles", identityKey: "fresh" }]);
			// The old identities were swept, so they are stale; the fresh one survives the sweep.
			expect(manager.stalePrincipals(CALLER, TARGET, null, null, { user: "u0" })).toHaveLength(1);
			expect(manager.checkAccess(CALLER, TARGET, null, null, { user: "fresh" })).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});

	it("principal views are read-only at every depth, keep identity, and pass frozen values through", async () => {
		let seen = null;
		({ manager } = makeManager([
			{
				...REQUIRES_ROLES,
				condition: (ctx, meta) => {
					seen = meta.principals;
					return true;
				}
			}
		]));
		const frozenInner = Object.freeze({ deep: { x: 1 } });
		manager.registerPrincipal("roles", {
			key: (ctx) => ctx.user,
			resolve: () => ({ list: [1, 2], nested: { a: 1 }, bare: Object.create(null), frozen: frozenInner, when: new Date(0) })
		});
		await manager.resolvePrincipals([{ name: "roles", identityKey: "u1" }]);
		manager.checkAccess(CALLER, TARGET, null, null, { user: "u1" });

		const roles = seen.roles;
		expect(roles.nested).toBe(roles.nested);
		expect(() => Object.setPrototypeOf(roles, null)).toThrow(/PRINCIPAL_READ_ONLY/);
		expect(() => Object.defineProperty(roles.nested, "b", { value: 2 })).toThrow(/PRINCIPAL_READ_ONLY/);
		expect(() => {
			roles.bare.x = 1;
		}).toThrow(/PRINCIPAL_READ_ONLY/);
		expect(() => {
			roles.list[0] = 9;
		}).toThrow(/PRINCIPAL_READ_ONLY/);
		// Non-plain values are handed back as-is.
		expect(roles.when).toBeInstanceOf(Date);
		// A frozen (non-configurable, non-writable) property must read back as its exact value.
		const frozenHolder = Object.freeze({ inner: { y: 1 } });
		manager.registerPrincipal("roles", { key: (ctx) => ctx.user, resolve: () => frozenHolder });
		await manager.resolvePrincipals([{ name: "roles", identityKey: "u1" }]);
		manager.checkAccess(CALLER, TARGET, null, null, { user: "u1" });
		expect(seen.roles.inner).toBe(frozenHolder.inner);
	});

	it("ownership compares base module ids, so a leaf's composite id matches its module", () => {
		({ manager } = makeManager());
		manager.registerPrincipal("roles", { key: () => 1, resolve: () => ({}) }, "roles-mod");
		const composite = `roles-mod${MODULE_ID_SEPARATOR}roles.registry.setup`;
		expect(() => manager.registerPrincipal("roles", { key: () => 1, resolve: () => ({}) }, composite)).not.toThrow();
		expect(manager.invalidatePrincipal("roles", undefined, composite)).toBe(true);
		expect(() => manager.invalidatePrincipal("roles", undefined, "other-mod")).toThrow(/PRINCIPAL_NOT_OWNER/);
		expect(manager.unregisterPrincipal("ghost", "other-mod")).toBe(false);
		expect(manager.invalidatePrincipal("ghost")).toBe(false);
	});

	it("a host-owned principal is untouched by module removal and reload; a module's is removed / made dormant", () => {
		({ manager } = makeManager([{ ...REQUIRES_ROLES, requires: ["owned"] }]));
		manager.registerPrincipal("hosted", { key: () => 1, resolve: () => ({}) });
		manager.registerPrincipal("owned", { key: () => 1, resolve: () => ({}) }, "mod-a");
		manager.registerPrincipal("kept", { key: () => 1, resolve: () => ({}) }, "mod-b");

		manager.onModuleReloaded("mod-a");
		expect(manager.hasPrincipal("owned")).toBe(true);
		expect(manager.stalePrincipals(CALLER, TARGET, null, null, {})).toEqual([]);
		// Dormant principals are skipped by the resolver too.
		return manager.resolvePrincipals([{ name: "owned", identityKey: 1 }]).then(() => {
			manager.onModuleRemoved("mod-a");
			expect(manager.hasPrincipal("owned")).toBe(false);
			expect(manager.hasPrincipal("hosted")).toBe(true);
			expect(manager.hasPrincipal("kept")).toBe(true);
		});
	});

	it("reservePrincipal holds a name dormant for its owner and never overwrites a live registration", () => {
		let debug;
		({ manager, debug } = makeManager([REQUIRES_ROLES]));
		manager.reservePrincipal("roles", "roles-mod");
		expect(() => manager.registerPrincipal("roles", { key: () => 1, resolve: () => ({}) }, "other-mod")).toThrow(/PRINCIPAL_NAME_OWNED/);
		manager.enforceAccess(CALLER, TARGET, null, null, { user: "u1" });
		expect(debug).toHaveBeenCalledWith("permissions", expect.objectContaining({ reason: "dormant" }));

		manager.registerPrincipal("live", { key: () => 1, resolve: () => ({}) });
		manager.reservePrincipal("live", "someone");
		expect(() => manager.registerPrincipal("live", { key: () => 1, resolve: () => ({}) }, "someone")).toThrow(/PRINCIPAL_NAME_OWNED/);
	});

	it("shutdown clears principals", async () => {
		({ manager } = makeManager());
		manager.registerPrincipal("roles", { key: () => 1, resolve: () => ({}) });
		await manager.shutdown();
		expect(manager.hasPrincipal("roles")).toBe(false);
		manager = null;
	});

	it("a rule with `requires` bypasses the decision cache and serializes its requirement", () => {
		({ manager } = makeManager([REQUIRES_ROLES]));
		expect(manager.checkAccess(CALLER, TARGET, null, null, {})).toBe(false);
		manager.registerPrincipal("roles", { key: () => "k", resolve: () => ({}) });
		// A cached "deny" would survive the registration; the requires rule must be re-evaluated.
		expect(manager.stalePrincipals(CALLER, TARGET, null, null, {})).toHaveLength(1);
		expect(manager.getRulesForPath(TARGET)[0].requires).toEqual(["roles"]);
		const id = manager.getRulesForPath(TARGET)[0].id;
		expect(manager.removeRule(id)).toBe(true);
		expect(manager.stalePrincipals(CALLER, TARGET, null, null, {})).toEqual([]);
	});
});
