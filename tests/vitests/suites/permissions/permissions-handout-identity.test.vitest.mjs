/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-handout-identity.test.vitest.mjs
 *	@Date: 2026-11-27T20:30:43-08:00 (1795840243)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:28-08:00 (1795869148)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #1026 — a leaf that hands one of its own functions to another leaf and gets it back receives the
 * function itself, under `"precise"` as under `"fast"`, as the host does.
 *
 * @description
 * Fixture: the root module's `supplier.probe` hands `mine` to `callee.ops.echo` (returned as it is) and to
 * `callee.ops.pick` (nested in data). A module added at `plugin` does the same from `plugin.give`.
 *
 * @module tests/vitests/suites/permissions/permissions-handout-identity
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMatrixConfigs, apiPart } from "../../setup/vitest-helper.mjs";

/** The fixture: the root module's tree, and `_plugin` for the module added with `api.add()`. */
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_handout_identity");

/** Every leaf may call every other. */
const PERMISSIONS = (attribution) => ({ policy: "allow", caller: { attribution } });

/** Deny by default: the vault is the callee's alone, and the suppliers may call the callee. */
const DENY = (attribution) => ({
	policy: "deny",
	caller: { attribution },
	rules: [
		{ caller: "callee.**", target: "vault.**", effect: "allow" },
		{ caller: "supplier.**", target: "callee.**", effect: "allow" },
		{ caller: "plugin.**", target: "callee.**", effect: "allow" }
	]
});

describe.each(getMatrixConfigs())("handed-back identity > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	describe.each(["precise", "fast"])('attribution "%s"', (attribution) => {
		it("gives a root-module leaf its own function back from another leaf of the root module", async () => {
			api = await slothlet({ ...config, base: apiPart(DIR), permissions: PERMISSIONS(attribution) });
			expect(await api.supplier.probe.roundTrip()).toEqual({ echo: true, pick: true, runs: "mine" });
		});

		it("gives a leaf of an added module its own function back from a leaf of the root module", async () => {
			api = await slothlet({ ...config, base: apiPart(DIR), permissions: PERMISSIONS(attribution) });
			await api.slothlet.api.add("plugin", apiPart(DIR, "plugin"), { id: "plugin-mod" });
			expect(await api.plugin.give.roundTrip()).toEqual({ echo: true, pick: true, runs: "plugin" });
		});

		it("gives a root-module leaf its own function back under deny rules, compared inside the leaf", async () => {
			api = await slothlet({ ...config, base: apiPart(DIR), permissions: DENY(attribution) });
			expect(await api.supplier.probe.vaultTrip()).toEqual({ echo: true, pick: true });
		});

		it("gives a leaf of an added module its own function back under deny rules, compared inside the leaf", async () => {
			api = await slothlet({ ...config, base: apiPart(DIR), permissions: DENY(attribution) });
			await api.slothlet.api.add("plugin", apiPart(DIR, "plugin"), { id: "plugin-mod" });
			expect(await api.plugin.give.vaultTrip()).toEqual({ echo: true, pick: true });
		});

		it("gives the host its own function back, as the leaves get theirs", async () => {
			api = await slothlet({ ...config, base: apiPart(DIR), permissions: PERMISSIONS(attribution) });
			const mine = () => "host";
			expect(await api.callee.ops.echo(mine)).toBe(mine);
			expect(await api.callee.ops.pick({ inner: { cb: mine } })).toBe(mine);
		});
	});

	it("gives both leaves their own functions back with the permission system off", async () => {
		api = await slothlet({ ...config, base: apiPart(DIR) });
		await api.slothlet.api.add("plugin", apiPart(DIR, "plugin"), { id: "plugin-mod" });
		expect(await api.supplier.probe.roundTrip()).toEqual({ echo: true, pick: true, runs: "mine" });
		expect(await api.plugin.give.roundTrip()).toEqual({ echo: true, pick: true, runs: "plugin" });
	});
});
