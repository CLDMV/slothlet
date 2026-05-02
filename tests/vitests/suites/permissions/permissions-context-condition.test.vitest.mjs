/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-context-condition.test.vitest.mjs
 *	@Date: 2026-05-02 00:00:00 -07:00 (1746172800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-02 00:00:00 -07:00 (1746172800)
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
});
