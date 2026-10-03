/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-global-check-call.test.vitest.mjs
 *	@Date: 2026-09-28 12:00:00 -07:00 (1790622000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 12:00:00 -07:00 (1790622000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview `api.slothlet.permissions.global.checkCall(callerPath, targetPath, args)` (#508) — the
 * host-only call-gate query, the call-side twin of `event.resolveLevel`: would a SUPPLIED caller
 * identity be allowed to call a target with these arguments, judged exactly as the real call gate
 * judges it.
 *
 * @description
 * Exercises: parity with `checkAccess` for unconditional rules; function conditions receiving the
 * call's `{ args, target }` (which `checkAccess` never forwards); ambient `context.run()` context;
 * the stale-principal path (a Promise, resolved and re-evaluated with grace) versus the fresh path
 * (synchronous); a module-private target denied regardless of the host policy; the self-call bypass
 * never applying to a file-less caller; audit events emitted with `via: "checkCall"`; disabled
 * enforcement answering `true`; host-only gating (a module caller is refused, an exact instance
 * grant opens it); and argument validation — across the eager/lazy × async/live matrix. A second
 * describe drives the PermissionManager directly for the `moduleCaller` / `via` enforcement options.
 *
 * @module tests/vitests/suites/permissions/permissions-global-check-call.test.vitest
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import slothlet from "@cldmv/slothlet";
import { PermissionManager } from "#handlers/permission-manager";
import { SlothletError } from "@cldmv/slothlet/errors";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;
const PRIVATE = new URL("../../../../api_tests/api_test_private", import.meta.url).pathname;

/**
 * Let a lifecycle emit's listener notification settle before asserting on what it collected.
 * @returns {Promise<void>}
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe.each(getMatrixConfigs())("Permissions > global.checkCall (#508) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Compose the permissions fixture with the given permission config.
	 * @param {object} permissions - `config.permissions`.
	 * @param {string} [base=BASE] - Fixture directory.
	 * @returns {Promise<object>} Bound api.
	 */
	const build = async (permissions, base = BASE) => slothlet({ ...config, base, permissions });

	/**
	 * Collect the permission audit events an instance emits.
	 * @param {object} instance - Bound api.
	 * @returns {Array<{ event: string, payload: object }>} Live list of `{ event, payload }` records.
	 */
	const collectAudit = (instance) => {
		const seen = [];
		for (const event of ["permission:denied", "permission:allowed", "permission:default"]) {
			instance.slothlet.lifecycle.on(event, (payload) => seen.push({ event, payload }));
		}
		return seen;
	};

	// ── Parity with checkAccess ──────────────────────────────────────────────────

	it("agrees with checkAccess for rules without conditions, synchronously", async () => {
		api = await build({
			defaultPolicy: "allow",
			rules: [{ caller: "untrusted.**", target: "admin.**", effect: "deny" }]
		});
		const { checkCall, checkAccess } = api.slothlet.permissions.global;

		for (const [caller, target] of [
			["payments.charge", "db.read"],
			["untrusted.plugin", "admin.manage"],
			["untrusted.plugin", "db.read"]
		]) {
			const viaCall = checkCall(caller, target, []);
			expect(viaCall, `${caller} → ${target} answers synchronously`).toBeTypeOf("boolean");
			expect(viaCall, `${caller} → ${target} agrees with checkAccess`).toBe(checkAccess(caller, target));
		}
	});

	// ── callMeta: args + concrete target ─────────────────────────────────────────

	it("forwards { args, target } to function conditions — which checkAccess never sees", async () => {
		const seen = [];
		api = await build({
			defaultPolicy: "deny",
			rules: [
				{
					caller: "callers.**",
					target: "payments.charge.process",
					effect: "allow",
					condition: (ctx, meta) => {
						seen.push(meta);
						return meta?.args?.[0] >= 100;
					}
				}
			]
		});
		const { checkCall, checkAccess } = api.slothlet.permissions.global;

		expect(checkCall("callers.paymentsCaller", "payments.charge.process", [100])).toBe(true);
		expect(seen.at(-1)).toEqual({ args: [100], target: "payments.charge.process" });

		// Denied purely because the condition read the supplied args.
		expect(checkCall("callers.paymentsCaller", "payments.charge.process", [50])).toBe(false);
		expect(seen.at(-1)).toEqual({ args: [50], target: "payments.charge.process" });

		// Omitted args are an empty argument list, still a real callMeta.
		expect(checkCall("callers.paymentsCaller", "payments.charge.process")).toBe(false);
		expect(seen.at(-1)).toEqual({ args: [], target: "payments.charge.process" });

		// checkAccess is the silent query: its function conditions receive null callMeta (unchanged).
		expect(checkAccess("callers.paymentsCaller", "payments.charge.process")).toBe(false);
		expect(seen.at(-1)).toBeNull();
	});

	it("callMeta.target is the concrete target so one globbed rule can branch per target", async () => {
		api = await build({
			defaultPolicy: "deny",
			rules: [
				{
					caller: "callers.**",
					target: "payments.**",
					effect: "allow",
					condition: (ctx, meta) => meta?.target === "payments.charge.process"
				}
			]
		});
		const { checkCall } = api.slothlet.permissions.global;

		expect(checkCall("callers.paymentsCaller", "payments.charge.process", [1])).toBe(true);
		expect(checkCall("callers.paymentsCaller", "payments.webhook.handleWebhook", [{ type: "ping" }])).toBe(false);
	});

	// ── Ambient context ──────────────────────────────────────────────────────────

	it("evaluates conditions against the ambient context.run() context, combined with the args", async () => {
		api = await build({
			defaultPolicy: "deny",
			rules: [
				{
					caller: "callers.**",
					target: "payments.charge.process",
					effect: "allow",
					condition: (ctx, meta) => ctx.role === "admin" && meta?.args?.[0] === 100
				}
			]
		});
		const { checkCall } = api.slothlet.permissions.global;
		const ask = (amount) => checkCall("callers.paymentsCaller", "payments.charge.process", [amount]);

		expect(await api.slothlet.context.run({ role: "admin" }, () => ask(100)), "right role, right args").toBe(true);
		expect(await api.slothlet.context.run({ role: "admin" }, () => ask(999)), "right role, wrong args").toBe(false);
		expect(await api.slothlet.context.run({ role: "guest" }, () => ask(100)), "wrong role").toBe(false);
		expect(ask(100), "no ambient context").toBe(false);
	});

	// ── Principals: stale → Promise, fresh → sync ────────────────────────────────

	it("resolves a stale required principal first (a Promise) and answers synchronously once it is current", async () => {
		api = await build({
			defaultPolicy: "deny",
			rules: [
				{
					caller: "client.**",
					target: "project.files.list",
					effect: "allow",
					requires: ["roles"],
					condition: (ctx, { args, principals }) => principals.roles.projects[args[0]]?.includes("read") === true
				}
			]
		});
		const resolve = vi.fn(async (user) => ({ projects: user === "u1" ? { p1: ["read"] } : {} }));
		api.slothlet.permissions.principal.register("roles", { key: (ctx) => ctx.user, resolve });
		const { checkCall } = api.slothlet.permissions.global;
		const ask = (project) => checkCall("client.app", "project.files.list", [project]);

		// First query for this identity: the principal is stale, so the answer is deferred behind its resolve.
		let first;
		let second;
		let third;
		await api.slothlet.context.run({ user: "u1" }, async () => {
			first = ask("p1");
			expect(first).toBeInstanceOf(Promise);
			expect(await first).toBe(true);
			// Now current: the fast path answers synchronously, for both verdicts.
			second = ask("p1");
			third = ask("p2");
		});
		expect(second).toBe(true);
		expect(third).toBe(false);
		expect(resolve).toHaveBeenCalledTimes(1);

		// Another identity with no grant: still a Promise (its facts are stale), resolving — not rejecting — to false.
		let other;
		await api.slothlet.context.run({ user: "u2" }, async () => {
			other = ask("p1");
			expect(other).toBeInstanceOf(Promise);
			await expect(other).resolves.toBe(false);
		});
		expect(resolve).toHaveBeenCalledTimes(2);
	});

	// ── Module-private targets + no self-call bypass ─────────────────────────────

	it("denies a module-private target outright — even under private.host allow, where checkAccess judges as the host", async () => {
		api = await build({ defaultPolicy: "allow", rules: [], private: { host: "allow" } }, PRIVATE);
		const audit = collectAudit(api);
		const { checkCall, checkAccess } = api.slothlet.permissions.global;

		expect(checkCall("reporting.peek", "billing.internals._scale", [100])).toBe(false);
		expect(checkCall("reporting.peek", "billing.internals.__rate")).toBe(false);
		// The supplied caller is a module without a file: the host policy does not apply to it. The
		// silent query has no caller identity at all and IS judged as the host (existing behaviour).
		expect(checkAccess("reporting.peek", "billing.internals._scale")).toBe(true);

		await settle();
		expect(audit).toContainEqual({
			event: "permission:denied",
			payload: expect.objectContaining({ caller: "reporting.peek", target: "billing.internals._scale", via: "checkCall" })
		});
	});

	it("denies a module-private target under the default host policy too", async () => {
		api = await build({ defaultPolicy: "allow", rules: [] }, PRIVATE);
		expect(api.slothlet.permissions.global.checkCall("reporting.peek", "billing.internals._scale", [100])).toBe(false);
	});

	it("never applies the self-call bypass: the supplied caller has no source file", async () => {
		api = await build({ defaultPolicy: "deny", rules: [] });
		const { checkCall } = api.slothlet.permissions.global;

		// The real gate lets a same-file call through (callSelf → identity live in self-caller.mjs)...
		expect((await api.callers.selfCaller.callSelf()).ok).toBe(true);
		// ...but the query cannot know the caller's file, so under a deny default the answer is no.
		expect(checkCall("callers.selfCaller.callSelf", "callers.selfCaller.identity", [])).toBe(false);
		expect(checkCall("payments.charge.process", "payments.charge.process", [])).toBe(false);
	});

	// ── Audit ────────────────────────────────────────────────────────────────────

	it("emits the audit lifecycle events as a real call would, tagged via: 'checkCall'", async () => {
		api = await build({
			defaultPolicy: "allow",
			audit: "verbose",
			rules: [
				{ caller: "untrusted.**", target: "admin.**", effect: "deny" },
				{ caller: "payments.**", target: "db.**", effect: "allow" }
			]
		});
		const audit = collectAudit(api);
		const { checkCall, checkAccess } = api.slothlet.permissions.global;

		expect(checkCall("untrusted.plugin", "admin.manage", ["x"])).toBe(false);
		expect(checkCall("payments.charge", "db.read", [])).toBe(true);
		expect(checkCall("cache.store", "widgets.render")).toBe(true);
		await settle();

		expect(audit.map((entry) => entry.event)).toEqual(["permission:denied", "permission:allowed", "permission:default"]);
		expect(audit[0].payload).toMatchObject({
			caller: "untrusted.plugin",
			target: "admin.manage",
			via: "checkCall",
			rule: expect.objectContaining({ caller: "untrusted.**", target: "admin.**", effect: "deny" }),
			conditionMatched: false
		});
		expect(audit[1].payload).toMatchObject({ caller: "payments.charge", target: "db.read", via: "checkCall" });
		expect(audit[2].payload).toMatchObject({ caller: "cache.store", target: "widgets.render", via: "checkCall", policy: "allow" });
		for (const { payload } of audit) expect(payload.timestamp).toBeTypeOf("number");

		// The silent query stays silent.
		checkAccess("untrusted.plugin", "admin.manage");
		checkAccess("payments.charge", "db.read");
		await settle();
		expect(audit).toHaveLength(3);
	});

	it("emits permission:denied under the default audit level and nothing for an allow", async () => {
		api = await build({
			defaultPolicy: "allow",
			rules: [{ caller: "untrusted.**", target: "admin.**", effect: "deny" }]
		});
		const audit = collectAudit(api);
		const { checkCall } = api.slothlet.permissions.global;

		expect(checkCall("payments.charge", "db.read")).toBe(true);
		expect(checkCall("untrusted.plugin", "admin.manage")).toBe(false);
		await settle();

		expect(audit).toHaveLength(1);
		expect(audit[0]).toMatchObject({ event: "permission:denied", payload: { via: "checkCall" } });
	});

	// ── Disabled enforcement ─────────────────────────────────────────────────────

	it("answers true, silently, when the permission system is disabled", async () => {
		// No permissions config → the manager is constructed but not enabled (as for checkAccess).
		api = await slothlet({ ...config, base: BASE });
		const audit = collectAudit(api);
		expect(api.slothlet.permissions.global.checkCall("untrusted.plugin", "admin.manage", ["x"])).toBe(true);
		await settle();
		expect(audit).toHaveLength(0);
		await api.shutdown();

		// Explicitly disabled with a deny default and a deny rule: still true.
		api = await build({
			enabled: false,
			defaultPolicy: "deny",
			rules: [{ caller: "untrusted.**", target: "admin.**", effect: "deny" }]
		});
		expect(api.slothlet.permissions.global.checkCall("untrusted.plugin", "admin.manage")).toBe(true);
	});

	// ── Host-only ────────────────────────────────────────────────────────────────

	it("is host-only: a module caller is refused (PERMISSION_DENIED) by a built-in rule, unlike the gatable checkAccess", async () => {
		api = await build({ defaultPolicy: "allow", rules: [] });

		const call = await api.callers.checkCallCaller.attempt("payments.charge", "db.read", []);
		expect(call).toEqual({ ok: false, code: "PERMISSION_DENIED" });

		// checkAccess carries no built-in deny — under an allow default a module reaches it (unchanged).
		const access = await api.callers.checkCallCaller.attemptAccess("payments.charge", "db.read");
		expect(access).toEqual({ ok: true, allowed: true });

		// The built-in rule is visible through the diagnostics surface, like the control.** deny.
		const rules = api.slothlet.permissions.global.rulesForPath("slothlet.permissions.global.checkCall");
		expect(
			rules.find((r) => r.caller === "**" && r.effect === "deny" && r.target === "slothlet.permissions.global.checkCall")
		).toBeDefined();
	});

	it("the host can grant checkCall to a trusted module with an instance rule on the exact target", async () => {
		api = await build({
			defaultPolicy: "allow",
			rules: [
				{ caller: "callers.checkCallCaller.**", target: "slothlet.permissions.global.checkCall", effect: "allow" },
				{ caller: "untrusted.**", target: "admin.**", effect: "deny" }
			]
		});

		expect(await api.callers.checkCallCaller.attempt("payments.charge", "db.read", [])).toEqual({ ok: true, allowed: true });
		expect(await api.callers.checkCallCaller.attempt("untrusted.plugin", "admin.manage", [])).toEqual({ ok: true, allowed: false });
	});

	// ── Validation ───────────────────────────────────────────────────────────────

	it("throws INVALID_ARGUMENT for a non-string or empty caller/target and a non-array args", async () => {
		api = await build({ defaultPolicy: "allow", rules: [] });
		const { checkCall } = api.slothlet.permissions.global;

		expect(() => checkCall(7, "db.read", [])).toThrow(/INVALID_ARGUMENT/);
		expect(() => checkCall("", "db.read", [])).toThrow(/INVALID_ARGUMENT/);
		expect(() => checkCall("payments.charge", null, [])).toThrow(/INVALID_ARGUMENT/);
		expect(() => checkCall("payments.charge", "", [])).toThrow(/INVALID_ARGUMENT/);
		expect(() => checkCall("payments.charge", "db.read", "x")).toThrow(/INVALID_ARGUMENT/);
		expect(() => checkCall("payments.charge", "db.read", { 0: "x" })).toThrow(/INVALID_ARGUMENT/);

		// Omitted, undefined, and null args all mean "no arguments".
		expect(checkCall("payments.charge", "db.read")).toBe(true);
		expect(checkCall("payments.charge", "db.read", undefined)).toBe(true);
		expect(checkCall("payments.charge", "db.read", null)).toBe(true);
	});
});

describe("PermissionManager > checkCall enforcement options (#508)", () => {
	let manager = null;

	afterEach(async () => {
		if (manager) await manager.shutdown();
		manager = null;
	});

	/**
	 * Build a standalone manager.
	 * @param {object[]} rules - Config rules.
	 * @param {object} [extra] - Extra permission config.
	 * @returns {{ manager: PermissionManager, lifecycle: { emit: import("vitest").Mock } }} The manager and its lifecycle spy.
	 */
	const makeManager = (rules = [], extra = {}) => {
		const lifecycle = { emit: vi.fn() };
		const instance = new PermissionManager({
			config: { permissions: { enabled: true, defaultPolicy: "deny", rules, ...extra } },
			handlers: { lifecycle },
			debug: () => {},
			SlothletError
		});
		return { manager: instance, lifecycle };
	};

	it("enforceAccess({ moduleCaller: true }) denies a private target the host policy would allow, and tags the audit with via", () => {
		let lifecycle;
		({ manager, lifecycle } = makeManager([], { private: { host: "allow" } }));

		// No caller file at all = the host, which the policy opens...
		expect(manager.enforceAccess("reporting.peek", "billing.internals._scale", null, null, null, null)).toBe(true);
		expect(lifecycle.emit).not.toHaveBeenCalledWith("permission:denied", expect.anything());
		// ...but a caller declared a file-less MODULE is never the host.
		expect(
			manager.enforceAccess("reporting.peek", "billing.internals._scale", null, null, null, null, { moduleCaller: true, via: "probe" })
		).toBe(false);
		expect(lifecycle.emit).toHaveBeenCalledWith(
			"permission:denied",
			expect.objectContaining({ caller: "reporting.peek", target: "billing.internals._scale", via: "probe" })
		);
	});

	it("does not mutate a cached decision record when tagging the audit payload", () => {
		let lifecycle;
		({ manager, lifecycle } = makeManager([{ caller: "a.**", target: "b.**", effect: "deny" }]));

		// First enforcement caches the decision; the tagged emit must spread, not write `via` into the cache.
		expect(manager.checkCall("a.x", "b.y", [])).toBe(false);
		expect(lifecycle.emit).toHaveBeenLastCalledWith("permission:denied", expect.objectContaining({ via: "checkCall" }));
		expect(manager.enforceAccess("a.x", "b.y")).toBe(false);
		expect(lifecycle.emit).toHaveBeenLastCalledWith("permission:denied", expect.not.objectContaining({ via: expect.anything() }));
	});

	it("answers a private target synchronously even when a requires rule would otherwise need a resolve", () => {
		({ manager } = makeManager([{ caller: "**", target: "**", effect: "allow", requires: ["roles"] }]));
		manager.registerPrincipal("roles", { key: (ctx) => ctx.user, resolve: async () => ({}) });

		// Privacy is decided before rules, so the stale scan short-circuits and no Promise is produced.
		expect(manager.checkCall("reporting.peek", "billing.internals._scale", [], { user: "u1" })).toBe(false);
	});
});
