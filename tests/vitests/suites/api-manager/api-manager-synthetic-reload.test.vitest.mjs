/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-synthetic-reload.test.vitest.mjs
 *	@Date: 2026-08-24T00:00:00-08:00 (1787558400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-24T00:00:00-08:00 (1787558400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview A synthetic (in-memory) add survives a full-instance reload().
 *
 * @description
 * A directory mount can be replayed by re-reading its folder, but a synthetic add — an inline
 * function, an export map, or a `{ exports, ...options }` object — has no file to re-read. The add
 * record therefore captures the ORIGINAL inline value as its replay folderPath (not the internal
 * `synthetic:<path>` sentinel, which reload would wrongly resolve as a filesystem path). reload()
 * then re-runs the identical synthetic add and the mount comes back intact, keeping its moduleID so
 * it stays removable afterward.
 *
 * @module tests/vitests/suites/api-manager/api-manager-synthetic-reload
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const CONFIGS = [
	{ name: "eager", config: { mode: "eager", runtime: "async", hook: { enabled: true } } },
	{ name: "lazy", config: { mode: "lazy", runtime: "async", hook: { enabled: true } } }
];

const mutations = { mutations: { add: true, remove: true, reload: true } };

describe.each(CONFIGS)("synthetic add survives reload() — $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("re-runs an inline-function add across reload", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, api: mutations });
		await api.slothlet.api.add("probe", () => "P", { moduleID: "synthFn" });
		expect(api.probe()).toBe("P");

		await api.slothlet.reload();
		expect(api.probe()).toBe("P"); // replayed from the recorded inline function
	});

	it("re-runs an export-map add across reload", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, api: mutations });
		await api.slothlet.api.add("bag", { one: () => 1, two: () => 2 }, { moduleID: "synthObj" });
		expect(api.bag.one()).toBe(1);
		expect(api.bag.two()).toBe(2);

		await api.slothlet.reload();
		expect(api.bag.one()).toBe(1);
		expect(api.bag.two()).toBe(2);
	});

	it("re-runs a { exports, ...options } shorthand add across reload", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, api: mutations });
		await api.slothlet.api.add("short", { exports: { hi: () => "hi" }, moduleID: "synthShort" });
		expect(api.short.hi()).toBe("hi");

		await api.slothlet.reload();
		expect(api.short.hi()).toBe("hi");
	});

	it("keeps the synthetic mount removable by its moduleID after reload", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, api: mutations });
		await api.slothlet.api.add("probe", () => "P", { moduleID: "synthFn" });
		await api.slothlet.reload();

		expect(await api.slothlet.api.remove("synthFn")).toBe(true); // id survived the reload
		expect(api.probe).toBeUndefined();
	});
});
