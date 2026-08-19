/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/framework-marker-detection-walk.test.vitest.mjs
 *	@Date: 2026-08-18 00:00:00 -07:00 (1787036400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-18 00:00:00 -07:00 (1787036400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Framework dispatcher-detection walk under the module-private host gate (#287).
 *
 * @description
 * The framework's tree walks (e.g. `collectPendingMaterializations` during `api.add`) skip version
 * dispatchers. They used to detect one by reading `obj.__isVersionDispatcher` — but that is a
 * `__`-private read, and under a `permissions` block the secure-default `private.host: deny` denies
 * a host read of a `__`-prefixed member on ANY gated data node. So walking an extension whose
 * `manifest.activationEvents` is an ordinary array threw `PERMISSION_DENIED` at
 * `…manifest.activationEvents.__isVersionDispatcher` and aborted the mount — the ext-host boot
 * regression #283/#287. The fix detects dispatchers by their module-private brand (object identity),
 * never by a gated marker read, so the walk never touches the gate for ordinary data.
 *
 * @module tests/vitests/suites/permissions/framework-marker-detection-walk
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_manifest_dispatch", import.meta.url).pathname;

// The ext-host's isolation policy: modules can't mutate the api, the root leaf is readable, and each
// extension's declared `public` leaf is allowed. `defaultPolicy: "deny"` engages `private.host: deny`.
const RULES = [
	{ caller: "**", target: "slothlet.api.**", effect: "deny" },
	{ caller: "**", target: "host.**", effect: "allow" },
	{ caller: "**", target: "exts.costcode.engine.create", effect: "allow" }
];

describe.each(["eager", "lazy"])("Permissions > framework marker-detection walk (#287) > %s", (mode) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("mounting an ext whose manifest.activationEvents is a plain array does not deny the detection walk", async () => {
		api = await slothlet({ mode, base: `${BASE}/base`, permissions: { defaultPolicy: "deny", rules: RULES } });
		// Before the fix, the walk read `exts.costcode.manifest.activationEvents.__isVersionDispatcher`
		// as the host and threw PERMISSION_DENIED here, aborting the mount.
		await expect(api.slothlet.api.add(["exts"], `${BASE}/ext`)).resolves.toBeDefined();
	});

	it("keeps the declared leaf reachable and the manifest array intact after mounting", async () => {
		api = await slothlet({ mode, base: `${BASE}/base`, permissions: { defaultPolicy: "deny", rules: RULES } });
		await api.slothlet.api.add(["exts"], `${BASE}/ext`);

		const costcode = mode === "lazy" ? await api.exts.costcode : api.exts.costcode;
		const create = mode === "lazy" ? await costcode.engine.create : costcode.engine.create;
		expect(typeof create).toBe("function");
		// The manifest data survives the walk — the marker detection never corrupted or gated it.
		const manifest = mode === "lazy" ? await costcode.manifest : costcode.manifest;
		const events = mode === "lazy" ? await manifest.activationEvents : manifest.activationEvents;
		expect(Array.from(events)).toEqual(["onStartup"]);
	});

	it("version-dispatches a manifest data field (different data per version) under deny permissions", async () => {
		// A data field like `activationEvents` may legitimately hold different data in one version than
		// another, so it is a valid version-dispatch target (#287). Both versions must compose under
		// permissions without the detection walk denying the marker probe, and each must resolve its own data.
		api = await slothlet({ mode, base: `${BASE}/base`, permissions: { defaultPolicy: "deny", rules: RULES } });
		await expect(api.slothlet.api.add(["exts"], `${BASE}/ext`, {}, { version: "v1", default: true })).resolves.toBeDefined();
		await expect(api.slothlet.api.add(["exts"], `${BASE}/v2`, {}, { version: "v2" })).resolves.toBeDefined();

		const readEvents = async (ns) => {
			const cc = mode === "lazy" ? await ns.costcode : ns.costcode;
			const m = mode === "lazy" ? await cc.manifest : cc.manifest;
			const ev = mode === "lazy" ? await m.activationEvents : m.activationEvents;
			return Array.from(ev);
		};
		// The dispatched default resolves to v1's data; the versioned namespaces carry each version's own.
		const exts = mode === "lazy" ? await api.exts : api.exts;
		expect(await readEvents(exts)).toEqual(["onStartup"]);
		const v1ns = mode === "lazy" ? await api.v1.exts : api.v1.exts;
		expect(await readEvents(v1ns)).toEqual(["onStartup"]);
		const v2ns = mode === "lazy" ? await api.v2.exts : api.v2.exts;
		expect(await readEvents(v2ns)).toEqual(["onStartup", "onResume"]);
	});

	it("skips a version dispatcher the materialization walk descends through (detected by brand, not routed)", async () => {
		// Register a version dispatcher at a nested path, then a non-versioned add at its parent whose
		// materialization walk descends THROUGH the dispatcher node. The walk must skip it by the brand
		// (never reading its routing props, which would fire the discriminator or hit the gate).
		const V = new URL("../../../../api_tests/api_test_versioned", import.meta.url).pathname;
		api = await slothlet({ mode, base: `${BASE}/base`, permissions: { defaultPolicy: "deny", rules: RULES } });
		await api.slothlet.api.add(["exts", "svc", "field"], `${V}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add(["exts", "svc", "field"], `${V}/v2`, {}, { version: "v2" });
		await expect(api.slothlet.api.add(["exts", "svc"], `${BASE}/ext`, {}, {})).resolves.toBeDefined();
	});
});
