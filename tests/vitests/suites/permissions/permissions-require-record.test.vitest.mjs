/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-require-record.test.vitest.mjs
 *	@Date: 2026-11-12T23:09:13-08:00 (1794553753)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T23:09:13-08:00 (1794553753)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Every api file that requires a CommonJS helper is recorded as loading it, whichever required it first.
 *
 * @description
 * Fixture `api_test_helper_copies`. `helpers/tally.cjs` is imported by `one.mjs` and `two.mjs` and required by the
 * CommonJS api files `three.cjs` and `four.cjs`, both from the same folder and by the same specifier. Its `read()`
 * reads the vault and is the helper's own function.
 *
 * The rule the expected values come from (docs/PERMISSIONS.md, docs/CONFIGURATION.md `helpers`): a CommonJS helper's
 * own code, where only the stack can say whose it is, is held to the module of every api file loading the helper.
 * Denying any one of the four refuses it, the second CommonJS file to require it as much as the first; with none
 * denied it reads the vault.
 *
 * @module tests/vitests/suites/permissions/permissions-require-record
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_helper_copies/api");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";

const MATRIX = [];
for (const attribution of ["precise", "fast"])
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) MATRIX.push({ name: `${attribution} ${mode}/${runtime}`, attribution, mode, runtime });

/** The api files loading the helper. */
const LOADERS = ["one", "two", "three", "four"];

/** The rule sets: nothing denied, then each loading api file's module denied the vault in turn. */
const RULE_SETS = [
	{ rules: "nothing denied", list: [], expected: SECRET },
	...LOADERS.map((file) => ({
		rules: `the module path ${file} denied`,
		list: [{ caller: file, target: "vault.**", effect: "deny" }],
		expected: DENIED
	}))
];

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

describe.each(MATRIX)("Permissions > every api file requiring a CommonJS helper > $name", ({ attribution, mode, runtime }) => {
	describe.each(["instance", "module"])('helpers: "%s"', (helpers) => {
		describe.each(RULE_SETS)("$rules", ({ list, expected }) => {
			let api;

			beforeAll(async () => {
				api = await slothlet({
					base: DIR,
					mode,
					runtime,
					helpers,
					silent: true,
					permissions: { defaultPolicy: "allow", attribution, rules: list }
				});
				for (const file of LOADERS) await api[file].bumpCjs();
			});

			afterAll(async () => {
				await api?.shutdown();
			});

			it.each(["one", "two"])("the helper's own function %s hands out inside data", async (file) => {
				const { run } = await api[file].boxCjs();
				expect(await settle(() => run())).toBe(expected);
			});
		});
	});
});
