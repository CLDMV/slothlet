/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-add-lazy-settled.test.vitest.mjs
 *	@Date: 2026-09-27T01:17:31-07:00 (1790497051)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-27 01:19:14 -07:00 (1790497154)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview #462 — a lazy-mode `api.slothlet.api.add()` must return with the mounted subtree in
 * the same settled state an initial lazy build produces: top-level folder wrappers unmaterialized
 * and NOT mid-materialization. Ownership registration used to walk the new subtree through the
 * wrappers' get traps, which starts a fire-and-forget `_materialize()` on every child it touched;
 * `add()` then resolved while those were still in flight, so what `add()` returned depended on
 * timing (and the eager/lazy parity check in tests/debug-slothlet.mjs read a half-built tree).
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

/** Folders directly under the collisions fixture whose only child is a `sub/` subfolder. */
const TOP_FOLDERS = ["lazybase", "lazyfuncbase", "lazynullbase"];

/**
 * Materialization state of `parent[key]`, read WITHOUT going through the parent's proxy get trap —
 * that trap starts a lazy child's materialization, so reading through it would itself put the
 * child in flight and the check would observe its own side effect.
 * @param {unknown} parent - Api node holding the child (a wrapper proxy, or a plain root object).
 * @param {string} key - Child key.
 * @returns {{ materialized: boolean, inFlight: boolean }} The child's state.
 */
const stateOf = (parent, key) => {
	const inner = resolveWrapper(parent);
	let child;
	if (!inner) child = parent[key];
	else if (Object.prototype.hasOwnProperty.call(inner, key)) child = inner[key];
	else child = inner.____slothletInternal.impl?.[key];
	const { materialized, inFlight } = resolveWrapper(child).____slothletInternal.state;
	return { materialized, inFlight };
};

describe.each(getMatrixConfigs({ mode: "lazy" }))("api.add() in lazy mode returns a settled tree (#462) > $name", ({ config }) => {
	let api;
	let reference;

	afterEach(async () => {
		if (api) await api.shutdown();
		if (reference) await reference.shutdown();
		api = null;
		reference = null;
	});

	it("leaves no mounted top-level wrapper mid-materialization when add() resolves", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("mounted", TEST_DIRS.API_TEST_COLLISIONS);

		for (const name of TOP_FOLDERS) {
			expect(stateOf(api.mounted, name).inFlight, `mounted.${name} still materializing`).toBe(false);
		}
	});

	it("matches an initial lazy build of the same folders", async () => {
		reference = await slothlet({ ...config, base: TEST_DIRS.API_TEST_COLLISIONS });
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("mounted", TEST_DIRS.API_TEST_COLLISIONS);

		for (const name of TOP_FOLDERS) {
			expect(stateOf(api.mounted, name), `mounted.${name}`).toEqual(stateOf(reference, name));
		}
	});

	it("the mounted modules still resolve and stay owned by the added module", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		const moduleID = await api.slothlet.api.add("mounted", TEST_DIRS.API_TEST_COLLISIONS, { moduleID: "collisions-mod" });

		expect(await api.mounted.lazybase.sub.testFunc()).toBe("from-lazybase-sub");
		expect(await api.mounted.lazyfuncbase.sub(1)).toBe("from-lazyfuncbase-sub:1");

		// Removing the module takes everything it mounted with it, including subtrees that were
		// only materialized after add() returned.
		expect(await api.slothlet.api.remove(moduleID)).toBe(true);
		expect(api.mounted).toBeUndefined();
	});
});
