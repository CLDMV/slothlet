/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/single-file-default-promotion.test.vitest.mjs
 *	@Date: 2026-11-14T08:37:28-08:00 (1794674248)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:11:41-08:00 (1794676301)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A folder whose only file has a default-export function is that function, whatever the file or the function is called (F05, #773): the tree, recorded paths, and each function against the file imported plainly.
 *
 * @description
 * Cases, fixtures and the rules behind the expected trees: `tests/vitests/setup/single-file-default.mjs`.
 * @module tests/vitests/suites/smart-flattening/single-file-default-promotion
 */

import { describe, it, expect } from "vitest";
import {
	MODES,
	ROWS,
	PROMOTED,
	OWN_ROOT_KEYS,
	build,
	walk,
	reach,
	load,
	placed,
	expectedTree,
	plain
} from "../../setup/single-file-default.mjs";

describe.each(MODES)("a folder's only file with a default-export function is the folder (#773) > %s, %s", (mode, runtime) => {
	it.each(ROWS)(
		"$fixture at $at: the tree, every node records the path it is reached at, nothing at the old path",
		async ({ fixture, at, top, tree, wrong }) => {
			const api = await build(fixture, at, { mode, runtime });
			try {
				const out = { tree: [], drift: [] };
				if (at === "base") {
					for (const key of Object.keys(api)) {
						if (!OWN_ROOT_KEYS.has(key)) await walk(api[key], [key], mode === "lazy", out, 0);
					}
				} else {
					const first = at.split(".")[0];
					await walk(api[first], [first], mode === "lazy", out, 0);
				}
				out.tree.sort();
				expect(out.tree).toEqual(expectedTree(at, top, tree));
				expect(out.drift).toEqual([]);
				for (const entry of wrong) {
					await load(api, entry);
					expect(reach(api, entry)).toBeUndefined();
				}
			} finally {
				await api.slothlet.shutdown();
			}
		}
	);

	it.each(PROMOTED)("$fixture at $at: each function answers as the file imported plainly", async ({ fixture, at, twin }) => {
		const api = await build(fixture, at, { mode, runtime });
		try {
			for (const { at: apiPath, file, name } of twin) {
				const expected = await plain(fixture, file, name);
				await load(api, apiPath);
				const node = reach(api, apiPath);
				expect(typeof node).toBe("function");
				expect(await node("hello")).toBe(await expected("hello"));
				expect(node.__metadata.apiPath).toBe(apiPath);
			}
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it.each(PROMOTED)("$fixture at $at: each function called before anything is loaded answers the same", async ({ fixture, at, twin }) => {
		for (const { at: apiPath, file, name } of twin) {
			const api = await build(fixture, at, { mode, runtime });
			try {
				const expected = await plain(fixture, file, name);
				expect(await reach(api, apiPath)("hello")).toBe(await expected("hello"));
				expect(reach(api, apiPath).__metadata.apiPath).toBe(apiPath);
			} finally {
				await api.slothlet.shutdown();
			}
		}
	});

	it.each(["base", "zz", "e", "zz.e"])("a default-export Map in a single-file folder stays data at %s (#766)", async (at) => {
		const api = await build("n4_map_default", at, { mode, runtime });
		try {
			await load(api, placed(at, "e", "e.x"));
			const node = reach(api, placed(at, "e", "e.x"));
			expect(node instanceof Map).toBe(true);
			expect(node.get("k")).toBe("e/x.mjs:k");
			expect([...node]).toEqual([["k", "e/x.mjs:k"]]);
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
