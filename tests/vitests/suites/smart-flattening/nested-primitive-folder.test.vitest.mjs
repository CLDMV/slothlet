/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/nested-primitive-folder.test.vitest.mjs
 *	@Date: 2026-11-15T12:00:00-08:00 (1794772800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T12:00:00-08:00 (1794772800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A folder below the api root holding one file named like it, whose default export is a primitive,
 * loads and reads as that value: `zz/num/num.mjs` with `export default 42` gives `api.zz.num === 42`.
 *
 * @description
 * Every kind of primitive (number, string, boolean, bigint, symbol) one level down, and a number two levels down, in
 * eager and lazy mode, both runtimes and both attributions. The host reads the value; the `reader` module reads it
 * through `self`, and is refused it under a deny on its path. The same holds at the api root (`top/top.mjs` gives
 * `api.top`) and for a `null` or `undefined` default. The expected value is the file's default export imported plainly.
 * @module tests/vitests/suites/smart-flattening/nested-primitive-folder
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_nested_primitive_folder");

const configs = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/** Each member's api path, by the file it comes from. */
const MEMBERS = {
	"zz.num": "zz/num/num.mjs",
	"zz.str": "zz/str/str.mjs",
	"zz.bool": "zz/bool/bool.mjs",
	"zz.big": "zz/big/big.mjs",
	"zz.sym": "zz/sym/sym.mjs",
	"zz.yy.deep": "zz/yy/deep/deep.mjs",
	"zz.nul": "zz/nul/nul.mjs",
	"zz.und": "zz/und/und.mjs",
	top: "top/top.mjs"
};

/**
 * A file's default export, imported plainly.
 * @param {string} file - The file, relative to the fixture.
 * @returns {Promise<*>} Its default export.
 */
async function plain(file) {
	return (await import(`${pathToFileURL(join(FIXTURE, file)).href}?plain-twin`)).default;
}

/**
 * What the reader module reports for a value it read.
 * @param {*} value - The value.
 * @returns {{kind: string, value: *}} The report.
 */
function report(value) {
	return { kind: typeof value, value: typeof value === "symbol" ? value.description : typeof value === "bigint" ? `${value}n` : value };
}

/**
 * Read a member by its dotted path.
 * @param {object} api - The api.
 * @param {string} path - The member's path.
 * @returns {*} What the read gives.
 */
function at(api, path) {
	return path.split(".").reduce((node, key) => node[key], api);
}

describe.each(configs)(
	"a self-named folder below the root whose file's default export is a primitive > $mode / $runtime / $attribution",
	({ mode, runtime, attribution }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		/**
		 * Load the fixture.
		 * @param {Array<object>} [rules=[]] - Permission rules.
		 * @returns {Promise<object>} The api.
		 */
		const load = async (rules = []) => {
			api = await slothlet({ base: FIXTURE, mode, runtime, silent: true, permissions: { attribution, defaultPolicy: "allow", rules } });
			return api;
		};

		it.each(Object.entries(MEMBERS))("reads %s as the file's value, for the host", async (path, file) => {
			const expected = await plain(file);
			await load();
			const awaited = await at(api, path);
			if (mode === "eager") expect(awaited).toBe(expected);
			expect(at(api, path)).toBe(expected);
			expect(typeof at(api, path)).toBe(typeof expected);
		});

		it.each(Object.entries(MEMBERS))("reads %s as the file's value, for a module through self", async (path, file) => {
			const expected = report(await plain(file));
			await load();
			expect(await api.reader.read(path)).toEqual(expected);
		});

		it.each(Object.keys(MEMBERS))("refuses %s to a module the rules deny it, and still gives the host the value", async (path) => {
			const expected = await plain(MEMBERS[path]);
			await load([{ caller: "reader.**", target: path, effect: "deny" }]);
			expect(await api.reader.read(path)).toEqual({ threw: "PERMISSION_DENIED" });
			await at(api, path);
			expect(at(api, path)).toBe(expected);
		});
	}
);
