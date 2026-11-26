/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modes/collision-file-folder-merge-no-default.test.vitest.mjs
 *	@Date: 2026-11-25T12:18:14-08:00 (1795637894)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T12:26:57-08:00 (1795638417)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file and a same-named folder, neither with a default export, composed under the
 * documented collision table in every mode.
 *
 * @description
 * Files load before directories, so the file is the first-loaded source. Under `merge` (and `warn`,
 * which resolves a file/folder collision as `merge`) the first loaded wins every conflict and
 * non-conflicting keys from both sources are added (docs/MIGRATION.md collision table, O01). A
 * conflicting key that is a namespace on both sides merges its children the same way (O08: a
 * container merges children; the wrapper merge in api-assignment.mjs recurses into it). Under
 * `merge-replace` the folder wins conflicts instead.
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
 * Under merge, in eager and lazy alike:
 *   api.math.version  → "file"     api.math.inner.a → "file"    api.math.inner.b → "dir"
 *   api.math.add()    → "file-add" api.math.extra()  → "dir-extra"
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
 * Read everything the assertions need off one slot.
 * @param {object} api - The composed api.
 * @param {string[]} path - Segments to the slot.
 * @param {boolean} hasExtra - Whether the folder has a sibling `extra` file.
 * @returns {Promise<object>} The observed surface.
 */
const observe = async (api, path, hasExtra) => {
	const slot = await readSlot(api, path);
	const inner = await slot.inner;
	return {
		version: await slot.version,
		a: await inner.a,
		b: await inner.b,
		add: await slot.add(),
		extra: hasExtra ? await slot.extra() : undefined,
		// Read again once every member above has loaded, so a lazy surface is settled.
		keys: Object.keys(await readSlot(api, path)).sort(),
		innerKeys: Object.keys(await (await readSlot(api, path)).inner).sort()
	};
};

describe("Modes > file + same-named folder with no default export", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	describe.each(CONFIGS)("$name", ({ config }) => {
		for (const collision of ["merge", "warn"]) {
			for (const { label, path, hasExtra } of SLOTS) {
				it(`${collision}: the file (first loaded) wins conflicts and nested namespaces merge (${label})`, async () => {
					api = await slothlet({ ...config, base: BASE, silent: true, api: { collision } });

					expect(await observe(api, path, hasExtra)).toEqual({
						version: "file",
						a: "file",
						b: "dir",
						add: "file-add",
						extra: hasExtra ? "dir-extra" : undefined,
						keys: hasExtra ? ["add", "extra", "inner", "version"] : ["add", "inner", "version"],
						innerKeys: ["a", "b"]
					});
				});
			}
		}

		for (const { label, path, hasExtra } of SLOTS) {
			it(`merge-replace: the folder (second loaded) wins conflicts, both sources added (${label})`, async () => {
				api = await slothlet({ ...config, base: BASE, silent: true, api: { collision: "merge-replace" } });

				expect(await observe(api, path, hasExtra)).toEqual({
					version: "dir",
					a: "dir",
					b: "dir",
					add: "file-add",
					extra: hasExtra ? "dir-extra" : undefined,
					keys: hasExtra ? ["add", "extra", "inner", "version"] : ["add", "inner", "version"],
					innerKeys: ["a", "b"]
				});
			});
		}
	});
});
