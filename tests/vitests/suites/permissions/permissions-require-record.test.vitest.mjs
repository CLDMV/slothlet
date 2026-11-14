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
 * Fixture `api_test_plain_require`: the api files `five.mjs` and `six.mjs`, of one folder, each require
 * `helpers/plain.cjs` through a `require` made from their own plain path (`createRequire(fileURLToPath(import.meta.url))`),
 * which loads the helper once per process; Node answers the second file's require, and every later instance's, from
 * its own caches. Each file's `read()` runs the helper's `read()` inside its own call. A helper both files load is
 * each one's own code inside its own call (docs/PERMISSIONS.md: a module calling a helper it shares with another is
 * still itself), so only the file whose module is denied is refused. The expected values are what the same two files
 * give when Node's caches cannot answer for the second (each in a folder of its own), where both requires reach the
 * resolve hook.
 *
 * @module tests/vitests/suites/permissions/permissions-require-record
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import slothlet from "@cldmv/slothlet";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_helper_copies/api");
const PLAIN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_plain_require/api");
const PLAIN_HELPER = path.resolve(PLAIN_DIR, "../helpers/plain.cjs");
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

/** The api files requiring the helper through a `require` made from a plain path. */
const PLAIN_LOADERS = ["five", "six"];

/** The rule sets for them: nothing denied, then each one's module denied the vault in turn. */
const PLAIN_RULE_SETS = [
	{ rules: "nothing denied", list: [], denied: null },
	...PLAIN_LOADERS.map((file) => ({
		rules: `the module path ${file} denied`,
		list: [{ caller: `${file}.**`, target: "vault.**", effect: "deny" }],
		denied: file
	}))
];

describe.each(MATRIX)("Permissions > every api file requiring a helper from a plain path > $name", ({ attribution, mode, runtime }) => {
	describe.each(["instance", "module"])('helpers: "%s"', (helpers) => {
		describe.each(PLAIN_RULE_SETS)("$rules", ({ list, denied }) => {
			let api;

			beforeAll(async () => {
				api = await slothlet({
					base: PLAIN_DIR,
					mode,
					runtime,
					helpers,
					silent: true,
					permissions: { defaultPolicy: "allow", attribution, rules: list }
				});
				for (const file of PLAIN_LOADERS) await api[file].bump();
			});

			afterAll(async () => {
				await api?.shutdown();
			});

			it.each(PLAIN_LOADERS)("the helper's own function read inside the call of %s", async (file) => {
				expect(await settle(() => api[file].read())).toBe(file === denied ? DENIED : SECRET);
			});
		});
	});
});

describe.each(MATRIX.filter((config) => config.attribution === "precise"))(
	"Permissions > a helper required from a plain path stays one module of the process > $mode/$runtime",
	({ mode, runtime }) => {
		let api;

		beforeAll(async () => {
			api = await slothlet({ base: PLAIN_DIR, mode, runtime, silent: true });
		});

		afterAll(async () => {
			await api?.shutdown();
		});

		it("every require of it, the host's included, gets the one module", async () => {
			const helper = createRequire(import.meta.url)(PLAIN_HELPER);
			const start = helper.bump();
			expect(await api.five.bump()).toBe(start + 1);
			expect(await api.six.bump()).toBe(start + 2);
			expect(await api.five.bump()).toBe(start + 3);
			expect(helper.bump()).toBe(start + 4);
		});

		it.each(PLAIN_LOADERS)("require.resolve() in %s names the helper's file", async (file) => {
			expect(await api[file].where()).toBe(PLAIN_HELPER);
		});
	}
);
