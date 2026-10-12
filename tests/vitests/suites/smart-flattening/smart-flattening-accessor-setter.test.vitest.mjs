/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-accessor-setter.test.vitest.mjs
 *	@Date: 2026-10-12T06:34:19-07:00 (1791812059)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T08:32:47-07:00 (1791819167)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A setter on an object default runs on a write through the api, as it would on the
 * object itself, and keeps running when a file/folder collision moves the member (#585 review).
 *
 * @description
 * Fixture `api_smart_flatten_accessor_setter`:
 * ```
 * box.mjs         default { _v: 1, get v() → this._v, set v(x) → this._v = x * 2, set only(x) → this.got = x }
 * pane.mjs        default { _w: 1, get w() → this._w, set w(x) → this._w = x * 3 }
 * pane/pane.mjs   default { folderOnly: 1 }
 * ```
 * In plain JavaScript, `box.v = 5` makes `box.v` read 10, `box.only = 3` makes `box.got` 3 while
 * `box.only` reads `undefined`, and `pane.w` reads 1 until `pane.w = 2` makes it read 6. `_w` is a member of
 * the module like any other: a leading underscore does not make it the framework's.
 *
 * @module tests/vitests/suites/smart-flattening/smart-flattening-accessor-setter
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_accessor_setter");

describe.each(getMatrixConfigs({}))("setters on an object default > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("runs a getter and setter pair on a write through the api", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.box;
		expect(api.box.v).toBe(1);
		api.box.v = 5;
		expect(api.box.v).toBe(10);
	});

	it("runs a setter alone on a write through the api", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.box;
		api.box.only = 3;
		expect(api.box.got).toBe(3);
		expect(api.box.only).toBeUndefined();
	});

	it.each(["merge", "merge-replace"])("keeps a file's setter running through its collision with a folder under %s", async (mode) => {
		api = await slothlet({ ...config, base: BASE, collision: { initial: mode, api: mode } });
		await api.pane;
		expect(api.pane.folderOnly).toBe(1);
		// The file's `_w` is its own member, kept through the collision, so the getter reads it before any write.
		expect(Object.keys(api.pane).sort()).toEqual(["_w", "folderOnly", "w"]);
		expect(api.pane.w).toBe(1);
		api.pane.w = 2;
		expect(api.pane.w).toBe(6);
	});
});
