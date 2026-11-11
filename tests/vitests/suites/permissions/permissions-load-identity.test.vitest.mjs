/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-load-identity.test.vitest.mjs
 *	@Date: 2026-11-11T11:45:26-08:00 (1794426326)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:14:52-08:00 (1794431692)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a file starts while it loads (a timer, a queue, an async resource, a snapshot of the async
 * context, a helper file's timer) carries the file's module as its caller when it runs later. It never counts as the
 * host's.
 *
 * @description
 * Fixture `api_test_load_identity`. `sup` runs code from machinery it made at the top of its file: a closure `bag`
 * returned (definer `bag.make`), a closure written inside its own leaf (definer `sup.probe`) and code outside every
 * export (definer `sup`). In each case the caller is the module `sup`, and an access is allowed only when the definer
 * and the caller are both allowed.
 *
 * Expected values come from that rule, under three rule sets:
 * - `**` denied the vault, `bag` and `runner` allowed: `sup` is denied, so every route is refused.
 * - only `sup` denied (the module path itself): the caller is denied, so every route is refused.
 * - only `sup.*` denied (the leaves): the caller `sup` is allowed, so `bag`'s closure and the file-level code read the
 *   vault, and the closure written inside `sup.probe` is refused as its definer.
 *
 * `AsyncLocalStorage.snapshot()` and `AsyncResource` carry the async runtime's store. The live runtime keeps no store,
 * so there the code they run is the code of the call that runs them.
 *
 * @module tests/vitests/suites/permissions/permissions-load-identity
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_load_identity/api");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";

const MATRIX = [];
for (const attribution of ["precise", "fast"])
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) MATRIX.push({ name: `${attribution} ${mode}/${runtime}`, attribution, mode, runtime });

/**
 * The rule sets, each with what every route gives under it. `carried` routes ride on Node's async context, which only
 * the async runtime's store is part of: `null` where the live runtime has nothing to carry.
 */
const RULE_SETS = [
	{
		rules: "everything but bag and runner denied",
		list: [
			{ caller: "**", target: "vault.**", effect: "deny" },
			{ caller: "bag.**", target: "vault.**", effect: "allow" },
			{ caller: "runner.**", target: "vault.**", effect: "allow" }
		],
		expected: {
			timerClosure: DENIED,
			timerBoxed: DENIED,
			timerOwn: DENIED,
			timerFile: DENIED,
			nestedClosure: DENIED,
			helperClosure: DENIED
		},
		carried: { async: DENIED, live: DENIED }
	},
	{
		rules: "the module path denied",
		list: [{ caller: "sup", target: "vault.**", effect: "deny" }],
		expected: {
			timerClosure: DENIED,
			timerBoxed: DENIED,
			timerOwn: DENIED,
			timerFile: DENIED,
			nestedClosure: DENIED,
			helperClosure: DENIED
		},
		carried: { async: DENIED, live: null }
	},
	{
		rules: "the module's leaves denied",
		list: [{ caller: "sup.*", target: "vault.**", effect: "deny" }],
		expected: {
			timerClosure: SECRET,
			timerBoxed: SECRET,
			timerOwn: DENIED,
			timerFile: SECRET,
			nestedClosure: SECRET,
			helperClosure: SECRET
		},
		// Run from inside `sup.probe`, so that leaf is a caller as well.
		carried: { async: DENIED, live: DENIED }
	}
];
const ROUTES = ["timerClosure", "timerBoxed", "timerOwn", "timerFile", "nestedClosure", "helperClosure"];

describe.each(MATRIX)("Permissions > what a file starts while it loads runs as its module > $name", ({ attribution, mode, runtime }) => {
	describe.each(RULE_SETS)("$rules", ({ list, expected, carried }) => {
		let api;

		beforeAll(async () => {
			api = await slothlet({ base: DIR, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", attribution, rules: list } });
			// Load every file, so a lazy node answers as an eager one.
			await api.vault.get();
			await api.bag.call(() => 1);
			await api.runner.call(() => 1);
			await api.sup.probe("none");
		});

		afterAll(async () => {
			await api?.shutdown();
		});

		it.each(ROUTES)("%s, while the call that queued it waits", async (route) => {
			expect(await api.sup.probe(route)).toBe(expected[route]);
		});

		it.each(ROUTES)("%s, with no call waiting on it", async (route) => {
			await api.sup.start(route);
			expect(await api.sup.collect()).toBe(expected[route]);
		});

		it.each(["snapshotClosure", "resourceClosure"])("%s", async (route) => {
			const outcome = await api.sup.probe(route);
			if (carried[runtime] !== null) expect(outcome).toBe(carried[runtime]);
			else expect(outcome).toBe(SECRET);
		});
	});
});
