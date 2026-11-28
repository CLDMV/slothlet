/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/browser/internal-helper.browser.test.mjs
 *	@Date: 2026-11-15T09:00:00-08:00 (1794762000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:50-08:00 (1795869050)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper file an api leaf imports from the module's folder is held to the leaf's rules for slothlet's
 * internal exports in a real browser, where it carries no instance tag.
 *
 * @description
 * Fixture `api_test_browser_internal_helper`:
 * ```
 * api/porter.mjs     viaInside(lib) / viaOutside(lib): have a helper use one of slothlet's internal exports
 * api/__door.mjs     the helper inside the module's folder (left out of the manifest by its `__` prefix)
 * lib/door.mjs       the same helper outside every module's folder
 * ```
 * Each helper imports `factories/context.mjs` by its URL (a browser serves every file) and calls `getContextManager`.
 *
 * Expected values come from the rule in MODULE-STRUCTURE.md ("Using what slothlet's own files export"): a module's code
 * is refused every use with `MODULE_INTERNAL_NOT_IMPORTABLE`, and the page's own code is answered. In a browser a frame
 * is told to be a module's by the instance tag on its URL or by the folder the instance loaded the module's files from,
 * so the helper inside the folder is the module's code. The helper outside every such folder carries nothing that
 * tells it from the page's own code, and is answered as the page's code is (the documented browser limit).
 * @module tests/browser/internal-helper.browser
 */

import { describe, it, expect } from "vitest";
import { helperManifest, helperRel } from "virtual:browser-fixture-manifest";

describe("browser: a helper file an api leaf imports and slothlet's internal exports", () => {
	const lib = new URL("/src/lib/", location.origin).href;
	const BASE = new URL("/" + helperRel + "/", location.origin).href;

	/**
	 * Boot the fixture.
	 * @param {object|undefined} permissions - The permissions config.
	 * @param {string} mode - `"eager"` or `"lazy"`.
	 * @returns {Promise<object>} The api.
	 */
	const boot = async (permissions, mode) => {
		const mod = await import("@cldmv/slothlet");
		const slothlet = mod.default ?? mod.slothlet;
		return slothlet({
			base: BASE,
			loader: {
				platform: "browser",
				files: helperManifest,
				resolve: ({ path }) => new URL(path, BASE).href
			},
			mode,
			permissions
		});
	};

	describe.each([
		{ label: "permissions off", permissions: undefined },
		{ label: "permissions on", permissions: { policy: "allow" } },
		{ label: "permissions disabled", permissions: { mode: "disabled" } }
	])("$label", ({ permissions }) => {
		it.each(["eager", "lazy"])("%s: the helper in the module's folder is refused, the page is answered", async (mode) => {
			const api = await boot(permissions, mode);
			try {
				expect(await api.porter.viaInside(lib)).toBe("MODULE_INTERNAL_NOT_IMPORTABLE");
				// Outside every module's folder nothing tells the helper from the page's own code.
				expect(await api.porter.viaOutside(lib)).toBe("used");
				const context = await import(/* @vite-ignore */ new URL("factories/context.mjs", lib).href);
				expect(context.getContextManager("live").instances.has(api.slothlet.instance.id)).toBe(true);
			} finally {
				await api.shutdown();
			}
		});
	});
});
