/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-instance-override.test.vitest.mjs
 *	@Date: 2026-10-12T10:09:40-07:00 (1791824980)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T10:37:51-07:00 (1791826671)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A named export that wins its collision with a self-named class instance's own member
 * stays the winner when the folder's members are laid in order beside a sibling file (#585 review).
 *
 * @description
 * Fixture `api_smart_flatten_instance_override`:
 * ```
 * inst/inst.mjs   default new Thing() (constructor sets mode = "own") + mode = "named"
 * inst/sib.mjs    sib() → "inst.sib"
 * ```
 * Under `merge` the default's own member is kept (#421), so `api.inst.mode` is "own". Under `warn`,
 * `replace` and `merge-replace` the named export takes the slot, so it is "named".
 *
 * @module tests/vitests/suites/smart-flattening/smart-flattening-instance-override
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_instance_override");

describe.each(getMatrixConfigs({}))("instance member override beside a sibling > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each([
		["merge", "own"],
		["warn", "named"],
		["replace", "named"],
		["merge-replace", "named"]
	])("under %s answers %s for the colliding member", async (mode, expected) => {
		api = await slothlet({ ...config, base: BASE, silent: true, collision: { initial: mode, api: mode } });
		await api.inst;
		expect(api.inst.mode).toBe(expected);
		expect(await api.inst.sib()).toBe("inst.sib");
	});
});
