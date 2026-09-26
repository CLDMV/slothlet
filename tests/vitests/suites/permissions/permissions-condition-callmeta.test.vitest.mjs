/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-condition-callmeta.test.vitest.mjs
 *	@Date: 2026-09-25 00:00:00 -07:00 (1790319600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-25 00:00:00 -07:00 (1790319600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview #455 — resource-scoped condition gates. A rule's function condition receives the
 * call's arguments and the concrete target path as a second argument, `condition(ctx, { args, target })`,
 * so it can authorize on the resource named in the call itself and not only on ambient context. The
 * threading covers the direct call gate, the construct gate, and the captured-reference gate; reads,
 * hooks, events, and silent queries continue to evaluate conditions with `callMeta === null`.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

/**
 * Assert an inter-module invocation is denied, tolerant of both delivery shapes: an eager sync
 * function throws synchronously at the gate, while a lazy one rejects — wrapping in an async thunk
 * normalizes a synchronous throw into a rejection so a single assertion covers every matrix mode.
 * @param {() => unknown} invoke - Zero-arg thunk that performs the guarded call.
 * @returns {Promise<void>}
 */
const expectDenied = (invoke) => expect((async () => invoke())()).rejects.toThrow(/PERMISSION_DENIED/);

describe.each(getMatrixConfigs())("Permissions > Condition callMeta (#455) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	// ── Direct call gate: args are threaded ──────────────────────────────────────

	it("function condition receives { args, target } from the call and can gate on the args", async () => {
		const seen = [];
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
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
			}
		});

		const ok = await api.callers.paymentsCaller.callCharge(100);
		expect(ok.ok).toBe(true);

		// The condition actually received the call's own arguments and the concrete target path.
		expect(seen.length).toBeGreaterThan(0);
		expect(seen[seen.length - 1]).toMatchObject({ args: [100], target: "payments.charge.process" });

		// A charge below the threshold is denied purely because the condition read the call's args.
		await expectDenied(() => api.callers.paymentsCaller.callCharge(50));
	});

	// ── target is the concrete leaf, even under a glob rule ───────────────────────

	it("callMeta.target is the concrete leaf path so one globbed rule can branch per-target", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.**",
						effect: "allow",
						// Only permit the charge leaf; the same rule denies the webhook leaf.
						condition: (ctx, meta) => meta?.target === "payments.charge.process"
					}
				]
			}
		});

		const charged = await api.callers.paymentsCaller.callCharge(1);
		expect(charged.ok).toBe(true);

		await expectDenied(() => api.callers.paymentsCaller.callWebhook({ type: "ping" }));
	});

	// ── ctx and callMeta compose ─────────────────────────────────────────────────

	it("condition can combine ambient context (ctx) with the call's args (callMeta)", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.charge.process",
						effect: "allow",
						condition: (ctx, meta) => ctx.role === "admin" && meta?.args?.[0] === 100
					}
				]
			}
		});

		// Right role AND right resource → allow.
		const ok = await api.slothlet.context.run({ role: "admin" }, () => api.callers.paymentsCaller.callCharge(100));
		expect(ok.ok).toBe(true);

		// Right role, wrong resource → deny.
		await expectDenied(() => api.slothlet.context.run({ role: "admin" }, () => api.callers.paymentsCaller.callCharge(999)));

		// Right resource, wrong role → deny.
		await expectDenied(() => api.slothlet.context.run({ role: "guest" }, () => api.callers.paymentsCaller.callCharge(100)));
	});

	// ── Array condition forwards callMeta to function entries ─────────────────────

	it("array condition forwards callMeta to a function entry (OR semantics)", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "payments.charge.process",
						effect: "allow",
						// Neither the object entry nor the ctx match; the function entry matches via the call args.
						condition: [{ service: "premium" }, (ctx, meta) => meta?.args?.[0] === 100]
					}
				]
			}
		});

		const ok = await api.callers.paymentsCaller.callCharge(100);
		expect(ok.ok).toBe(true);

		await expectDenied(() => api.callers.paymentsCaller.callCharge(1));
	});

	// ── Construct gate parity ─────────────────────────────────────────────────────

	it("construct trap threads callMeta so `new self.X()` gets the same resource-scoped gate", async () => {
		const seen = [];
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{
						caller: "callers.**",
						target: "widgets.**",
						effect: "allow",
						condition: (ctx, meta) => {
							seen.push(meta);
							return meta?.args?.[0] === "ok";
						}
					}
				]
			}
		});

		const widget = await api.callers.widgetCaller.construct("ok");
		expect(widget.label).toBe("ok");
		expect(seen[seen.length - 1]).toMatchObject({ args: ["ok"], target: "widgets.Widget" });

		await expectDenied(() => api.callers.widgetCaller.construct("blocked"));
	});

	// ── Captured-reference gate parity ────────────────────────────────────────────

	/**
	 * Grants only paymentsCaller the db.write surface, gated by a function condition reading the call's args.
	 * @param {Function} predicate - The `(ctx, callMeta)` condition to attach to the write rule.
	 * @returns {Promise<object>} Bound api.
	 */
	const writeGatedBy = (predicate) =>
		slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "callers.paymentsCaller.**", target: "db.write.**", effect: "allow", condition: predicate },
					{ caller: "**", target: "callers.**", effect: "allow" }
				]
			}
		});

	it("a captured reference the module invokes is gated with the call's args (#455 parity)", async () => {
		// useOwnCapturedRef captures self.db.write.insert and calls it with { x: 1 }.
		api = await writeGatedBy((ctx, meta) => meta?.args?.[0]?.x === 1);
		expect(await api.callers.paymentsCaller.useOwnCapturedRef()).toMatchObject({ ok: true });
	});

	it("a captured reference is denied when the condition rejects the call's args", async () => {
		// The predicate never matches { x: 1 }, so threading is proven to be a real read, not a rubber stamp.
		api = await writeGatedBy((ctx, meta) => meta?.args?.[0]?.x === 999);
		const outcome = await api.callers.paymentsCaller.useOwnCapturedRef();
		expect(outcome.ok).toBe(false);
		expect(outcome.code).toMatch(/PERMISSION_DENIED/);
	});

	// ── Backward compatibility ────────────────────────────────────────────────────

	it("a one-argument condition (ctx) still works — the extra callMeta arg is simply ignored", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [{ caller: "callers.**", target: "payments.**", effect: "allow", condition: (ctx) => ctx.tenant === "acme" }]
			}
		});

		const ok = await api.slothlet.context.run({ tenant: "acme" }, () => api.callers.paymentsCaller.callCharge(100));
		expect(ok.ok).toBe(true);

		await expectDenied(() => api.slothlet.context.run({ tenant: "other" }, () => api.callers.paymentsCaller.callCharge(100)));
	});
});
