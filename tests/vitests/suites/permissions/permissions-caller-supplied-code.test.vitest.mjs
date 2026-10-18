/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-caller-supplied-code.test.vitest.mjs
 *	@Date: 2026-10-16T19:30:00-07:00 (1792204200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-16T19:30:00-07:00 (1792204200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #597 — code a caller hands to a leaf runs with the caller's identity, whichever leaf runs it.
 *
 * @description
 * A module that calls another module's leaf can pass it a value carrying its own code: a `toString` the leaf
 * converts, a getter it reads, a Proxy trap, a callback it calls. That code is the caller's, so every `self.*`
 * call it makes has to be checked against the caller's rules. Attributing it to the leaf that happens to be
 * executing hands the caller everything the leaf is allowed.
 *
 * Fixture: `supplier.probe` (allowed nothing but `callee.**`) hands `callee.ops` values whose code calls
 * `vault.secret.secret`, which only `callee.**` may call, or `vault.secret.whoami`, which reports its caller.
 * `extension.restore` / `keystore.key` reproduce CLDMV/jellytagger#3: a lock that runs a callback the caller
 * supplied.
 *
 * Two controls bound the fix from the other side: the supplier's direct call is refused, and the callee keeps
 * using its own rights when the supplier asks it to.
 *
 * @module tests/vitests/suites/permissions/permissions-caller-supplied-code
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_CALLER_SUPPLIED_CODE;

/** Deny by default; the vault's secret is the callee's alone. */
const RULES = [
	{ caller: "callee.**", target: "vault.secret.secret", effect: "allow" },
	{ caller: "**", target: "vault.secret.whoami", effect: "allow" },
	{ caller: "supplier.**", target: "callee.**", effect: "allow" },
	{ caller: "extension.**", target: "keystore.**", effect: "allow" }
];

/**
 * Each way a value can carry the supplier's code into the callee's call: the supplier leaf that sets it up,
 * and what the callee does with the value.
 * @type {Array<[string, string]>}
 */
const CHANNELS = [
	["viaToString", "String(v) runs a toString (the issue's repro)"],
	["viaTemplate", "a template literal runs a toString"],
	["viaValueOf", "+v runs a valueOf"],
	["viaToPrimitive", "+v runs a Symbol.toPrimitive"],
	["viaToJSON", "JSON.stringify runs a toJSON"],
	["viaGetter", "reading a property runs a getter"],
	["viaProxyGet", "reading a property runs a Proxy get trap"],
	["viaProxyHas", "`in` runs a Proxy has trap"],
	["viaCallback", "a callback called synchronously"],
	["viaCallbackAfterAwait", "a callback called after the callee awaits"],
	["viaEvaluated", "a toString built with new Function, whose frame names no file"],
	["viaSharedHelper", "a callback bound from a helper both modules import"]
];

describe.each(getMatrixConfigs())("Permissions > caller-supplied code (#597) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build the fixture api under the deny-by-default rules.
	 * @returns {Promise<object>} The api.
	 */
	const build = async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "deny", rules: RULES } });
		return api;
	};

	// ── Controls ────────────────────────────────────────────────────────────────

	it("control: the supplier's direct call to the vault is refused", async () => {
		await build();
		const outcome = await withSuppressedSlothletErrorOutput(() => api.supplier.probe.direct());
		expect(outcome).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});

	it("control: the callee keeps its own rights when the supplier asks it to use them", async () => {
		await build();
		expect(await api.supplier.probe.viaDeputy()).toEqual({ ok: true, value: "s3cret" });
	});

	it("control: the vault sees the supplier on a direct call", async () => {
		await build();
		expect(await api.supplier.probe.direct("whoami")).toEqual({ ok: true, value: "supplier.probe.direct" });
	});

	// ── The supplier's code is the supplier's ───────────────────────────────────

	it.each(CHANNELS)("%s: refused like a direct call — %s", async (probe) => {
		await build();
		const outcome = await withSuppressedSlothletErrorOutput(() => api.supplier.probe[probe]());
		expect(outcome).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});

	it.each(CHANNELS)("%s: the vault sees the supplier, not the callee — %s", async (probe) => {
		await build();
		expect(await api.supplier.probe[probe]("whoami")).toEqual({ ok: true, value: `supplier.probe.${probe}` });
	});

	// ── CLDMV/jellytagger#3: a callback run under a lock ────────────────────────

	it("a callback run under the key store's lock calls the api as the extension", async () => {
		await build();
		expect(await api.extension.restore.underLock()).toEqual({
			name: "restore",
			holder: "extension.restore.underLock",
			result: "extension.restore.underLock"
		});
	});

	it("a callback run under the key store's lock still calls as the extension after its own await", async () => {
		await build();
		expect(await api.extension.restore.underLockAfterAwait()).toEqual({
			name: "restore",
			holder: "extension.restore.underLockAfterAwait",
			result: "extension.restore.underLockAfterAwait"
		});
	});
});
