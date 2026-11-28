/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/browser/root-function.browser.test.mjs
 *	@Date: 2026-11-15T14:53:28-08:00 (1794783208)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:53-08:00 (1795869053)
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
import plainRoot from "../../api_tests/api_test_function_member_routes/api/root.mjs";
import { routes } from "../../api_tests/api_test_function_member_routes/lib/routes.mjs";

const DENIED = "threw:PERMISSION_DENIED";

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
		base,
		loader: {
			platform: "browser",
			files: manifest,
			resolve: ({ path }) => new URL(path, base).href
		},
		mode,
		permissions
	});
};

const PLAIN = routes(plainRoot);
const REFUSED = {
	...Object.fromEntries(Object.keys(PLAIN).map((key) => [key, DENIED])),
	constructorDescribesTag: "undefined",
	constructorListsTag: "false",
	constructorEntries: "undefined",
	prototypeChain: PLAIN.prototypeChain,
	instanceUsed: PLAIN.instanceUsed
};

describe("browser: a callable api root", () => {
	describe.each([
		{ label: "permissions off", permissions: undefined, expected: PLAIN },
		{ label: "permissions on, nothing refused", permissions: { policy: "allow" }, expected: PLAIN },
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
				expect(await api.reader.at("")).toEqual(expected);
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
