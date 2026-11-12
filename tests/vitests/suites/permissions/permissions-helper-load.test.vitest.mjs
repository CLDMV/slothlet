/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-helper-load.test.vitest.mjs
 *	@Date: 2026-11-11T23:57:40-08:00 (1794470260)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T23:57:40-08:00 (1794470260)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a helper file starts when it loads (a timer, a job queue): who it runs as when several api files
 * import the helper.
 *
 * @description
 * Fixture `api_test_helper_identity`. `helpers/shared.mjs` is imported by `alpha.mjs` and `beta.mjs`;
 * `helpers/solo.mjs` by `alpha.mjs` alone. Each helper starts a job queue at its top level. A helper file is loaded
 * once per instance, inside the load of whichever api file imports it first.
 *
 * The rule the expected values come from: what a helper file starts at its top level is held to the module of every
 * api file that imports the helper, whichever of them loaded it; with one importer that is that file's module. The
 * code doing the access is still read as its definer (the helper's own code has none but those modules; a closure
 * written inside a leaf has that leaf), and all of them have to be allowed. It is the same in both runtimes, in eager
 * and lazy mode and under both `permissions.attribution` values. With the permission system not on, nothing is
 * refused.
 *
 * @module tests/vitests/suites/permissions/permissions-helper-load
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

/** Each route: the leaf that queues the job, and every caller path the job's read of the vault is held to. */
const ROUTES = [
	// The helper's own code reads the vault, from the queue the shared helper started: both importers' modules.
	{ leaf: "alpha.viaQueue", heldTo: ["alpha", "beta"] },
	{ leaf: "beta.viaQueue", heldTo: ["alpha", "beta"] },
	// The same from the helper only alpha.mjs imports: that file's module.
	{ leaf: "alpha.viaSoloQueue", heldTo: ["alpha"] },
	// A closure written inside a leaf reads the vault, run from the helper's queue: its definer, and the importers.
	{ leaf: "alpha.viaQueueOwn", heldTo: ["alpha.viaQueueOwn", "alpha", "beta"] },
	{ leaf: "alpha.viaSoloQueueOwn", heldTo: ["alpha.viaSoloQueueOwn", "alpha"] }
];

/** The rule sets: the rules, and which caller paths they deny the vault. */
const RULE_SETS = [
	{ rules: "nothing denied", list: [], denies: () => false },
	{
		rules: "the module path alpha denied",
		list: [{ caller: "alpha", target: "vault.**", effect: "deny" }],
		denies: (caller) => caller === "alpha"
	},
	{
		rules: "alpha's leaves denied",
		list: [{ caller: "alpha.*", target: "vault.**", effect: "deny" }],
		denies: (caller) => /^alpha\.[^.]+$/.test(caller)
	},
	{
		rules: "the module path beta denied",
		list: [{ caller: "beta", target: "vault.**", effect: "deny" }],
		denies: (caller) => caller === "beta"
	},
	{
		rules: "beta's leaves denied",
		list: [{ caller: "beta.*", target: "vault.**", effect: "deny" }],
		denies: (caller) => /^beta\.[^.]+$/.test(caller)
	},
	{
		rules: "beta and everything under it denied",
		list: [{ caller: "beta.**", target: "vault.**", effect: "deny" }],
		denies: (caller) => caller === "beta" || caller.startsWith("beta.")
	}
];

/**
 * Load every file, so a lazy tree records the same imports an eager one does.
 * @param {object} api - The api.
 * @returns {Promise<void>}
 */
async function loadAll(api) {
	await api.vault.ping();
	await api.alpha.give();
	await api.beta.give();
}

/**
 * Run a route.
 * @param {object} api - The api.
 * @param {{leaf: string}} route - The route.
 * @returns {Promise<string>} What the queued job's read of the vault gave.
 */
function run(api, route) {
	const [file, leaf] = route.leaf.split(".");
	return api[file][leaf]();
}

describe.each(MATRIX)("Permissions > what a helper file starts when it loads > $name", ({ attribution, mode, runtime }) => {
	describe.each(RULE_SETS)("$rules", ({ list, denies }) => {
		let api;

		beforeAll(async () => {
			api = await slothlet({ base: DIR, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", attribution, rules: list } });
			await loadAll(api);
		});

		afterAll(async () => {
			await api?.shutdown();
		});

		it.each(ROUTES)("$leaf is held to $heldTo", async (route) => {
			expect(await run(api, route)).toBe(route.heldTo.some(denies) ? DENIED : SECRET);
		});
	});
});

describe.each([
	{ name: "no permissions configured", permissions: undefined },
	{ name: "mode off", permissions: { mode: "off", rules: [{ caller: "**", target: "vault.**", effect: "deny" }] } },
	{ name: "mode disabled", permissions: { mode: "disabled", rules: [{ caller: "**", target: "vault.**", effect: "deny" }] } }
])("Permissions > what a helper file starts when it loads > the permission system not on ($name)", ({ permissions }) => {
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
			expect(await run(api, route)).toBe(SECRET);
		});
	});
});
