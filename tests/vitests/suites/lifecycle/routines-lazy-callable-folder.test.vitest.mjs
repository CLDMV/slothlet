/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/routines-lazy-callable-folder.test.vitest.mjs
 *	@Date: 2026-11-12T22:42:58-08:00 (1794552178)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T07:23:26-08:00 (1794583406)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A callable folder's own function is a routine contribution in lazy mode as in eager (#754).
 *
 * @description
 * `svc/svc.mjs` exports `default function svc()` and `function start()`, so `api.svc()` and `api.svc.start()`.
 * A routine named `^svc`, `svc` or `^svc.**` runs the folder's own function in eager mode; lazy mode loads the
 * folder later, and the function it loads has to join the routine the same way. Eager is the reference: each
 * case runs the same routine on an eager instance and expects the lazy instance to run the same functions.
 * @module tests/vitests/suites/lifecycle/routines-lazy-callable-folder
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_globstar_zero");

/**
 * Run one routine on a fresh instance and return what it logged, sorted.
 * @param {object} options - Instance options.
 * @param {string} name - Routine name.
 * @param {{ mountAt?: string }} [extra] - When set, the fixture is also mounted at this path with `api.add()`.
 * @returns {Promise<string[]>} The functions the routine ran.
 */
async function runRoutine(options, name, extra = {}) {
	const api = await slothlet({ ...options, silent: true, routines: [{ name, mode: "manual" }] });
	try {
		if (extra.mountAt) await api.slothlet.api.add(extra.mountAt, BASE);
		globalThis.__slothletGlobstarLog = [];
		await api[name]();
		return [...globalThis.__slothletGlobstarLog].sort();
	} finally {
		await api.slothlet.shutdown();
	}
}

describe.each(["async", "live"])("a lazy callable folder's own function is a routine contribution (%s)", (runtime) => {
	beforeEach(() => {
		globalThis.__slothletGlobstarLog = [];
	});

	it.each([
		["^svc", ["svc"]],
		["svc", ["svc"]],
		["^svc.**", ["svc", "svc.start"]]
	])("routine %s runs what eager runs", async (name, expected) => {
		const eager = await runRoutine({ dir: BASE, mode: "eager", runtime }, name);
		expect(eager).toEqual(expected);
		const lazy = await runRoutine({ dir: BASE, mode: "lazy", runtime }, name);
		expect(lazy).toEqual(eager);
	});

	it("routine ^ext.svc.** on a folder mounted with api.add() runs what eager runs", async () => {
		const name = "^ext.svc.**";
		const eager = await runRoutine({ dir: path.join(BASE, "work"), mode: "eager", runtime }, name, { mountAt: "ext" });
		expect(eager).toEqual(["svc", "svc.start"]);
		const lazy = await runRoutine({ dir: path.join(BASE, "work"), mode: "lazy", runtime }, name, { mountAt: "ext" });
		expect(lazy).toEqual(eager);
	});

	it("bare routine svc on a folder mounted with api.add() runs what eager runs", async () => {
		const eager = await runRoutine({ dir: path.join(BASE, "work"), mode: "eager", runtime }, "svc", { mountAt: "ext" });
		expect(eager).toEqual(["svc"]);
		const lazy = await runRoutine({ dir: path.join(BASE, "work"), mode: "lazy", runtime }, "svc", { mountAt: "ext" });
		expect(lazy).toEqual(eager);
	});

	it("a lazy node under a bare routine's name that fails to load contributes nothing, and the instance still loads", async () => {
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST_LIFECYCLE_HOOKS_FAIL,
			mode: "lazy",
			runtime,
			silent: true,
			routines: [{ name: "broken", mode: "manual" }]
		});
		try {
			expect(await api.broken()).toEqual([]);
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("api.svc() and api.svc.start() still answer in lazy mode with the routine configured", async () => {
		const api = await slothlet({ dir: BASE, mode: "lazy", runtime, silent: true, routines: [{ name: "^svc.**", mode: "manual" }] });
		try {
			expect(await api.svc.start()).toBe("svc.start");
			expect(await api.svc()).toBe("svc");
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
