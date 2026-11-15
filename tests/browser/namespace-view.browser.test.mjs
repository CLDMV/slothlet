/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/namespace-view.browser.test.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Listing, logging and inspecting the api and `self.slothlet` in a real headless browser.
 *
 * @description
 * A browser has no `util.inspect`; the console formats a value itself. A `viewer` module lists `self.slothlet` as a
 * plain object (only the members it may read, without an error), logs the root, a node and the namespace with
 * `console.log` without an error, and calling the namespace's inspect hook through the key slothlet's platform shim
 * uses shows it only the members it lists. The host logs the api and the namespace, and the hook stays out of what the
 * namespace lists. Eager and lazy mode, permissions on with a deny rule (off for the logging row).
 * @module tests/browser/namespace-view.browser
 */

import { describe, it, expect } from "vitest";
// Node-built (filesystem) fixture manifest, injected by the browser config.
import { manifest, fixtureRel } from "virtual:browser-fixture-manifest";

describe.each(["eager", "lazy"])("the api and self.slothlet as plain objects in a browser > %s", (mode) => {
	/**
	 * `viewer` is denied `slothlet.diag`, or the permission system is off.
	 * @param {boolean} [permissions=true] - Whether the permission system is on.
	 * @returns {Promise<object>} A bound browser-mode api.
	 */
	const boot = async (permissions = true) => {
		const mod = await import("@cldmv/slothlet");
		const slothlet = mod.default ?? mod.slothlet;
		const BASE = new URL("/" + fixtureRel + "/", location.origin).href;
		const api = await slothlet({
			platform: "browser",
			base: BASE,
			manifest,
			resolveModuleSpecifier: ({ path }) => new URL(path, BASE).href,
			mode,
			silent: true,
			diagnostics: true,
			...(permissions
				? { permissions: { defaultPolicy: "allow", rules: [{ caller: "viewer.**", target: "slothlet.diag", effect: "deny" }] } }
				: {})
		});
		await api.viewer;
		return api;
	};

	it("lets a module list self.slothlet as the members it may read, without an error", async () => {
		const api = await boot();
		try {
			const readable = api.viewer.readable("slothlet", Object.keys(api.slothlet));
			const { keys, entries, spread } = api.viewer.list("slothlet");
			expect(keys).toEqual(readable);
			expect(entries).toEqual(readable);
			expect(spread).toEqual(readable);
			expect(readable).not.toContain("diag");
			expect(readable).not.toContain("reload");
		} finally {
			await api.shutdown();
		}
	});

	// With the permission system on, a console that formats a value by reading it (as vitest's does) is refused reading
	// the `name` of a function whose path the rules cover (`slothlet.hook.on.name` under the built-in rules), so this
	// runs with the system off, as by default.
	it("logs the root, a node and the namespace with console.log, for a module and the host", async () => {
		const api = await boot(false);
		try {
			for (const path of ["self", "slothlet", "slothlet.api", "math", "advanced"]) expect(api.viewer.logged(path), path).toBe("logged");
			expect(() => console.log(api, api.slothlet, api.math)).not.toThrow();
		} finally {
			await api.shutdown();
		}
	});

	it("shows a module calling the namespace's inspect hook only the members it lists, and keeps the hook out of the listing", async () => {
		const api = await boot();
		try {
			expect(api.viewer.hooked("slothlet")).toEqual(api.viewer.list("slothlet").keys);
			expect(api.viewer.hooked("slothlet.api")).toEqual(api.viewer.list("slothlet.api").keys);
			expect(Reflect.ownKeys(api.slothlet).filter((key) => typeof key === "symbol")).toEqual([]);
		} finally {
			await api.shutdown();
		}
	});
});
