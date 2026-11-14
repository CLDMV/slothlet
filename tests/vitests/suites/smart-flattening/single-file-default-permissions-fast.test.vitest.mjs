/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/single-file-default-permissions-fast.test.vitest.mjs
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
 * @fileoverview A folder whose only file has a default-export function (F05, #773): a permission rule names the folder's path (fast attribution).
 *
 * @description
 * Cases, fixtures and the rules behind the expected trees: `tests/vitests/setup/single-file-default.mjs`.
 * @module tests/vitests/suites/smart-flattening/single-file-default-permissions-fast
 */

import { describe, it, expect } from "vitest";
import { MODES, ROWS, build, placed } from "../../setup/single-file-default.mjs";

describe.each(MODES)("a folder's only file with a default-export function is the folder (#773) > %s, %s", (mode, runtime) => {
	describe("a permission rule names the path a node is reached at (fast)", () => {
		const attribution = "fast";
		const permissions = (targets) => ({
			defaultPolicy: "allow",
			attribution,
			rules: targets.map((target) => ({ caller: "probe.**", target, effect: "deny" }))
		});

		it.each(ROWS)(
			"$fixture at $at: a deny on each node's path refuses it, and a deny on the old path does not",
			async ({ fixture, at, top, tree, leaves, wrong }) => {
				const markers = Object.fromEntries(
					tree
						.filter((entry) => entry.includes(" -> "))
						.map((entry) => entry.split(" -> "))
						.map(([p, m]) => [placed(at, top, p), m])
				);
				const denied = await build(fixture, at, { mode, runtime, permissions: permissions(leaves) });
				try {
					for (const leaf of leaves) expect(await denied.probe.call(leaf)).toBe("PERMISSION_DENIED");
				} finally {
					await denied.slothlet.shutdown();
				}
				if (wrong.length === 0) return;
				const other = await build(fixture, at, { mode, runtime, permissions: permissions(wrong) });
				try {
					for (const leaf of leaves) expect(await other.probe.call(leaf)).toBe(markers[leaf]);
				} finally {
					await other.slothlet.shutdown();
				}
			}
		);
	});
});
