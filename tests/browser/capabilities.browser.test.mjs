/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/capabilities.browser.test.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:55-08:00 (1794882535)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `capability:code` in a real headless browser: the function constructors by every route to them and a
 * string given to `setTimeout` / `setInterval` are refused to module code by default while the permission system is on,
 * opened by a rule for exactly the leaf it names, and never refused to the host or with the system off.
 * @module tests/browser/capabilities.browser
 */

import { describe, it, expect } from "vitest";
// Node-built (filesystem) fixture manifest, injected by the browser config.
import { codeStringsManifest, codeStringsRel } from "virtual:browser-fixture-manifest";
import { routes } from "../../api_tests/api_test_code_strings_browser/routes.mjs";

const ROUTES = Object.keys(routes);

/**
 * The same routes written in this file, run as the host: a file inside the fixture's folder is the module's code in a
 * browser, which places files by their folder.
 * @type {Record<string, function(): *>}
 */
const HOST_ROUTES = {
	Function: () => Function("return 7")(),
	newFunction: () => new Function("return 7")(),
	functionConstructor: () => function () {}.constructor("return 7")(),
	functionPrototypeConstructor: () => Function.prototype.constructor("return 7")(),
	asyncFunction: () => (async () => {}).constructor("return 7")(),
	generatorFunction: () =>
		Object.getPrototypeOf(function* () {})
			.constructor("yield 7")()
			.next().value,
	asyncGeneratorFunction: async () =>
		(
			await Object.getPrototypeOf(async function* () {})
				.constructor("yield 7")()
				.next()
		).value,
	reflectConstruct: () => Reflect.construct(Function, ["return 7"])(),
	subclass: () => new (class extends Function {})("return 7")(),
	bound: () => Function.bind(null, "return 7")()(),
	stringTimeout: () => hostStringTimer(setTimeout),
	stringInterval: () => hostStringTimer(setInterval)
};

/**
 * Run a string timer as the host.
 * @param {Function} schedule - `setTimeout` or `setInterval`.
 * @returns {Promise<number>} 7.
 */
function hostStringTimer(schedule) {
	return new Promise((resolve) => {
		let id;
		globalThis.__slothletCodeStringsHostTimer = (value) => {
			clearInterval(id);
			resolve(value);
		};
		id = schedule("globalThis.__slothletCodeStringsHostTimer(7)", 0);
	});
}
const OPEN = { caller: "**", target: "**", effect: "allow" };
const REFUSED = { ok: false, code: "PERMISSION_CAPABILITY_REFUSED" };

/**
 * Run a route as the host.
 * @param {string} route - The route.
 * @returns {Promise<{ok: boolean, value?: *, code?: string}>} The outcome.
 */
async function hostAttempt(route) {
	try {
		return { ok: true, value: await HOST_ROUTES[route]() };
	} catch (error) {
		return { ok: false, code: error?.code ?? error?.name ?? String(error) };
	}
}

/**
 * Every route's outcome through a leaf.
 * @param {Function} leaf - The leaf.
 * @returns {Promise<Record<string, object>>} The outcomes.
 */
async function tryAll(leaf) {
	const outcomes = {};
	for (const route of ROUTES) outcomes[route] = await leaf(route);
	return outcomes;
}

const PLAIN = Object.fromEntries(ROUTES.map((route) => [route, { ok: true, value: 7 }]));
const ALL_REFUSED = Object.fromEntries(ROUTES.map((route) => [route, REFUSED]));

describe.each(["eager", "lazy"])("built-in capabilities in a browser > %s", (mode) => {
	/**
	 * A browser-mode api over the fixture.
	 * @param {object} permissions - The permission settings.
	 * @returns {Promise<object>} The api.
	 */
	const boot = async (permissions) => {
		const mod = await import("@cldmv/slothlet");
		const slothlet = mod.default ?? mod.slothlet;
		const BASE = new URL("/" + codeStringsRel + "/", location.origin).href;
		const api = await slothlet({
			base: BASE,
			loader: {
				platform: "browser",
				files: codeStringsManifest,
				resolve: ({ path }) => new URL(path, BASE).href
			},
			mode,
			silent: true,
			permissions
		});
		await api.coder;
		return api;
	};

	it("refuses module code every route by default, under a rule allowing everything; the host runs each", async () => {
		const api = await boot({ policy: "deny", rules: [OPEN] });
		try {
			expect(await tryAll(api.coder.probe.attempt)).toEqual(ALL_REFUSED);
			const host = {};
			for (const route of ROUTES) host[route] = await hostAttempt(route);
			expect(host).toEqual(PLAIN);
		} finally {
			await api.shutdown();
		}
	});

	it("opens it for exactly the leaf a rule names", async () => {
		const api = await boot({
			policy: "deny",
			rules: [OPEN, { caller: "coder.probe.attempt", target: "capability:code", effect: "allow" }]
		});
		try {
			expect(await tryAll(api.coder.probe.attempt)).toEqual(PLAIN);
			expect(await tryAll(api.coder.probe.attemptToo)).toEqual(ALL_REFUSED);
		} finally {
			await api.shutdown();
		}
	});

	it("refuses nothing with the permission system off", async () => {
		const api = await boot({ mode: "off", rules: [OPEN] });
		try {
			expect(await tryAll(api.coder.probe.attempt)).toEqual(PLAIN);
		} finally {
			await api.shutdown();
		}
	});
});
