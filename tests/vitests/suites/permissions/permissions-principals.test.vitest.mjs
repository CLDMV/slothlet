/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-principals.test.vitest.mjs
 *	@Date: 2026-09-26 22:18:59 -07:00 (1790486339)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-26 22:18:59 -07:00 (1790486339)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview #459 — named, module-owned principals. A principal is a resolver registered at
 * runtime that turns a caller identity into authorization facts; a rule declares the principals its
 * (synchronous) condition needs with `requires`, and receives them as `principals` alongside the
 * call's args/target. A call whose required principal is stale is promoted to resolve just that
 * principal first; everything else stays on the synchronous path.
 *
 * Fixture: `base/` holds the calling module (`client.app`) and the gated targets; `roles/` and
 * `billing/` are plugins added with their own moduleIDs so they own their principals.
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_PERMISSION_PRINCIPALS;

/**
 * Assert an inter-module invocation is denied, whether the gate throws synchronously or the promoted
 * call rejects — the async thunk normalizes both into a rejection.
 * @param {() => unknown} invoke - Zero-arg thunk that performs the guarded call.
 * @returns {Promise<void>}
 */
const expectDenied = (invoke) => expect((async () => invoke())()).rejects.toThrow(/PERMISSION_DENIED/);

/**
 * Assert a module call fails with `pattern`, whether it throws synchronously (eager) or rejects (lazy,
 * where the first call to an unmaterialized leaf returns a Promise).
 * @param {() => unknown} invoke - Zero-arg thunk that performs the call.
 * @param {RegExp} pattern - Expected error pattern.
 * @returns {Promise<void>}
 */
const expectFails = (invoke, pattern) => expect((async () => invoke())()).rejects.toThrow(pattern);

/**
 * The files rule: the caller may read a project when its roles grant "read" on it.
 * @type {object}
 */
const FILES_RULE = {
	caller: "client.**",
	target: "project.files.list",
	effect: "allow",
	requires: ["roles"],
	condition: (ctx, { args, principals }) => principals.roles.projects[args[0]]?.includes("read") === true
};

/**
 * Grants that let the two plugins manage principals and let the roles plugin write the ledger.
 * @type {object[]}
 */
const PLUGIN_GRANTS = [
	{ caller: "roles.**", target: "slothlet.permissions.principal.**", effect: "allow" },
	{ caller: "billing.**", target: "slothlet.permissions.principal.**", effect: "allow" },
	{ caller: "roles.**", target: "ledger.**", effect: "allow" }
];

