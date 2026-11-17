/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/module-discovery.browser.test.mjs
 *	@Date: 2026-11-15T20:38:46-08:00 (1794803926)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:06-08:00 (1794882486)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module discovery in a real headless browser (#817).
 *
 * @description
 * `api.slothlet.api.modules.discover()` walks the filesystem for module packages, which a browser does not have. In a
 * browser it, and every call that runs it (`addDiscovered()`, and `addModule(name)` with an empty discovery cache), is
 * refused with `MODULE_DISCOVERY_REQUIRES_NODE` instead of failing on a missing Node builtin.
 *
 * @module tests/browser/module-discovery.browser
 */

import { describe, it, expect } from "vitest";
// Node-built (filesystem) fixture manifest, injected by the browser config.
import { manifest, fixtureRel } from "virtual:browser-fixture-manifest";

/**
 * Compose the browser fixture in browser mode.
 * @param {string} mode - "eager" or "lazy".
 * @returns {Promise<object>} A bound browser-mode api.
 */
const build = async (mode) => {
	const mod = await import("@cldmv/slothlet");
	const slothlet = mod.default ?? mod.slothlet;
	const BASE = new URL("/" + fixtureRel + "/", location.origin).href;
	return slothlet({
		base: BASE,
		loader: {
			platform: "browser",
			files: manifest,
			resolve: ({ path }) => new URL(path, BASE).href
		},
		silent: true,
		mode
	});
};

/**
 * The code a rejected promise carries, or "resolved".
 * @param {Promise<unknown>} promise - The promise.
 * @returns {Promise<string>} The error's code.
 */
const codeOf = (promise) =>
	promise.then(
		() => "resolved",
		(error) => error?.code ?? String(error)
	);

describe("module discovery in a real browser (#817)", () => {
	it.each(["eager", "lazy"])("refuses discover, addDiscovered and a lazy addModule by name with a named error (%s)", async (mode) => {
		const api = await build(mode);
		try {
			const modules = api.slothlet.api.modules;
			expect(await codeOf(modules.discover())).toBe("MODULE_DISCOVERY_REQUIRES_NODE");
			expect(await codeOf(modules.addDiscovered())).toBe("MODULE_DISCOVERY_REQUIRES_NODE");
			expect(await codeOf(modules.addModule("@example/some-module"))).toBe("MODULE_DISCOVERY_REQUIRES_NODE");
			// The instance keeps working.
			expect(await api.math.add(2, 3)).toBe(5);
		} finally {
			await api.shutdown();
		}
	});
});
