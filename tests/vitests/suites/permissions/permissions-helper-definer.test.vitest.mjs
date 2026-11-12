/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-helper-definer.test.vitest.mjs
 *	@Date: 2026-11-11T23:56:16-08:00 (1794470176)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T23:56:16-08:00 (1794470176)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper file's own function that a leaf hands out: whose code it is when it runs.
 *
 * @description
 * Fixture `api_test_helper_identity`. A helper file is a file an api file imports that is no api file itself, so it
 * has no leaf. `helpers/shared.mjs` is imported by `alpha.mjs` and `beta.mjs`; `helpers/solo.mjs` by `alpha.mjs`
 * alone. Leaves of both files return the helpers' own functions, as they are or inside plain data, and the host or
 * another module (`runner`) runs them.
 *
 * The rule the expected values come from:
 * - `permissions.attribution: "precise"`: a function a leaf returns comes as a stand-in recording that leaf, so the
 *   helper's function runs as the leaf that handed it out, each leaf with its own answer. Where there is no stand-in
 *   (the function nested in plain data, or handed back into the module, which gets the function itself), only the stack
 *   can say, as under `"fast"`.
 * - `permissions.attribution: "fast"`: nothing is wrapped. The stack names the helper file, which stands for the api
 *   files importing it: with one importer the code runs as that file's module; with several, every importing file's
 *   module has to be allowed.
 * - Run by another module, that module has to be allowed as well (`runner` always is here).
 * - The live runtime tells which call picked up after an `await` from the stack. The helper's async function picking
 *   up inside `runner`'s waiting call is code of the instance that no waiting call imports, which the live runtime
 *   refuses whatever the rules say (PERMISSIONS.md, "Overlapping calls").
 * - With the permission system not on, nothing is refused.
 *
 * @module tests/vitests/suites/permissions/permissions-helper-definer
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_helper_identity/api");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";

const MATRIX = [];
for (const attribution of ["precise", "fast"])
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) MATRIX.push({ name: `${attribution} ${mode}/${runtime}`, attribution, mode, runtime });

/** The api files importing each helper: their modules stand for the helper's code where only the stack can say. */
const IMPORTERS = { shared: ["alpha", "beta"], solo: ["alpha"] };

/**
 * Each way a leaf hands a helper's function out: the leaf, the helper the function is written in, and whether the
 * function is what the leaf returns (a stand-in under "precise") or sits inside plain data it returns.
 */
const ROUTES = [
	{ leaf: "alpha.give", helper: "shared", returned: true },
	{ leaf: "alpha.again", helper: "shared", returned: true },
	{ leaf: "alpha.giveLater", helper: "shared", returned: true, later: true },
	{ leaf: "alpha.box", helper: "shared", returned: false },
	{ leaf: "beta.give", helper: "shared", returned: true },
	{ leaf: "beta.giveLater", helper: "shared", returned: true, later: true },
	{ leaf: "beta.box", helper: "shared", returned: false },
	{ leaf: "alpha.giveSolo", helper: "solo", returned: true },
	{ leaf: "alpha.giveSoloLater", helper: "solo", returned: true, later: true },
	{ leaf: "alpha.boxSolo", helper: "solo", returned: false }
];

/** The rule sets: the rules, and which caller paths they deny the vault. */
const RULE_SETS = [
	{ rules: "nothing denied", list: [], denies: () => false },
	{
		rules: "the leaf alpha.give denied",
		list: [{ caller: "alpha.give", target: "vault.**", effect: "deny" }],
		denies: (caller) => caller === "alpha.give"
	},
	{
		rules: "the module path alpha denied",
		list: [{ caller: "alpha", target: "vault.**", effect: "deny" }],
		denies: (caller) => caller === "alpha"
	},
	{
		rules: "alpha and everything under it denied",
		list: [{ caller: "alpha.**", target: "vault.**", effect: "deny" }],
		denies: (caller) => caller === "alpha" || caller.startsWith("alpha.")
	},
	{
		rules: "the module path beta denied",
		list: [{ caller: "beta", target: "vault.**", effect: "deny" }],
		denies: (caller) => caller === "beta"
	},
	{
		rules: "beta and everything under it denied",
		list: [{ caller: "beta.**", target: "vault.**", effect: "deny" }],
		denies: (caller) => caller === "beta" || caller.startsWith("beta.")
	}
];

/**
 * Who the helper's function runs as on a route.
 * @param {{leaf: string, helper: string, returned: boolean, later?: boolean}} route - The route.
 * @param {string} attribution - `permissions.attribution`.
 * @param {"host"|"runner"} ranBy - Who runs the function.
 * @param {string} runtime - The runtime.
 * @returns {string[]|null} The caller paths that all have to be allowed, or null when the access is refused whatever
 *   the rules say.
 */
