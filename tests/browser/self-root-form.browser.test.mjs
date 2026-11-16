/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/self-root-form.browser.test.mjs
 *	@Date: 2026-11-15T17:25:18-08:00 (1794792318)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T18:55:20-08:00 (1794797720)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview In a browser, a module's `self` takes the form the page's `api` takes (#803): callable for a function
 * root, an object for an object root. Each operation is run on `self` inside a module and on `api` on the page, and
 * the answers are compared row by row (see `api_tests/api_test_self_parity/shape.mjs`), the full serialization left
 * out as in the Node suite (runtime/self-root-form).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { selfFnManifest, selfFnRel, selfObjManifest, selfObjRel } from "virtual:browser-fixture-manifest";
import { shape } from "../../api_tests/api_test_self_parity/host/shape.mjs";

/**
 * Boot an instance in browser mode over a served fixture folder.
 * @param {string} rel - The folder, relative to the server root.
 * @param {object} manifest - Its manifest.
 * @param {object|undefined} permissions - The permissions config.
 * @param {string} mode - "eager" or "lazy".
 * @returns {Promise<object>} The api.
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
 * A report without the full serialization.
 * @param {Record<string, *>} rows - The report.
 * @returns {Record<string, *>} The report, without `jsonFullKind`.
 */
const comparable = ({ jsonFullKind: _, ...rows }) => rows;

describe.each(["eager", "lazy"])("browser: a module's self takes the api root's form > %s", (mode) => {
	describe.each([
		{ label: "a function root", rel: selfFnRel, manifest: selfFnManifest, typeof: "function" },
		{ label: "an object root", rel: selfObjRel, manifest: selfObjManifest, typeof: "object" }
	])("$label", (root) => {
		describe.each([
			{ label: "permissions off", permissions: undefined },
			{ label: "permissions on", permissions: { defaultPolicy: "allow" } },
			{ label: "permissions disabled", permissions: { mode: "disabled" } }
		])("$label", ({ permissions }) => {
			let api;

			beforeAll(async () => {
				api = await boot(root.rel, root.manifest, permissions, mode);
			});

			afterAll(async () => {
				await api?.shutdown?.();
				api = null;
			});

			it("self answers every operation as the page's api does", async () => {
				const rows = comparable(await api.probe.report());
				expect(rows).toEqual(comparable(shape(api)));
				expect(rows.typeof).toBe(root.typeof);
				expect(rows.mathAdd).toBe(5);
			});
		});
	});
});
