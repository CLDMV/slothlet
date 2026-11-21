/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-remove-forced-reload.test.vitest.mjs
 *	@Date: 2026-11-17T12:34:55-08:00 (1794947695)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T12:44:21-08:00 (1794948261)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Removing a module that a forced add laid over another module's path keeps the other module's members
 * across a full reload().
 *
 * @description
 * Inline add A at `p`, inline add B at `p` with `collision: { force: true }`, then `remove("B")` puts A's members back.
 * Every path of B was a rollback to A and none was deleted, so the removal used to record nothing for the reload to
 * replay: reload() re-added B and dropped A's `num` again.
 *
 * @module tests/vitests/suites/api-manager/api-manager-remove-forced-reload
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

/**
 * The members at `p` and what its leaves answer.
 * @param {object} api - Bound api.
 * @returns {{ keys: string[], f: string|undefined, num: number|undefined, g: string|undefined }} The shape.
 */
function shapeOf(api) {
	const p = api.p;
	return {
		keys: Object.keys(p).sort(),
		f: typeof p.f === "function" ? p.f() : undefined,
		num: typeof p.num === "function" ? p.num() : undefined,
		g: typeof p.g === "function" ? p.g() : undefined
	};
}

describe.each(CONFIGS)("remove() of a forced add replays across reload() > $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = undefined;
	});

	it("keeps the module the forced add covered after every reload", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode, runtime });
		await api.slothlet.api.add("p", { num: () => 1, f: () => "A" }, { id: "A" });
		await api.slothlet.api.add("p", { f: () => "B" }, { id: "B", collision: { force: true } });
		await api.slothlet.api.remove("B");
		const restored = { keys: ["f", "num"], f: "A", num: 1, g: undefined };
		expect(shapeOf(api)).toEqual(restored);
		for (let round = 0; round < 2; round++) {
			await api.slothlet.reload();
			expect(shapeOf(api)).toEqual(restored);
		}
		await api.slothlet.api.remove("A");
		expect(api.p).toBeUndefined();
	});

	it("keeps it when the forced add also brought members of its own", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode, runtime });
		await api.slothlet.api.add("p", { num: () => 1, f: () => "A" }, { id: "A" });
		await api.slothlet.api.add("p", { f: () => "B", g: () => "G" }, { id: "B", collision: { force: true } });
		await api.slothlet.api.remove("B");
		const restored = { keys: ["f", "num"], f: "A", num: 1, g: undefined };
		expect(shapeOf(api)).toEqual(restored);
		await api.slothlet.reload();
		expect(shapeOf(api)).toEqual(restored);
	});

	it("lets the id be added again after the reload", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode, runtime });
		await api.slothlet.api.add("p", { num: () => 1, f: () => "A" }, { id: "A" });
		await api.slothlet.api.add("p", { f: () => "B" }, { id: "B", collision: { force: true } });
		await api.slothlet.api.remove("B");
		await api.slothlet.reload();
		await api.slothlet.api.add("q", { h: () => "H" }, { id: "B" });
		await api.slothlet.reload();
		expect(shapeOf(api)).toEqual({ keys: ["f", "num"], f: "A", num: 1, g: undefined });
		expect(api.q.h()).toBe("H");
	});
});
