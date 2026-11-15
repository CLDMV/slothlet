/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/root-function.browser.test.mjs
 *	@Date: 2026-11-15T16:00:00-08:00 (1794787200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T16:00:00-08:00 (1794787200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Browser: a callable api root in a page. The root function's own data member is read under its rules by
 * every route back to the function (`self.prototype.constructor`, a description of it), and the root's own code reads
 * as the api root, whoever calls it.
 * @module tests/browser/root-function
 */

import { describe, it, expect } from "vitest";
import { routesManifest, routesRel, rootLeafManifest, rootLeafRel } from "virtual:browser-fixture-manifest";
import plainRoot from "../../api_tests/api_test_function_member_routes/base/root.mjs";
import { routes } from "../../api_tests/api_test_function_member_routes/lib/routes.mjs";

const DENIED = "threw:PERMISSION_DENIED";
/** The routes that construct the node: the api root is no constructor to a module (`self` is no function). */
const CONSTRUCTING = ["instance", "instanceUsed", "instancePrototype"];

/**
 * Boot a fixture folder served by the page.
 * @param {string} rel - The folder, relative to the repo.
 * @param {object} manifest - Its manifest.
 * @param {object|undefined} permissions - The permissions config.
 * @param {string} mode - `"eager"` or `"lazy"`.
 * @returns {Promise<Function>} The api.
 */
const boot = async (rel, manifest, permissions, mode) => {
	const base = new URL("/" + rel + "/", location.origin).href;
	const mod = await import("@cldmv/slothlet");
	const slothlet = mod.default ?? mod.slothlet;
	return slothlet({
		platform: "browser",
		base,
		manifest,
		resolveModuleSpecifier: ({ path }) => new URL(path, base).href,
		mode,
		permissions
	});
};

/**
 * The routes a module's read of the root answers, without the constructing ones.
 * @param {Record<string, string>} answered - What the routes answered.
 * @returns {Record<string, string>} The same, less the constructing routes.
 */
const readRoutes = (answered) => Object.fromEntries(Object.entries(answered).filter(([key]) => !CONSTRUCTING.includes(key)));

const PLAIN = readRoutes(routes(plainRoot));
const REFUSED = {
	...Object.fromEntries(Object.keys(PLAIN).map((key) => [key, DENIED])),
	constructorDescribesTag: "undefined",
	constructorListsTag: "false",
	constructorEntries: "undefined",
	prototypeChain: PLAIN.prototypeChain
};

describe("browser: a callable api root", () => {
	describe.each([
		{ label: "permissions off", permissions: undefined, expected: PLAIN },
		{ label: "permissions on, nothing refused", permissions: { defaultPolicy: "allow" }, expected: PLAIN },
		{
			label: "the reader refused the root's own member",
			permissions: { rules: [{ caller: "reader.**", target: "tag", effect: "deny" }] },
			expected: REFUSED
		},
		{ label: "permissions disabled", permissions: { mode: "disabled" }, expected: PLAIN }
	])("$label", ({ permissions, expected }) => {
		it.each(["eager", "lazy"])("%s: the root's own member answers by every route as a direct read does", async (mode) => {
			const api = await boot(routesRel, routesManifest, permissions, mode);
			try {
				expect(readRoutes(await api.reader.at(""))).toEqual(expected);
				expect(api.prototype.constructor.tag).toBe("TAG");
			} finally {
				await api.shutdown();
			}
		});
	});

	describe.each([
		{ label: "permissions off", permissions: undefined, host: "SECRET", callRoot: "SECRET" },
		{
			label: "the reader denied the vault",
			permissions: { rules: [{ caller: "reader.**", target: "vault.**", effect: "deny" }] },
			host: "SECRET",
			callRoot: "SECRET"
		},
		{
			label: "every caller denied the vault",
			permissions: { rules: [{ caller: "**", target: "vault.**", effect: "deny" }] },
			host: DENIED,
			callRoot: DENIED
		}
	])("the root's own code, $label", ({ permissions, host, callRoot }) => {
		it.each(["eager", "lazy"])("%s: reads as the api root, whoever calls it", async (mode) => {
			const api = await boot(rootLeafRel, rootLeafManifest, permissions, mode);
			try {
				expect(await api()).toBe(host);
				expect(await api.reader.callRoot()).toBe(callRoot);
			} finally {
				await api.shutdown();
			}
		});
	});
});
