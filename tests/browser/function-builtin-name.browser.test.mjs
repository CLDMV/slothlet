/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/function-builtin-name.browser.test.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:04-08:00 (1794882484)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A function's own `name` and `length` read by module code in a real headless browser, with the
 * permission system on.
 *
 * @description
 * A page-side console (vitest's browser console formats with loupe and pretty-format) reads the `name` and `length` of
 * every function it shows. A `viewer` module reads both off a function node it may not call and off slothlet's own
 * functions under the built-in rules, and logs the root, nodes and the namespace with `console.log`, without an error.
 * Eager and lazy mode, under a deny rule and under a default deny.
 * @module tests/browser/function-builtin-name.browser
 */

import { describe, it, expect } from "vitest";
// Node-built (filesystem) fixture manifest, injected by the browser config.
import { manifest, fixtureRel } from "virtual:browser-fixture-manifest";

const POLICIES = [
	{
		label: "a deny rule on the target",
		permissions: { policy: "allow", rules: [{ caller: "viewer.**", target: "math.**", effect: "deny" }] }
	},
	{ label: "default deny with no rule for the target", permissions: { policy: "deny", rules: [] } }
];

describe.each(["eager", "lazy"])("a function's built-in name and length in a browser > %s", (mode) => {
	describe.each(POLICIES)("$label", ({ permissions }) => {
		/**
		 * A browser-mode api with the permission system on.
		 * @returns {Promise<object>} A bound browser-mode api.
		 */
		const boot = async () => {
			const mod = await import("@cldmv/slothlet");
			const slothlet = mod.default ?? mod.slothlet;
			const BASE = new URL("/" + fixtureRel + "/", location.origin).href;
			const api = await slothlet({
				base: BASE,
				loader: {
					platform: "browser",
					files: manifest,
					resolve: ({ path }) => new URL(path, BASE).href
				},
				mode,
				silent: true,
				permissions
			});
			await api.viewer;
			await api.math;
			return api;
		};

		it("lets a module read name and length of a function node it may not call, and of slothlet's own functions", async () => {
			const api = await boot();
			try {
				for (const path of ["math.add", "math.multiply", "slothlet.hook.on", "slothlet.lockCaller"]) {
					expect(api.viewer.readable(path, ["name", "length"]), path).toEqual(["name", "length"]);
				}
			} finally {
				await api.shutdown();
			}
		});

		it("logs the root, a node, a function node and the namespace with console.log, as a page console formats them", async () => {
			const api = await boot();
			try {
				for (const path of ["self", "math", "math.add", "slothlet", "slothlet.hook"]) expect(api.viewer.logged(path), path).toBe("logged");
			} finally {
				await api.shutdown();
			}
		});
	});
});
