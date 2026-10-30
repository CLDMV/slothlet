/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-caller-supplied-ceiling.test.vitest.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #597 — code a caller hands to a leaf runs as the caller, with the leaf as its ceiling.
 *
 * @description
 * Code supplied to another module's call runs as its supplier, and the call it runs inside has to allow each
 * access as well. These tests pin the second half: an access only the supplier is allowed is refused from inside
 * the callee's call, and every identity taken there — a `lockCaller` pin, a captured reference, a `run()` scope,
 * a relay's `lockCaller.caller` — keeps the callee as its ceiling, so it cannot be used afterwards to carry the
 * supplier past what the callee may do.
 *
 * Fixture: `supplier.probe` may call `callee.**`, `relay.**` and its own `vault.secret.forSupplier` and read
 * `vault.data.level`; only `callee.**` may call `vault.secret.secret`; `relay.**` holds `lockCaller.caller`.
 *
 * @module tests/vitests/suites/permissions/permissions-caller-supplied-ceiling
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_CALLER_SUPPLIED_CEILING;

/** Deny by default; each vault target belongs to one module. */
const RULES = [
	{ caller: "callee.**", target: "vault.secret.secret", effect: "allow" },
	{ caller: "supplier.**", target: "vault.secret.forSupplier", effect: "allow" },
	{ caller: "supplier.**", target: "vault.data.level", effect: "allow" },
	{ caller: "supplier.**", target: "callee.**", effect: "allow" },
	{ caller: "supplier.**", target: "relay.**", effect: "allow" },
	{ caller: "callee.**", target: "relay.**", effect: "allow" },
	{ caller: "relay.**", target: "slothlet.lockCaller.caller", effect: "allow" },
	{ caller: "**", target: "slothlet.run", effect: "allow" }
];

const DENIED = { ok: false, code: "PERMISSION_DENIED" };

describe.each(getMatrixConfigs())("Permissions > caller-supplied code keeps the callee as its ceiling (#597) > $name", ({ config }) => {
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

	it("control: the supplier calls its own target directly", async () => {
		await build();
		expect(await api.supplier.probe.direct()).toEqual({ ok: true, value: "supplied" });
	});

	it("control: the supplier reads its own data directly", async () => {
		await build();
		expect(await api.supplier.probe.readDirect()).toEqual({ ok: true, value: 3 });
	});

	it("control: a relay runs the supplier's callback as the supplier", async () => {
		await build();
		expect(await api.supplier.probe.relayDirect()).toEqual({ ok: true, value: "supplied" });
	});

	it("supplied code reports the supplier as itself", async () => {
		await build();
		expect(await api.supplier.probe.selfInside()).toBe("supplier.probe.selfInside");
	});

	it("supplied code may not call what only the supplier may: the callee has to allow it too", async () => {
		await build();
		expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.ceilingCall())).toEqual(DENIED);
	});

	it("supplied code may not read what only the supplier may", async () => {
		await build();
		expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.ceilingRead())).toEqual(DENIED);
	});

	it("a lockCaller pin taken by supplied code keeps the callee as its ceiling", async () => {
		await build();
		expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.pinnedInside())).toEqual(DENIED);
	});

	it("a reference captured by supplied code keeps the callee as its ceiling", async () => {
		await build();
		expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.capturedInside())).toEqual(DENIED);
	});

	it("a scope opened by supplied code runs as the supplier, not the callee", async () => {
		await build();
		expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.scopeInside())).toEqual(DENIED);
	});

	it("a relay's lockCaller.caller pin of supplied code keeps the callee as its ceiling", async () => {
		await build();
		expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.relayInside())).toEqual(DENIED);
	});
});
