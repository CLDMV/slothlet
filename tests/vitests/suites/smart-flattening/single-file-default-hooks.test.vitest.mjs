/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/single-file-default-hooks.test.vitest.mjs
 *	@Date: 2026-11-14T08:37:28-08:00 (1794674248)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:11:40-08:00 (1794676300)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A folder whose only file has a default-export function (F05, #773): a hook names the folder's path and fires once per call.
 *
 * @description
 * Cases, fixtures and the rules behind the expected trees: `tests/vitests/setup/single-file-default.mjs`.
 * @module tests/vitests/suites/smart-flattening/single-file-default-hooks
 */

import { describe, it, expect } from "vitest";
import { MODES, ROWS, build, reach, load } from "../../setup/single-file-default.mjs";

describe.each(MODES)("a folder's only file with a default-export function is the folder (#773) > %s, %s", (mode, runtime) => {
	it.each(ROWS)(
		"$fixture at $at: a hook on a node's path fires once per call and reports that path",
		async ({ fixture, at, leaves, wrong }) => {
			const api = await build(fixture, at, { mode, runtime, hook: true });
			try {
				for (const leaf of leaves) {
					const seen = [];
					const ids = [
						api.slothlet.hook.on(`${leaf}:before`, ({ path: apiPath }) => {
							seen.push(["right", apiPath]);
						}),
						...wrong.map((entry) =>
							api.slothlet.hook.on(`${entry}:before`, ({ path: apiPath }) => {
								seen.push(["wrong", apiPath]);
							})
						)
					];
					try {
						await load(api, leaf);
						await reach(api, leaf)();
						expect(seen).toEqual([["right", leaf]]);
					} finally {
						for (const id of ids) api.slothlet.hook.off(id);
					}
				}
			} finally {
				await api.slothlet.shutdown();
			}
		}
	);
});