describe.each(getMatrixConfigs())("Permissions > Principals (#459) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build an instance with the plugins added and their principals registered.
	 * @param {object[]} rules - Extra rules (the plugin grants are always included).
	 * @param {object} [options] - Build options.
	 * @param {object} [options.roles] - Options forwarded to the roles plugin's `setup()`; `false` skips it.
	 * @param {boolean} [options.billing=true] - Whether to register the billing principal.
	 * @param {object} [options.permissions] - Extra permission config.
	 * @returns {Promise<object>} Bound api.
	 */
	const build = async (rules, { roles = {}, billing = true, permissions = {} } = {}) => {
		const instance = await slothlet({
			...config,
			base: path.join(FIXTURE, "base"),
			permissions: { defaultPolicy: "deny", rules: [...PLUGIN_GRANTS, ...rules], ...permissions }
		});
		await instance.slothlet.api.add("roles", path.join(FIXTURE, "roles"), { moduleID: "roles-mod" });
		await instance.slothlet.api.add("billing", path.join(FIXTURE, "billing"), { moduleID: "billing-mod" });
		if (roles !== false) await instance.roles.registry.setup(roles);
		if (billing) await instance.billing.plans.setup();
		return instance;
	};

	/**
	 * Run `fn` inside a per-request context.
	 * @param {object} ctx - Context values.
	 * @param {() => unknown} fn - Work to run.
	 * @returns {unknown} The work's result.
	 */
	const as = (ctx, fn) => api.slothlet.context.run(ctx, fn);

	// ── Resolution + the sync fast path ─────────────────────────────────────────

	it("a required principal is resolved, handed to the condition, and gates the call on it", async () => {
		api = await build([FILES_RULE]);
		await api.roles.registry.grant("u1", "p1", ["read"]);

		expect(await as({ user: "u1" }, () => api.client.app.files("p1"))).toEqual({ projectId: "p1", files: ["readme.md"] });
		// Same identity, a project it has no grant on: the resolved facts deny it.
		await expectDenied(() => as({ user: "u1" }, () => api.client.app.files("p2")));
	});

	it("a current principal is not resolved again — later calls take the synchronous path", async () => {
		api = await build([FILES_RULE]);
		await api.roles.registry.grant("u1", "p1", ["read"]);

		await as({ user: "u1" }, () => api.client.app.files("p1"));
		await as({ user: "u1" }, () => api.client.app.files("p1"));
		await as({ user: "u1" }, () => api.client.app.files("p1"));
		expect(await api.roles.registry.resolves()).toBe(1);
	});

	it("each identity is resolved and cached separately", async () => {
		api = await build([FILES_RULE]);
		await api.roles.registry.grant("u1", "p1", ["read"]);

		await as({ user: "u1" }, () => api.client.app.files("p1"));
		await expectDenied(() => as({ user: "u2" }, () => api.client.app.files("p1")));
		expect(await api.roles.registry.resolves()).toBe(2);
	});

	it("a call with no identity (key returns undefined) does not match the rule", async () => {
		api = await build([FILES_RULE]);
		await api.roles.registry.grant("u1", "p1", ["read"]);

		await expectDenied(() => as({}, () => api.client.app.files("p1")));
		expect(await api.roles.registry.resolves()).toBe(0);
	});

	it("a rule requiring a principal that was never registered does not match (default deny)", async () => {
		api = await build([FILES_RULE], { roles: false });
		await expectDenied(() => as({ user: "u1" }, () => api.client.app.files("p1")));
	});

	it("principals are independent: only the ones a matching rule requires are resolved", async () => {
		const REPORT_RULE = {
			caller: "client.**",
			target: "reports.exporter.run",
			effect: "allow",
			requires: ["roles", "billing"],
			condition: (ctx, { args, principals }) => principals.billing.plan !== "free" && Boolean(principals.roles.projects[args[0]])
		};
		api = await build([FILES_RULE, REPORT_RULE]);
		await api.roles.registry.grant("u1", "p1", ["read"]);
		await api.billing.plans.assign("o1", "pro");

		await as({ user: "u1", org: "o1" }, () => api.client.app.files("p1"));
		expect(await api.billing.plans.resolves()).toBe(0);

		// roles(u1) is already current, so only billing(o1) is resolved for the report.
		expect(await as({ user: "u1", org: "o1" }, () => api.client.app.report("p1"))).toEqual({ exported: "p1" });
		expect(await api.roles.registry.resolves()).toBe(1);
		expect(await api.billing.plans.resolves()).toBe(1);
	});

	it("a rule with `requires` and no condition matches whenever its principals are current", async () => {
		api = await build([{ caller: "client.**", target: "project.files.list", effect: "allow", requires: ["roles"] }]);
		expect(await as({ user: "anyone" }, () => api.client.app.files("p9"))).toMatchObject({ projectId: "p9" });
		await expectDenied(() => as({}, () => api.client.app.files("p9")));
	});

	// ── Invalidation, maxAge, failures ──────────────────────────────────────────

	it("invalidating an identity makes the next call re-resolve — a revocation takes effect", async () => {
		api = await build([FILES_RULE]);
		await api.roles.registry.grant("u1", "p1", ["read"]);
		await as({ user: "u1" }, () => api.client.app.files("p1"));

		expect(await api.roles.registry.revoke("u1", "p1")).toBe(true);
		await expectDenied(() => as({ user: "u1" }, () => api.client.app.files("p1")));
		expect(await api.roles.registry.resolves()).toBe(2);
	});

	it("invalidating a whole principal re-resolves every identity; the host may do it too", async () => {
		api = await build([FILES_RULE]);
		await api.roles.registry.grant("u1", "p1", ["read"]);
		await as({ user: "u1" }, () => api.client.app.files("p1"));

		expect(api.slothlet.permissions.principal.invalidate("roles")).toBe(true);
		await as({ user: "u1" }, () => api.client.app.files("p1"));
		expect(await api.roles.registry.resolves()).toBe(2);
		expect(api.slothlet.permissions.principal.invalidate("nope")).toBe(false);
	});

	it("maxAge: 0 re-resolves on every call and each promoted call still succeeds", async () => {
		api = await build([FILES_RULE], { roles: { maxAge: 0 } });
		await api.roles.registry.grant("u1", "p1", ["read"]);
		// Let the clock move so a same-millisecond hit cannot read as fresh.
		for (let i = 0; i < 3; i++) {
			await new Promise((resolve) => setTimeout(resolve, 2));
			expect(await as({ user: "u1" }, () => api.client.app.files("p1"))).toMatchObject({ projectId: "p1" });
		}
		// At least once per call. A call can pass two gates (the captured reference the caller read, then the
		// leaf's own), and with maxAge: 0 each gate that finds the value expired resolves it again.
		expect(await api.roles.registry.resolves()).toBeGreaterThanOrEqual(3);
	});

	// ── Promotion shapes ────────────────────────────────────────────────────────

	it("a captured reference invoked later is resolved and gated the same way", async () => {
		api = await build([FILES_RULE]);
		await api.roles.registry.grant("u1", "p1", ["read"]);
		expect(await as({ user: "u1" }, () => api.client.app.captured("p1"))).toMatchObject({ projectId: "p1" });
		await expectDenied(() => as({ user: "u1" }, () => api.client.app.captured("p2")));
	});

	it("construct cannot wait: a stale required principal fails closed, a current one is honoured", async () => {
		api = await build([
			FILES_RULE,
			{ caller: "client.**", target: "widgets.Gadget", effect: "allow", requires: ["roles"], condition: () => true }
		]);
		await api.roles.registry.grant("u1", "p1", ["read"]);

		// Nothing resolved for u1 yet → construct cannot promote → the rule does not match.
		await expectDenied(() => as({ user: "u1" }, () => api.client.app.build("g")));
		// A call warms roles(u1); construct then finds it current.
		await as({ user: "u1" }, () => api.client.app.files("p1"));
		expect((await as({ user: "u1" }, () => api.client.app.build("g"))).label).toBe("g");
	});

	it("a module's resolver runs as that module, not as the caller that triggered it", async () => {
		// Only roles.** may call ledger.*; the resolver records to it. Attributed to client.app it would be
		// denied, the resolve would fail, and the files call would be denied with it.
		api = await build([FILES_RULE], { roles: { record: true } });
		await api.roles.registry.grant("u1", "p1", ["read"]);
		expect(await as({ user: "u1" }, () => api.client.app.files("p1"))).toMatchObject({ projectId: "p1" });
		expect(await api.ledger.log.list()).toContain("roles:u1");
	});

	it("a resolver that throws leaves the principal unresolved — the call is denied, not crashed", async () => {
		api = await build([FILES_RULE], { roles: false });
		api.slothlet.permissions.principal.register("roles", {
			key: (ctx) => ctx.user,
			resolve: () => {
				throw new Error("directory offline");
			}
		});
		await expectDenied(() => as({ user: "u1" }, () => api.client.app.files("p1")));
	});

	it("an invalidation that lands while a resolve is in flight discards that resolve (fail closed)", async () => {
		// The roles plugin invalidates u1 after taking its snapshot but before returning it — the snapshot
		// still grants p1, yet it predates the revocation and must never be cached as current.
		api = await build([FILES_RULE], { roles: { race: true } });
		await api.roles.registry.grant("u1", "p1", ["read"]);
		await expectDenied(() => as({ user: "u1" }, () => api.client.app.files("p1")));
	});

	// ── Read-only views ─────────────────────────────────────────────────────────

	it("conditions receive read-only views: writes throw PRINCIPAL_READ_ONLY", async () => {
		let seen = null;
		api = await build([
			{
				caller: "client.**",
				target: "project.files.list",
				effect: "allow",
				requires: ["roles"],
				condition: (ctx, { principals }) => {
					seen = principals;
					return true;
				}
			}
		]);
		await api.roles.registry.grant("u1", "p1", ["read"]);
		await as({ user: "u1" }, () => api.client.app.files("p1"));

		expect(Object.isFrozen(seen)).toBe(true);
		expect(seen.roles.projects.p1).toEqual(["read"]);
		expect(() => {
			seen.roles.projects.p1.push("admin");
		}).toThrow(/PRINCIPAL_READ_ONLY/);
		expect(() => {
			seen.roles.projects.p2 = ["read"];
		}).toThrow(/PRINCIPAL_READ_ONLY/);
		expect(() => {
			delete seen.roles.projects;
		}).toThrow(/PRINCIPAL_READ_ONLY/);
		// Repeated reads hand back the same view.
		expect(seen.roles.projects).toBe(seen.roles.projects);
	});

	// ── Registration, ownership, gating ─────────────────────────────────────────

	it("modules may not register principals unless the host grants it (built-in deny)", async () => {
		api = await build([]);
		await expectFails(() => api.client.app.claim("mine"), /PERMISSION_DENIED/);
	});

	it("the first registrant owns the name; other modules cannot claim, invalidate, or unregister it", async () => {
		api = await build([{ caller: "client.**", target: "slothlet.permissions.principal.**", effect: "allow" }]);
		await expectFails(() => api.client.app.claim("roles"), /PRINCIPAL_NAME_OWNED/);
		await expectFails(() => api.client.app.invalidate("roles"), /PRINCIPAL_NOT_OWNER/);
		await expectFails(() => api.client.app.unregister("roles"), /PRINCIPAL_NOT_OWNER/);
		// A module can register a fresh name, and re-register its own.
		await api.client.app.claim("fresh");
		await api.client.app.claim("fresh");
		expect(await api.client.app.unregister("fresh")).toBe(true);
	});

	it("the owner may re-register (swapping the resolver) and unregister; rules then stop matching", async () => {
		api = await build([FILES_RULE]);
		await api.roles.registry.grant("u1", "p1", ["read"]);
		await api.roles.registry.setup();
		expect(await as({ user: "u1" }, () => api.client.app.files("p1"))).toMatchObject({ projectId: "p1" });

		expect(await api.roles.registry.drop()).toBe(true);
		expect(await api.roles.registry.drop()).toBe(false);
		await expectDenied(() => as({ user: "u1" }, () => api.client.app.files("p1")));
	});

	it("the host may replace a module's principal; the module keeps ownership", async () => {
		api = await build([FILES_RULE, { caller: "client.**", target: "slothlet.permissions.principal.**", effect: "allow" }]);
		api.slothlet.permissions.principal.register("roles", { key: (ctx) => ctx.user, resolve: () => ({ projects: { p7: ["read"] } }) });
		expect(await as({ user: "u1" }, () => api.client.app.files("p7"))).toMatchObject({ projectId: "p7" });
		// Still owned by the roles plugin, not taken over by the host or open to other modules.
		await expectFails(() => api.client.app.claim("roles"), /PRINCIPAL_NAME_OWNED/);
		expect(await api.roles.registry.revoke("u1", "p7")).toBe(true);
	});

	it("rejects malformed registrations and malformed `requires`", async () => {
		api = await build([]);
		const register = api.slothlet.permissions.principal.register;
		expect(() => register("", { key: () => 1, resolve: () => 1 })).toThrow(/INVALID_ARGUMENT/);
		expect(() => register("x", null)).toThrow(/INVALID_ARGUMENT/);
		expect(() => register("x", { resolve: () => 1 })).toThrow(/INVALID_ARGUMENT/);
		expect(() => register("x", { key: () => 1 })).toThrow(/INVALID_ARGUMENT/);
		expect(() => register("x", { key: () => 1, resolve: () => 1, maxAge: -1 })).toThrow(/INVALID_ARGUMENT/);
		expect(() => register("x", { key: () => 1, resolve: () => 1, maxAge: "1s" })).toThrow(/INVALID_ARGUMENT/);

		const addRule = api.slothlet.permissions.addRule;
		expect(() => addRule({ caller: "**", target: "x", effect: "allow", requires: [] })).toThrow(/INVALID_PERMISSION_RULE/);
		expect(() => addRule({ caller: "**", target: "x", effect: "allow", requires: "roles" })).toThrow(/INVALID_PERMISSION_RULE/);
		expect(() => addRule({ caller: "**", target: "x", effect: "allow", requires: [""] })).toThrow(/INVALID_PERMISSION_RULE/);
	});

	it("rule introspection reports `requires`", async () => {
		api = await build([FILES_RULE]);
		const rules = api.slothlet.permissions.global.rulesForPath("project.files.list");
		expect(rules.find((rule) => rule.requires)?.requires).toEqual(["roles"]);
	});

	it("register/unregister honour api.mutations.permissions; invalidate stays available", async () => {
		api = await slothlet({
			...config,
			base: path.join(FIXTURE, "base"),
			api: { mutations: { permissions: false } },
			permissions: { defaultPolicy: "allow" }
		});
		expect(() => api.slothlet.permissions.principal.register("x", { key: () => 1, resolve: () => 1 })).toThrow(
			/INVALID_CONFIG_MUTATIONS_DISABLED/
		);
		expect(() => api.slothlet.permissions.principal.unregister("x")).toThrow(/INVALID_CONFIG_MUTATIONS_DISABLED/);
		expect(api.slothlet.permissions.principal.invalidate("x")).toBe(false);
	});

	it("seal() freezes registration but invalidation keeps working", async () => {
		api = await build([FILES_RULE]);
		api.slothlet.permissions.control.seal();
		expect(() => api.slothlet.permissions.principal.register("late", { key: () => 1, resolve: () => 1 })).toThrow(/PERMISSION_SEALED/);
		expect(() => api.slothlet.permissions.principal.unregister("roles")).toThrow(/PERMISSION_SEALED/);
		expect(api.slothlet.permissions.principal.invalidate("roles")).toBe(true);
	});

	// ── Lifecycle: removal, scoped reload, full reload ──────────────────────────

	it("removing the owning module removes its principals", async () => {
		api = await build([FILES_RULE]);
		await api.roles.registry.grant("u1", "p1", ["read"]);
		await as({ user: "u1" }, () => api.client.app.files("p1"));

		await api.slothlet.api.remove("roles-mod");
		await expectDenied(() => as({ user: "u1" }, () => api.client.app.files("p1")));
		// The name is free again.
		api.slothlet.permissions.principal.register("roles", { key: (ctx) => ctx.user, resolve: () => ({ projects: { p1: ["read"] } }) });
		expect(await as({ user: "u1" }, () => api.client.app.files("p1"))).toMatchObject({ projectId: "p1" });
	});

	it("reloading the owning module puts its principal to sleep until the module registers again", async () => {
		api = await build([FILES_RULE, { caller: "client.**", target: "slothlet.permissions.principal.**", effect: "allow" }], {
			roles: false
		});
		let resolves = 0;
		// A host-supplied resolver keeps the count observable across the plugin reload; the principal itself
		// is registered by the plugin, so the plugin owns it.
		const options = {
			resolve: () => {
				resolves++;
				return { projects: { p1: ["read"] } };
			}
		};
		await api.roles.registry.setup(options);
		await as({ user: "u1" }, () => api.client.app.files("p1"));
		expect(resolves).toBe(1);

		// The registered resolver belongs to the pre-reload module, so it stops answering.
		await api.slothlet.api.reload("roles-mod");
		await expectDenied(() => as({ user: "u1" }, () => api.client.app.files("p1")));
		expect(resolves).toBe(1);
		// The name stays with its owner while dormant.
		await expectFails(() => api.client.app.claim("roles"), /PRINCIPAL_NAME_OWNED/);

		// The reloaded module registers again and the rule matches with a fresh resolve.
		await api.roles.registry.setup(options);
		expect(await as({ user: "u1" }, () => api.client.app.files("p1"))).toMatchObject({ projectId: "p1" });
		expect(resolves).toBe(2);
	});

	it("a full reload replays host principals, reserves module principals, and replays unregistrations", async () => {
		api = await build([FILES_RULE], { billing: false });
		api.slothlet.permissions.principal.register("tenant", { key: (ctx) => ctx.org, resolve: (org) => ({ org }) });
		await api.billing.plans.setup();
		expect(await api.roles.registry.drop()).toBe(true);
		await api.roles.registry.setup();
		expect(api.slothlet.permissions.principal.unregister("billing")).toBe(true);
		await api.slothlet.permissions.addRule({ caller: "client.**", target: "slothlet.permissions.principal.**", effect: "allow" });
		await api.slothlet.permissions.addRule({ caller: "client.**", target: "reports.exporter.run", effect: "allow", requires: ["tenant"] });

		await api.slothlet.reload();

		// Host principal: replayed as registered.
		expect(await as({ org: "o1" }, () => api.client.app.report("p1"))).toEqual({ exported: "p1" });
		// Module principal: reserved for its owner, dormant until the reloaded module registers again.
		await api.roles.registry.grant("u1", "p1", ["read"]);
		await expectDenied(() => as({ user: "u1" }, () => api.client.app.files("p1")));
		await expectFails(() => api.client.app.claim("roles"), /PRINCIPAL_NAME_OWNED/);
		await api.roles.registry.setup();
		expect(await as({ user: "u1" }, () => api.client.app.files("p1"))).toMatchObject({ projectId: "p1" });
		// The billing unregistration replayed too, so the name is free.
		await api.client.app.claim("billing");
	});

	// ── Safety invariant: conditions are synchronous ────────────────────────────

	it("an async condition on an allow rule never fails open", async () => {
		api = await build([{ caller: "client.**", target: "project.files.list", effect: "allow", condition: async () => true }]);
		await expectDenied(() => api.client.app.files("p1"));
	});

	it("a rejecting async condition is denied without an unhandled rejection", async () => {
		api = await build([
			{
				caller: "client.**",
				target: "project.files.list",
				effect: "allow",
				condition: async () => {
					throw new Error("async boom");
				}
			}
		]);
		await expectDenied(() => api.client.app.files("p1"));
		// Give a would-be unhandled rejection a turn to surface (vitest fails the run on one).
		await new Promise((resolve) => setTimeout(resolve, 5));
	});
});
