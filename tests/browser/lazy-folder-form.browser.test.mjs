/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/lazy-folder-form.browser.test.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:05-08:00 (1794882485)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A loaded lazy folder node has eager's form in a real headless browser (#811).
 *
 * @description
 * Once a lazy folder node holding no function has loaded, `typeof` is `"object"`, `Object.prototype.toString` reads
 * `[object Object]`, `Function.prototype.toString` refuses it and calling it throws a `TypeError`, as the same node of
 * an eager instance does. Permissions off and on.
 * @module tests/browser/lazy-folder-form.browser
 */

import { describe, it, expect } from "vitest";
// Node-built (filesystem) fixture manifest, injected by the browser config.
import { manifest, fixtureRel } from "virtual:browser-fixture-manifest";

/**
 * A browser-mode api over the fixture, with the folders loaded.
 * @param {string} mode - `"eager"` or `"lazy"`.
 * @param {object} [permissions] - The permissions config.
 * @returns {Promise<object>} A bound browser-mode api.
 */
const boot = async (mode, permissions) => {
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
		...(permissions ? { permissions } : {})
	});
	await api.advanced;
	await api.utils;
	await api.math;
	return api;
};

/**
 * What the language tells of a value's form.
 * @param {*} node - The value.
 * @returns {Record<string, *>} Its form.
 */
const formOf = (node) => {
	const form = { typeof: typeof node, tag: Object.prototype.toString.call(node), keys: Object.keys(node) };
	try {
		Function.prototype.toString.call(node);
		form.functionSource = true;
	} catch (error) {
		form.functionSource = error.constructor.name;
	}
	if (typeof node !== "function") {
		try {
			node();
		} catch (error) {
			form.call = error.constructor.name;
		}
	}
	return form;
};

describe.each([
	["permissions off", undefined],
	["permissions on", { policy: "allow" }]
])("a loaded lazy folder node's form in a browser > %s", (_label, permissions) => {
	it("matches the eager node", async () => {
		const lazy = await boot("lazy", permissions);
		const eager = await boot("eager", permissions);
		try {
			for (const path of ["advanced", "utils", "math"]) {
				expect(formOf(lazy[path]), path).toEqual(formOf(eager[path]));
				expect(typeof lazy[path], path).toBe("object");
			}
		} finally {
			await lazy.shutdown();
			await eager.shutdown();
		}
	});
});