function heldTo(route, attribution, ranBy, runtime) {
	if (runtime === "live" && ranBy === "runner" && route.later) return null;
	// The stand-in the host got records the leaf. `runner` is a file of the same module, so it is handed the function
	// itself, and nested in data there is no stand-in: the stack names the helper, which its importers stand for.
	if (attribution === "precise" && route.returned && ranBy === "host") return [route.leaf];
	return ranBy === "runner" ? [...IMPORTERS[route.helper], "runner.call"] : IMPORTERS[route.helper];
}

/**
 * Load every file, so a lazy tree records the same imports an eager one does.
 * @param {object} api - The api.
 * @returns {Promise<void>}
 */
async function loadAll(api) {
	await api.vault.ping();
	await api.runner.call(() => 1);
	await api.alpha.give();
	await api.beta.give();
}

/**
 * Get the function a route hands out.
 * @param {object} api - The api.
 * @param {{leaf: string}} route - The route.
 * @returns {Promise<Function>} The function.
 */
async function handedOut(api, route) {
	const [file, leaf] = route.leaf.split(".");
	const got = await api[file][leaf]();
	return typeof got === "function" ? got : got.run;
}

/**
 * Run a function, giving back what it returns or the code of the error it threw.
 * @param {Function} fn - The function.
 * @returns {Promise<*>} The outcome.
 */
async function settle(fn) {
	try {
		return await fn();
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
}

describe.each(MATRIX)("Permissions > a helper's function a leaf hands out > $name", ({ attribution, mode, runtime }) => {
	describe.each(RULE_SETS)("$rules", ({ list, denies }) => {
		let api;

		beforeAll(async () => {
			api = await slothlet({ base: DIR, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", attribution, rules: list } });
			await loadAll(api);
		});

		afterAll(async () => {
			await api?.shutdown();
		});

		it.each(ROUTES)("$leaf, run by the host", async (route) => {
			const fn = await handedOut(api, route);
			const expected = heldTo(route, attribution, "host", runtime).some(denies) ? DENIED : SECRET;
			expect(await settle(() => fn())).toBe(expected);
		});

		it.each(ROUTES)("$leaf, run by another module", async (route) => {
			const fn = await handedOut(api, route);
			const held = heldTo(route, attribution, "runner", runtime);
			const expected = held === null || held.some(denies) ? DENIED : SECRET;
			expect(await api.runner.call(fn)).toBe(expected);
		});

		it("the helper's function called by a leaf's own code runs as that leaf", async () => {
			expect(await settle(() => api.alpha.own())).toBe(denies("alpha.own") ? DENIED : SECRET);
		});

		it("a leaf hands the same function out as the same value every time", async () => {
			expect(await api.alpha.give()).toBe(await api.alpha.give());
			expect(await api.beta.giveLater()).toBe(await api.beta.giveLater());
		});

		it("a function written in the api file itself is one value from two leaves, and runs as the file's module", async () => {
			const fn = await api.alpha.giveLocal();
			// As in plain JavaScript: both leaves return the same function.
			expect(await api.alpha.giveLocalAgain()).toBe(fn);
			expect(await settle(() => fn())).toBe(denies("alpha") ? DENIED : SECRET);
		});
	});
});

describe.each([
	{ name: "no permissions configured", permissions: undefined },
	{ name: "mode off", permissions: { mode: "off", rules: [{ caller: "**", target: "vault.**", effect: "deny" }] } },
	{ name: "mode disabled", permissions: { mode: "disabled", rules: [{ caller: "**", target: "vault.**", effect: "deny" }] } }
])("Permissions > a helper's function a leaf hands out > the permission system not on ($name)", ({ permissions }) => {
	describe.each(MATRIX.filter(({ attribution }) => attribution === "precise"))("$mode/$runtime", ({ mode, runtime }) => {
		let api;

		beforeAll(async () => {
			api = await slothlet({ base: DIR, mode, runtime, silent: true, ...(permissions ? { permissions } : {}) });
			await loadAll(api);
		});

		afterAll(async () => {
			await api?.shutdown();
		});

		it.each(ROUTES)("$leaf is not refused", async (route) => {
			const fn = await handedOut(api, route);
			expect(await settle(() => fn())).toBe(SECRET);
			expect(await api.runner.call(fn)).toBe(SECRET);
			expect(await settle(() => api.alpha.own())).toBe(SECRET);
		});

		it("a leaf hands the helper's function out as it is", async () => {
			expect(await api.alpha.give()).toBe(await api.beta.give());
		});
	});
});
