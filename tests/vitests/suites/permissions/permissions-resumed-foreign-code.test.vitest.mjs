/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-resumed-foreign-code.test.vitest.mjs
 *	@Date: 2026-11-12T23:34:44-08:00 (1794555284)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T00:01:56-08:00 (1794556916)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Another module's async function that picks up after an `await` inside a waiting call is checked the
 * same way in both runtimes: it runs as its definer, with the call that runs it as its caller, and both have to be
 * allowed. Where the live runtime cannot tell which waiting call ran it, every waiting call has to allow the access.
 *
 * @description
 * Fixture `api_test_resumed_foreign_code`. `alpha` hands out three async functions that read the vault after an
 * `await`: its helper file's function as it is (`giveLater`), the same function inside plain data (`boxLater`), and a
 * function written in `alpha.mjs` inside plain data (`boxOwn`). `runner.call(fn)` runs one and waits for it;
 * `other.hold(gate)` is a call of a third module that waits meanwhile and runs nothing.
 *
 * When the function picks up after its `await`, the job starts in code of `alpha` (or its helper), which the file of
 * no waiting call imports. The async runtime knows the call from its store. The live runtime reads the stack, which
 * shows that a waiting call is awaiting the function but not which call started it, so it holds the access to every
 * waiting call (PERMISSIONS.md, "Overlapping calls").
 *
 * Expected values come from the definer rule (PERMISSIONS.md, "Code a module hands out runs as its definer"):
 *
 * | Rules                      | Definer `alpha` | Runner `runner.call` | `other.hold` waiting | Answer                         |
 * | -------------------------- | --------------- | -------------------- | -------------------- | ------------------------------ |
 * | nothing denied             | allowed         | allowed              | no / yes             | `"SECRET"`                     |
 * | deny `alpha.** → vault.**` | denied          | allowed              | no / yes             | `PERMISSION_DENIED`            |
 * | deny `runner.** → vault.**`| allowed         | denied               | no / yes             | `PERMISSION_DENIED`            |
 * | deny `other.** → vault.**` | allowed         | allowed              | no                   | `"SECRET"`                     |
 * | deny `other.** → vault.**` | allowed         | allowed              | yes                  | async `"SECRET"`, live refused |
 *
 * The last row is the one where the runtimes differ: `other`'s waiting call could be the one that ran the function
 * for all the live runtime's stack says, and it is denied.
 * @module tests/vitests/suites/permissions/permissions-resumed-foreign-code
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_resumed_foreign_code/api");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/**
 * Each rule set, what `runner.call(fn)` answers under it, and what it answers while `other.hold` is waiting where the
 * runtime can only hold the access to every waiting call.
 * @type {Array<{label: string, rules: object[], expected: string, heldToAll: string}>}
 */
const RULE_SETS = [
	{ label: "nothing denied", rules: [], expected: SECRET, heldToAll: SECRET },
	{ label: "the definer denied", rules: [{ caller: "alpha.**", target: "vault.**", effect: "deny" }], expected: DENIED, heldToAll: DENIED },
	{ label: "the runner denied", rules: [{ caller: "runner.**", target: "vault.**", effect: "deny" }], expected: DENIED, heldToAll: DENIED },
	{
		label: "another waiting module denied",
		rules: [{ caller: "other.**", target: "vault.**", effect: "deny" }],
		expected: SECRET,
		heldToAll: DENIED
	}
];

/** The functions `alpha` hands out, by the leaf that hands them out. */
const ROUTES = ["giveLater", "boxLater", "boxOwn"];

describe.each(matrix)(
	"another module's async function picking up inside a waiting call > $mode / $runtime / $attribution",
	({ mode, runtime, attribution }) => {
		describe.each(RULE_SETS)("$label", ({ rules, expected, heldToAll }) => {
			let api;

			afterEach(async () => {
				await api?.shutdown?.();
				api = null;
			});

			/**
			 * Build the instance and load every file, so a lazy tree records the same imports an eager one does.
			 * @returns {Promise<void>}
			 */
			async function open() {
				api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", attribution, rules } });
				await api.vault.get();
				await api.runner.call(() => 1);
				await api.other.call(() => 1);
				await api.alpha.giveLater();
			}

			/**
			 * Get the function a leaf of `alpha` hands out.
			 * @param {string} route - The leaf's name.
			 * @returns {Promise<Function>} The function.
			 */
			async function handedOut(route) {
				const got = await api.alpha[route]();
				return typeof got === "function" ? got : got.run;
			}

			it.each(ROUTES)(`alpha.%s's function run by runner.call answers ${expected}`, async (route) => {
				await open();
				expect(await api.runner.call(await handedOut(route))).toBe(expected);
			});

			it.each(ROUTES)("alpha.%s's function run by runner.call while a call of other is waiting", async (route) => {
				await open();
				const fn = await handedOut(route);
				let release;
				const held = api.other.hold(new Promise((resolve) => (release = resolve)));
				try {
					// The async runtime knows `runner.call` ran it. The live runtime holds it to `other.hold` as well.
					expect(await api.runner.call(fn)).toBe(runtime === "live" ? heldToAll : expected);
				} finally {
					release();
					await held;
				}
				// With `other`'s call settled, only `runner.call` is waiting when the function picks up.
				expect(await api.runner.call(fn)).toBe(expected);
			});
		});
	}
);

describe.each(["eager", "lazy"].flatMap((mode) => ["precise", "fast"].map((attribution) => ({ mode, attribution }))))(
	"the live runtime answers as the async runtime where every waiting call is allowed > $mode / $attribution",
	({ mode, attribution }) => {
		/**
		 * Every route's answer under one runtime, with and without a call of `other` waiting.
		 * @param {string} runtime - The runtime.
		 * @param {object[]} rules - The rules.
		 * @returns {Promise<string[]>} The answers.
		 */
		async function answers(runtime, rules) {
			const api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", attribution, rules } });
			try {
				await api.vault.get();
				await api.runner.call(() => 1);
				await api.other.call(() => 1);
				const got = [];
				for (const route of ROUTES) {
					const handed = await api.alpha[route]();
					const fn = typeof handed === "function" ? handed : handed.run;
					got.push(await api.runner.call(fn));
					let release;
					const held = api.other.hold(new Promise((resolve) => (release = resolve)));
					got.push(await api.runner.call(fn));
					release();
					await held;
				}
				return got;
			} finally {
				await api.shutdown();
			}
		}

		it.each(RULE_SETS.filter(({ expected, heldToAll }) => expected === heldToAll))("$label", async ({ rules, expected }) => {
			const live = await answers("live", rules);
			expect(live).toEqual(await answers("async", rules));
			expect(live).toEqual(ROUTES.flatMap(() => [expected, expected]));
		});
	}
);
