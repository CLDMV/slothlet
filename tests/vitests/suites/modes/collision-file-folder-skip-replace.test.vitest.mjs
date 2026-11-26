/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modes/collision-file-folder-skip-replace.test.vitest.mjs
 *	@Date: 2026-11-25T12:37:27-08:00 (1795639047)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T13:17:57-08:00 (1795641477)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file and a same-named folder, neither with a default export, composed under `skip`,
 * `replace` and `error` in every mode.
 *
 * @description
 * Files load before directories, so the file is the first-loaded source. The documented collision
 * table (docs/migration/v2-to-v3.md, O03/O04/O06) leaves only one side standing for `skip` and
 * `replace`, with nothing merged in from the other:
 *
 *   api_test_file_folder_merge/
 *   ├── math.mjs           version="file", inner={ a:"file" }, add()      ← loads first
 *   ├── math/
 *   │   ├── math.mjs       version="dir",  inner={ a:"dir", b:"dir" }     ← multi-file folder
 *   │   └── extra.mjs      extra()
 *   ├── calc.mjs           same as math.mjs
 *   ├── calc/calc.mjs      same as math/math.mjs                          ← single-file folder
 *   └── group/
 *       ├── stats.mjs      same as math.mjs                               ← nested one level down
 *       └── stats/{stats,extra}.mjs
 *
 * skip (only the first: the file):
 *   api.math.version → "file"   api.math.inner → { a:"file" }   api.math.add() → "file-add"   api.math.extra → undefined
 *
 * replace (only the second: the folder):
 *   api.math.version → "dir"    api.math.inner → { a:"dir", b:"dir" }   api.math.add → undefined   api.math.extra() → "dir-extra"
 *
 * error: the build throws COLLISION_ERROR.
 *
 * `merge`, `warn` and `merge-replace` are covered by collision-file-folder-merge-no-default.test.vitest.mjs.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_file_folder_merge", import.meta.url).pathname;

const CONFIGS = [];
for (const mode of ["eager", "lazy"]) {
	for (const runtime of ["async", "live"]) {
		for (const permissions of ["off", "on"]) {
			CONFIGS.push({
				name: `${mode}/${runtime}/permissions ${permissions}`,
				config: { mode, runtime, ...(permissions === "on" ? { permissions: { mode: "on" } } : {}) }
			});
		}
	}
}

/**
 * The slots under test: where each collision composes, and whether its folder carries a sibling file.
 * @type {Array<{ label: string, path: string[], hasExtra: boolean }>}
 */
const SLOTS = [
	{ label: "multi-file folder", path: ["math"], hasExtra: true },
	{ label: "single-file folder", path: ["calc"], hasExtra: false },
	{ label: "nested multi-file folder", path: ["group", "stats"], hasExtra: true }
];

/**
 * Read a slot by path, awaiting each step so a lazy node has loaded.
 * @param {object} api - The composed api.
 * @param {string[]} path - Segments to the slot.
 * @returns {Promise<object>} The slot.
 */
const readSlot = async (api, path) => {
	let node = api;
	for (const segment of path) node = await node[segment];
	return node;
};

/**
 * Read everything the assertions need off one slot. A member that is absent reads as `undefined`.
 * @param {object} api - The composed api.
 * @param {string[]} path - Segments to the slot.
 * @returns {Promise<object>} The observed surface.
 */
const observe = async (api, path) => {
	const slot = await readSlot(api, path);
	const inner = await slot.inner;
	const add = await slot.add;
	const extra = await slot.extra;
	return {
		version: await slot.version,
		a: await inner.a,
		b: await inner.b,
		add: typeof add === "function" ? await add() : add,
		extra: typeof extra === "function" ? await extra() : extra,
		// Read again once every member above has loaded, so a lazy surface is settled.
		keys: Object.keys(await readSlot(api, path)).sort(),
		innerKeys: Object.keys(await (await readSlot(api, path)).inner).sort()
	};
};

describe("Modes > file + same-named folder with no default export (skip / replace / error)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	describe.each(CONFIGS)("$name", ({ config }) => {
		for (const { label, path } of SLOTS) {
			it(`skip: only the file (first loaded) stands, nothing of the folder is added (${label})`, async () => {
				api = await slothlet({ ...config, base: BASE, silent: true, api: { collision: "skip" } });

				expect(await observe(api, path)).toEqual({
					version: "file",
					a: "file",
					b: undefined,
					add: "file-add",
					extra: undefined,
					keys: ["add", "inner", "version"],
					innerKeys: ["a"]
				});
			});
		}

		for (const { label, path, hasExtra } of SLOTS) {
			it(`replace: only the folder (second loaded) stands, nothing of the file is kept (${label})`, async () => {
				api = await slothlet({ ...config, base: BASE, silent: true, api: { collision: "replace" } });

				expect(await observe(api, path)).toEqual({
					version: "dir",
					a: "dir",
					b: "dir",
					add: undefined,
					extra: hasExtra ? "dir-extra" : undefined,
					keys: hasExtra ? ["extra", "inner", "version"] : ["inner", "version"],
					innerKeys: ["a", "b"]
				});
			});
		}

		it("error: the file/folder collision throws COLLISION_ERROR", async () => {
			await expect(slothlet({ ...config, base: BASE, silent: true, api: { collision: "error" } })).rejects.toMatchObject({
				code: "COLLISION_ERROR"
			});
		});
	});
});
