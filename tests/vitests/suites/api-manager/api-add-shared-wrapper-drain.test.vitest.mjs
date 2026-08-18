/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-add-shared-wrapper-drain.test.vitest.mjs
 *	@Date: 2026-08-18 12:00:00 -07:00 (1787079600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-18 12:00:00 -07:00 (1787079600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Regression test for the shared-wrapper dedup in the post-`api.add` materialization
 * drain (`collectPendingMaterializations`). When one synthetic add references the SAME existing api
 * wrapper under two keys — aliasing an api node at two positions — the drain walk reaches that
 * wrapper twice. Its `seenWrappers` guard must skip the second visit; without it the walk would
 * reprocess the shared subtree (and, on a genuine cycle, recurse without end). This exercises that
 * guard and asserts both aliases resolve to the shared node.
 * @module tests/vitests/suites/api-manager/api-add-shared-wrapper-drain.test.vitest
 * @memberof tests.vitests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const ALL_CONFIGS = getMatrixConfigs({});

describe.each(ALL_CONFIGS)("api.add shared-wrapper drain dedup > Config: '$name'", ({ config }) => {
	let slothlet;
	let instances = [];

	beforeEach(async () => {
		slothlet = (await import("@cldmv/slothlet")).default;
		instances = [];
	});

	afterEach(async () => {
		for (const instance of instances) {
			if (instance) await instance.shutdown();
		}
		instances = [];
	});

	it("aliases one existing api wrapper at two positions in a single synthetic add", async () => {
		const api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		instances.push(api);

		// Mount a source node, then alias its wrapper under two keys in one add. The post-add drain
		// walks the new subtree and reaches the shared wrapper twice; the dedup guard skips the repeat.
		await api.slothlet.api.add("aliasSrc", { exports: { leaf: () => 42 } });
		await api.slothlet.api.add("aliasView", { left: api.aliasSrc, right: api.aliasSrc });

		// The add completes (no reprocess/hang) and both aliases resolve to the same shared node.
		expect(await api.aliasView.left.leaf()).toBe(42);
		expect(await api.aliasView.right.leaf()).toBe(42);
	});
});
