/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/addapi/addapi-collision-mode-validation.test.vitest.mjs
 *	@Date: 2026-11-25T08:32:36-08:00 (1795624356)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:06-08:00 (1795869066)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A per-call `collision` mode on `api.add` is checked against the same modes the instance config takes
 * (#985).
 *
 * @description
 * The instance's `api.collision.mode` is lowercased and checked against the valid list. A per-call mode used to be
 * passed through as written, so `"Merge"` or a typo skipped every collision branch and silently replaced the existing
 * node. A mode in any case now works as that mode, and an unknown one is refused before anything is mounted.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("api.add per-call collision mode validation (#985) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	const make = () => slothlet({ ...config, base: TEST_DIRS.API_TEST, silent: true, api: { collision: { override: true } } });

	it.each(["Merge", "MERGE"])("collision %j merges, as the lowercase mode does", async (mode) => {
		api = await make();
		await api.slothlet.api.add("tools", { a: () => "a" });
		await api.slothlet.api.add("tools", { b: () => "b" }, { collision: mode });
		expect(Object.keys(api.tools).sort()).toEqual(["a", "b"]);
		expect(api.tools.a()).toBe("a");
		expect(api.tools.b()).toBe("b");
	});

	it("the object form takes the mode in any case too", async () => {
		api = await make();
		await api.slothlet.api.add("tools", { a: () => "a" });
		await api.slothlet.api.add("tools", { b: () => "b" }, { collision: { mode: "Skip" } });
		expect(Object.keys(api.tools)).toEqual(["a"]);
	});

	it.each(["mrege", "", "overwrite"])("an unknown mode %j is refused and the existing node is kept", async (mode) => {
		api = await make();
		await api.slothlet.api.add("tools", { a: () => "a" });
		await expect(api.slothlet.api.add("tools", { b: () => "b" }, { collision: mode })).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
		expect(Object.keys(api.tools)).toEqual(["a"]);
		expect(api.tools.a()).toBe("a");
	});

	it.each([5, null])("a non-string mode %j is refused", async (mode) => {
		api = await make();
		await api.slothlet.api.add("tools", { a: () => "a" });
		await expect(api.slothlet.api.add("tools", { b: () => "b" }, { collision: { mode } })).rejects.toMatchObject({
			code: "INVALID_ARGUMENT"
		});
		expect(Object.keys(api.tools)).toEqual(["a"]);
	});
});
