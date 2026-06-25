/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/compose.browser.test.mjs
 *	@Date: 2026-06-16T19:59:25-07:00 (1781665165)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-21 17:07:57 -07:00 (1782086877)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Composes slothlet in real browser mode (headless Chromium) against the
 * api_test_browser fixture, driving the runtime browser-only arms the node suite can't reach:
 * context-async's null-AsyncLocalStorage path, the Map-based lifecycle emitter
 * (eventemitter-context, no node:events), and api_builder's browser branch via api.add.
 */

import { describe, it, expect } from "vitest";
// Node-built (filesystem) fixture manifest, injected by the browser config.
import { manifest, fixtureRel } from "virtual:browser-fixture-manifest";

describe("slothlet compose in a real browser", () => {
	const composeBrowser = async (extra = {}) => {
		const mod = await import("@cldmv/slothlet");
		const slothlet = mod.default ?? mod.slothlet;
		const BASE = new URL("/" + fixtureRel + "/", location.origin).href;
		return slothlet({
			platform: "browser",
			base: BASE,
			manifest,
			resolveModuleSpecifier: ({ path }) => new URL(path, BASE).href,
			mode: "eager",
			...extra
		});
	};

	it("composes, runs self/hooks, fires lifecycle events, and mounts via api.add", async () => {
		const api = await composeBrowser({ hook: { enabled: true } });
		// Basic compose + a real call.
		expect(await api.math.add(2, 3)).toBe(5);

		// self live-binding routes an internal call through context-async (null-ALS browser arm).
		const callCalc = (node, a, b) => (typeof node === "function" ? node(a, b) : node.addViaSelf(a, b));
		expect(await callCalc(api.advanced?.calc ?? api.advanced, 2, 3)).toBe(5);

		// Lifecycle events run on the Map-based emitter (eventemitter-context, no node:events in browser).
		let evCount = 0;
		const offs = ["impl:created", "impl:changed"].map((ev) => api.slothlet.lifecycle.on(ev, () => evCount++));
		const BASE = new URL("/" + fixtureRel + "/", location.origin).href;
		await api.slothlet.api.add("extra", BASE + "utils"); // exercises api_builder browser path
		offs.forEach((off) => typeof off === "function" && off());
		expect(evCount).toBeGreaterThan(0);
		expect(api.extra).toBeDefined();

		if (typeof api.shutdown === "function") await api.shutdown();
	});

	it("gates an internal call via permissions (browser context path)", async () => {
		const api = await composeBrowser({
			permissions: { defaultPolicy: "allow", rules: [{ caller: "advanced.calc.**", target: "math.**", effect: "deny" }] }
		});
		const callCalc = (node, a, b) => (typeof node === "function" ? node(a, b) : node.addViaSelf(a, b));
		// The gate throws synchronously through the apply trap, so wrap in an async IIFE to normalise
		// it to a rejection regardless of sync-throw vs async-reject.
		await expect((async () => callCalc(api.advanced?.calc ?? api.advanced, 2, 3))()).rejects.toThrow(/PERMISSION/);
		if (typeof api.shutdown === "function") await api.shutdown();
	});

	it("reload() exercises _clearModuleCaches' browser no-op arm (no Node require cache)", async () => {
		const api = await composeBrowser();
		expect(await api.math.add(2, 3)).toBe(5);
		// reload() calls _clearModuleCaches(), whose first line early-returns in a browser
		// (`if (!isNode) return;` — there is no Node require cache to clear).
		await api.slothlet.reload();
		// The live-bound api still resolves after the reload.
		expect(await api.math.add(4, 5)).toBe(9);
		if (typeof api.shutdown === "function") await api.shutdown();
	});
});
