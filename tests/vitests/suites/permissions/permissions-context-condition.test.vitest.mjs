/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-context-condition.test.vitest.mjs
 *	@Date: 2026-05-02 00:00:00 -07:00 (1746172800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-02 18:24:16 -07:00 (1777771456)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Context Condition > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	// ── Object condition: match ──────────────────────────────────────────────────

	it("object condition match: rule fires when context key equals condition value", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						condition: { tenant: "tenant-a" }
					}
				]
			}
		});

		// Call inside context.run() with matching tenant
		const result = await api.slothlet.context.run({ tenant: "tenant-a" }, async () => {
			return await api.callers.paymentsCaller.callCharge(100);
		});

		expect(result.ok).toBe(true);
	});

	// ── Object condition: non-match ──────────────────────────────────────────────

	it("object condition non-match: rule is skipped and default deny applies", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						condition: { tenant: "tenant-a" }
					}
				]
			}
		});

		// Call with different tenant — condition doesn't match, falls to default deny
		try {
			await api.slothlet.context.run({ tenant: "tenant-b" }, async () => {
				return await api.callers.paymentsCaller.callCharge(100);
			});
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toContain("PERMISSION_DENIED");
		}
	});

	// ── Two rules, different conditions ─────────────────────────────────────────

	it("two rules with different conditions route correctly per-tenant", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "callers.**", target: "payments.**", effect: "allow", condition: { tenant: "tenant-a" } },
					{ caller: "callers.**", target: "payments.**", effect: "deny", condition: { tenant: "tenant-b" } }
				]
			}
		});

		// tenant-a → allow
		const resultA = await api.slothlet.context.run({ tenant: "tenant-a" }, async () => {
			return await api.callers.paymentsCaller.callCharge(50);
		});
		expect(resultA.ok).toBe(true);

		// tenant-b → deny
		try {
			await api.slothlet.context.run({ tenant: "tenant-b" }, async () => {
				return await api.callers.paymentsCaller.callCharge(50);
			});
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toContain("PERMISSION_DENIED");
		}
	});

	// ── Function condition: truthy ───────────────────────────────────────────────

	it("function condition truthy: allow when fn returns true", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						condition: (ctx) => ctx.role === "admin"
					}
				]
			}
		});

		const result = await api.slothlet.context.run({ role: "admin" }, async () => {
			return await api.callers.paymentsCaller.callCharge(100);
		});
		expect(result.ok).toBe(true);
	});

	// ── Function condition: falsy ────────────────────────────────────────────────

	it("function condition falsy: deny (default) when fn returns false", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						condition: (ctx) => ctx.role === "admin"
					}
				]
			}
		});

		try {
			await api.slothlet.context.run({ role: "guest" }, async () => {
				return await api.callers.paymentsCaller.callCharge(100);
			});
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toContain("PERMISSION_DENIED");
		}
	});

	// ── Function condition: throws ───────────────────────────────────────────────

	it("function condition that throws is treated as non-match (not implicit allow)", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						condition: () => {
							throw new Error("condition exploded");
						}
					}
				]
			}
		});

		// The throwing condition is a non-match → falls to default deny
		try {
			await api.slothlet.context.run({ role: "admin" }, async () => {
				return await api.callers.paymentsCaller.callCharge(100);
			});
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toContain("PERMISSION_DENIED");
		}
	});

	// ── No context in scope ──────────────────────────────────────────────────────

	it("no context.run() means runtimeContext is null — object condition is a non-match", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						condition: { tenant: "tenant-a" }
					}
				]
			}
		});

		// No context.run() wrapping — context is null at evaluation time
		try {
			await api.callers.paymentsCaller.callCharge(100);
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toContain("PERMISSION_DENIED");
		}
	});

	it("global.checkAccess uses context.run() runtime context for conditional rules", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						condition: { tenant: "tenant-a" }
					}
				]
			}
		});

		const allowed = await api.slothlet.context.run({ tenant: "tenant-a" }, async () => {
			return api.slothlet.permissions.global.checkAccess("callers.paymentsCaller.callCharge", "payments.charge.process");
		});
		expect(allowed).toBe(true);

		const denied = await api.slothlet.context.run({ tenant: "tenant-b" }, async () => {
			return api.slothlet.permissions.global.checkAccess("callers.paymentsCaller.callCharge", "payments.charge.process");
		});
		expect(denied).toBe(false);
	});

	it("self.access uses context.run() runtime context for conditional rules", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "**",
						target: "payments.**",
						effect: "allow",
						condition: { tenant: "tenant-a" }
					}
				]
			}
		});

		const allowed = await api.slothlet.context.run({ tenant: "tenant-a" }, async () => {
			return api.slothlet.permissions.self.access("payments.charge.process");
		});
		expect(allowed).toBe(true);

		const denied = await api.slothlet.context.run({ tenant: "tenant-b" }, async () => {
			return api.slothlet.permissions.self.access("payments.charge.process");
		});
		expect(denied).toBe(false);
	});

	it("control.enable caller-wrapper path uses context.run() runtime context for conditional allow", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.controlCaller.callEnable",
						target: "slothlet.permissions.control.**",
						effect: "allow",
						condition: { tenant: "tenant-a" }
					}
				]
			}
		});

		await expect(
			api.slothlet.context.run({ tenant: "tenant-a" }, async () => {
				await api.callers.controlCaller.callEnable();
			})
		).resolves.not.toThrow();

		await expect(
			api.slothlet.context.run({ tenant: "tenant-b" }, async () => {
				await api.callers.controlCaller.callEnable();
			})
		).rejects.toThrow("PERMISSION_DENIED");
	});

	// ── Invalid condition type ───────────────────────────────────────────────────

	it("invalid condition type (string) throws INVALID_PERMISSION_RULE", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});

		try {
			api.slothlet.permissions.addRule({
				caller: "callers.**",
				target: "payments.**",
				effect: "allow",
				condition: "tenant-a"
			});
			expect.unreachable("Should have thrown INVALID_PERMISSION_RULE");
		} catch (err) {
			expect(err.message).toContain("INVALID_PERMISSION_RULE");
		}
	});

	// ── Condition not cached — two calls with different contexts ─────────────────

	it("conditional rules are not cached — different contexts produce different results", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						condition: { tenant: "tenant-a" }
					}
				]
			}
		});

		// First call: tenant-a → allow (would populate cache if unconditionally cached)
		const result = await api.slothlet.context.run({ tenant: "tenant-a" }, async () => {
			return await api.callers.paymentsCaller.callCharge(100);
		});
		expect(result.ok).toBe(true);

		// Second call: tenant-b → deny (must NOT use the tenant-a cached result)
		try {
			await api.slothlet.context.run({ tenant: "tenant-b" }, async () => {
				return await api.callers.paymentsCaller.callCharge(100);
			});
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toContain("PERMISSION_DENIED");
		}
	});

	// ── Pure path rule still cached ──────────────────────────────────────────────

	it("rule without condition is still cached after first evaluation", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [{ caller: "callers.**", target: "payments.**", effect: "allow" }]
			}
		});

		// Both calls allowed; second uses cache — no error means cache isn't broken
		const result1 = await api.callers.paymentsCaller.callCharge(100);
		const result2 = await api.callers.paymentsCaller.callCharge(200);
		expect(result1.ok).toBe(true);
		expect(result2.ok).toBe(true);
	});

	// ── Backward compat ──────────────────────────────────────────────────────────

	it("backward compat: rule without condition field matches as before", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [{ caller: "callers.**", target: "payments.**", effect: "allow" }]
			}
		});

		const result = await api.callers.paymentsCaller.callCharge(100);
		expect(result.ok).toBe(true);
	});

	// ── Shorthand object condition match ─────────────────────────────────────────

	it("api.add shorthand accepts { target, condition } object in deny/allow arrays", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		await api.slothlet.api.add("extra", `${BASE}/untrusted`, {
			permissions: {
				deny: [{ target: "admin.**", condition: { tenant: "trial" } }]
			}
		});

		// Rule was created — verify it appears in getRulesForPath output with condition
		const rules = api.slothlet.permissions.global.rulesForPath("admin.manage.createUser");
		const rule = rules.find((r) => r.caller === "extra.**" && r.effect === "deny");
		expect(rule).toBeDefined();
		expect(rule.condition).toEqual({ tenant: "trial" });
	});

	// ── Shorthand mixed entries ──────────────────────────────────────────────────

	it("api.add shorthand handles mixed plain strings and object entries in the same array", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		await api.slothlet.api.add("extra", `${BASE}/untrusted`, {
			permissions: {
				deny: ["admin.**", { target: "db.write.**", condition: { role: "guest" } }]
			}
		});

		const adminRules = api.slothlet.permissions.global.rulesForPath("admin.manage.createUser");
		const plainRule = adminRules.find((r) => r.caller === "extra.**" && r.target === "admin.**");
		expect(plainRule).toBeDefined();
		expect(plainRule.condition).toBeNull();

		const dbRules = api.slothlet.permissions.global.rulesForPath("db.write.insert");
		const condRule = dbRules.find((r) => r.caller === "extra.**" && r.target === "db.write.**");
		expect(condRule).toBeDefined();
		expect(condRule.condition).toEqual({ role: "guest" });
	});

	it("api.add shorthand rejects null entries with INVALID_PERMISSION_RULE", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		try {
			await api.slothlet.api.add("extra", `${BASE}/untrusted`, {
				permissions: {
					allow: [null]
				}
			});
			expect.unreachable("Should have thrown INVALID_PERMISSION_RULE");
		} catch (err) {
			expect(err.message).toContain("INVALID_PERMISSION_RULE");
		}
	});

	it("api.add shorthand rejects object entries missing target with INVALID_PERMISSION_RULE", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		try {
			await api.slothlet.api.add("extra", `${BASE}/untrusted`, {
				permissions: {
					deny: [{ condition: { tenant: "trial" } }]
				}
			});
			expect.unreachable("Should have thrown INVALID_PERMISSION_RULE");
		} catch (err) {
			expect(err.message).toContain("INVALID_PERMISSION_RULE");
		}
	});

	// ── Audit payload conditionMatched: true ─────────────────────────────────────

	it("audit event payload includes conditionMatched: true when winning rule has a condition", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				audit: "verbose",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						condition: { tenant: "tenant-a" }
					}
				]
			}
		});

		const events = [];
		api.slothlet.lifecycle.on("permission:allowed", (data) => events.push(data));

		await api.slothlet.context.run({ tenant: "tenant-a" }, async () => {
			await api.callers.paymentsCaller.callCharge(100);
		});

		expect(events.length).toBeGreaterThan(0);
		const evt = events.find((e) => e.caller === "callers.paymentsCaller.callCharge" && e.target === "payments.charge.process");
		expect(evt).toBeDefined();
		expect(evt.conditionMatched).toBe(true);
	});

	// ── Audit payload conditionMatched: false ────────────────────────────────────

	it("audit event payload includes conditionMatched: false when winning rule has no condition", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				audit: "verbose",
				rules: [{ caller: "callers.**", target: "payments.**", effect: "allow" }]
			}
		});

		const events = [];
		api.slothlet.lifecycle.on("permission:allowed", (data) => events.push(data));

		await api.callers.paymentsCaller.callCharge(100);

		expect(events.length).toBeGreaterThan(0);
		const evt = events.find((e) => e.caller === "callers.paymentsCaller.callCharge" && e.target === "payments.charge.process");
		expect(evt).toBeDefined();
		expect(evt.conditionMatched).toBe(false);
	});

	// ── Array condition: OR semantics — first entry matches ───────────────────────

	it("array condition: allows when the first of multiple conditions matches", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						condition: [{ service: "premium" }, { role: "admin" }]
					}
				]
			}
		});

		// First entry matches
		const result = await api.slothlet.context.run({ service: "premium" }, async () => {
			return await api.callers.paymentsCaller.callCharge(100);
		});
		expect(result.ok).toBe(true);
	});

	// ── Array condition: OR semantics — second entry matches ──────────────────────

	it("array condition: allows when the second of multiple conditions matches", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						condition: [{ service: "premium" }, { role: "admin" }]
					}
				]
			}
		});

		// Second entry matches
		const result = await api.slothlet.context.run({ role: "admin" }, async () => {
			return await api.callers.paymentsCaller.callCharge(100);
		});
		expect(result.ok).toBe(true);
	});

	// ── Array condition: no entry matches → default policy ────────────────────────

	it("array condition: default policy applies when no condition entry matches", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						condition: [{ service: "premium" }, { role: "admin" }]
					}
				]
			}
		});

		// Neither entry matches
		try {
			await api.slothlet.context.run({ role: "guest", service: "free" }, async () => {
				return await api.callers.paymentsCaller.callCharge(100);
			});
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toContain("PERMISSION_DENIED");
		}
	});

	// ── Array condition with function entry ───────────────────────────────────────

	it("array condition: function entry in array is evaluated and passes when truthy", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						condition: [{ service: "premium" }, (ctx) => ctx.role === "admin"]
					}
				]
			}
		});

		// The function entry matches
		const result = await api.slothlet.context.run({ role: "admin", service: "free" }, async () => {
			return await api.callers.paymentsCaller.callCharge(100);
		});
		expect(result.ok).toBe(true);
	});

	// ── Deep nested object condition ──────────────────────────────────────────────

	it("nested object condition: all leaves must match", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						condition: { user: { role: "admin", active: true } }
					}
				]
			}
		});

		// Fully matching nested context
		const result = await api.slothlet.context.run({ user: { role: "admin", active: true, extra: "ignored" } }, async () => {
			return await api.callers.paymentsCaller.callCharge(100);
		});
		expect(result.ok).toBe(true);
	});

	// ── Deep nested object: partial leaf mismatch ─────────────────────────────────

	it("nested object condition: denies when a deeply nested leaf does not match", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						condition: { user: { role: "admin", active: true } }
					}
				]
			}
		});

		// active is false — leaf mismatch
		try {
			await api.slothlet.context.run({ user: { role: "admin", active: false } }, async () => {
				return await api.callers.paymentsCaller.callCharge(100);
			});
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toContain("PERMISSION_DENIED");
		}
	});

	// ── Deep nested object: missing nested key ────────────────────────────────────

	it("nested object condition: denies when a nested key is absent from context", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						condition: { user: { role: "admin" } }
					}
				]
			}
		});

		// context has no user key at all
		try {
			await api.slothlet.context.run({ role: "admin" }, async () => {
				return await api.callers.paymentsCaller.callCharge(100);
			});
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toContain("PERMISSION_DENIED");
		}
	});

	// ── Invalid condition: array with invalid entry ───────────────────────────────

	it("array condition with a non-object/non-function entry throws INVALID_PERMISSION_RULE", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: { defaultPolicy: "allow", rules: [] }
		});

		try {
			api.slothlet.permissions.addRule({
				caller: "callers.**",
				target: "payments.**",
				effect: "allow",
				condition: [{ role: "admin" }, 42]
			});
			expect.unreachable("Should have thrown INVALID_PERMISSION_RULE");
		} catch (err) {
			expect(err.message).toContain("INVALID_PERMISSION_RULE");
		}
	});

	// ── Invalid condition: empty array ────────────────────────────────────────────

	it("empty array condition throws INVALID_PERMISSION_RULE", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: { defaultPolicy: "allow", rules: [] }
		});

		try {
			api.slothlet.permissions.addRule({
				caller: "callers.**",
				target: "payments.**",
				effect: "allow",
				condition: []
			});
			expect.unreachable("Should have thrown INVALID_PERMISSION_RULE");
		} catch (err) {
			expect(err.message).toContain("INVALID_PERMISSION_RULE");
		}
	});

	// ── Rule without condition ignores context entirely ───────────────────────────

	it("rule without condition applies regardless of what context is provided", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [{ caller: "callers.**", target: "payments.**", effect: "allow" }]
			}
		});

		// With arbitrary context — must still be allowed
		const r1 = await api.slothlet.context.run({ role: "guest", service: "free" }, async () => {
			return await api.callers.paymentsCaller.callCharge(10);
		});
		expect(r1.ok).toBe(true);

		// Without any context.run() — must still be allowed
		const r2 = await api.callers.paymentsCaller.callCharge(20);
		expect(r2.ok).toBe(true);
	});

	// ── control.enable/disable: ctx.context undefined (no context.run) ────────────

	it("control.enable called without context.run() — ctx.context is undefined, runtimeContext falls back to null", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.controlCaller.callEnable", target: "slothlet.permissions.control.**", effect: "allow" }]
			}
		});

		// Calling without context.run() means ctx.context is undefined → ?? null fires.
		// Await in case LAZY mode returns a Promise; in EAGER mode it returns undefined (sync call).
		await Promise.resolve(api.callers.controlCaller.callEnable());
	});

	it("control.disable called without context.run() — ctx.context is undefined, runtimeContext falls back to null", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.controlCaller.callDisable", target: "slothlet.permissions.control.**", effect: "allow" }]
			}
		});

		// Calling without context.run() means ctx.context is undefined → ?? null fires.
		// Await in case LAZY mode returns a Promise; in EAGER mode it returns undefined (sync call).
		await Promise.resolve(api.callers.controlCaller.callDisable());
	});
});
