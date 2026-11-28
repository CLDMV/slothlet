/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-a-node-report.test.vitest.mjs
 *	@Date: 2026-11-25T01:31:33-08:00 (1795599093)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:12-08:00 (1795869192)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `slothlet.node(target)` for the targets it is not an api node for, and for the ones it reaches by path:
 * an empty path, a path with an empty or non-string segment, a path that runs out of objects, a path that reaches plain
 * data of a node, and a versioned logical path named by string.
 *
 * Fixture: `api_tests/api_test_versioned` (`callers` base, `v1` / `v2` added as versions of `auth`).
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

describe.each(getMatrixConfigs())("slothlet.node targets by path > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Load the callers base, add both versions of `auth`, and `syn` holding data.
	 * @returns {Promise<object>} The api.
	 */
	async function load() {
		api = await slothlet({ ...config, base: `${BASE}/callers` });
		await api.slothlet.api.add("auth", `${BASE}/v1`, { version: { tag: "v1", default: true } });
		await api.slothlet.api.add("auth", `${BASE}/v2`, { version: { tag: "v2" } });
		await api.slothlet.api.add("syn", { num: 7, label: "x", nested: { deep: 1 } }, { id: "syn" });
		await api.syn.nested;
		return api;
	}

	it("reports nothing for a path that names no node", async () => {
		await load();
		expect(api.slothlet.node("")).toBeUndefined();
		expect(api.slothlet.node([])).toBeUndefined();
		expect(api.slothlet.node(["syn", ""])).toBeUndefined();
		expect(api.slothlet.node(["syn", 1])).toBeUndefined();
		expect(api.slothlet.node("syn.label.length.more")).toBeUndefined();
		expect(api.slothlet.node("syn.missing")).toBeUndefined();
	});

	it("reports plain data a path reaches as data of the node holding it", async () => {
		await load();
		const report = api.slothlet.node("syn.num");
		expect(report.path).toEqual(["syn", "num"]);
		expect(Object.isFrozen(report)).toBe(true);
		expect(api.slothlet.node(["syn", "label"]).path).toEqual(["syn", "label"]);
	});

	it("reports a versioned logical path named by string as its dispatcher", async () => {
		await load();
		expect(api.slothlet.node("auth").logical).toEqual(["auth"]);
		expect(api.slothlet.node(["auth"]).logical).toEqual(["auth"]);
	});
});
