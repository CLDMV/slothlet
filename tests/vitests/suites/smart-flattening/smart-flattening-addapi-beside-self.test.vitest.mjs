/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-addapi-beside-self.test.vitest.mjs
 *	@Date: 2026-10-12T02:05:51-07:00 (1791795951)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T03:45:09-07:00 (1791801909)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An addapi file beside its folder's self-named file contributes what plain JavaScript
 * would, and an explicit `export default undefined` is a default (#585 review).
 *
 * @description
 * Fixture `api_smart_flatten_addapi_beside_self`:
 * ```
 * dial/dial.mjs     name = "dial"
 * dial/addapi.mjs   default { level: 1, get double() → this.level * 2 }
 * knob/knob.mjs     name = "knob"
 * knob/addapi.mjs   default 3
 * zero/zero.mjs     name = "zero"
 * zero/addapi.mjs   default 0
 * lock/lock.mjs     name = "lock"
 * lock/addapi.mjs   default Object.freeze(function seal) + extra = 3
 * blank.mjs         default undefined + a = 1
 * ```
 * The addapi file merges into the node its folder's self-named file makes. A getter stays a getter
 * there and reads writes made through the node. A primitive holds no members, so it is kept under
 * `default` beside the self-named file's members, as a primitive self-named default is beside
 * siblings. `export default undefined` binds `default` like any other value, so it is kept under
 * `default` as `0` and `null` are. A function default gets a layer for its named exports, so a frozen
 * function composes and the module's function is never written to.
 *
 * @module tests/vitests/suites/smart-flattening/smart-flattening-addapi-beside-self
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_addapi_beside_self");

describe.each(getMatrixConfigs({}))("addapi beside a self-named file > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("keeps an addapi object default's getter live on the merged node", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.dial;
		expect(api.dial.name).toBe("dial");
		expect(api.dial.double).toBe(2);
		api.dial.level = 5;
		expect(api.dial.level).toBe(5);
		expect(api.dial.double).toBe(10);
	});

	it.each([
		["knob", 3],
		["zero", 0]
	])("keeps %s's primitive addapi default under default beside the self-named file", async (name, value) => {
		api = await slothlet({ ...config, base: BASE });
		await api[name];
		expect(api[name].name).toBe(name);
		expect(api[name].default).toBe(value);
		expect(Object.keys(api[name]).sort()).toEqual(["default", "name"]);
	});

	it("composes a frozen function addapi default with its named export without writing to the function", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.lock;
		expect(api.lock.name).toBe("lock");
		await api.lock.lock;
		expect(api.lock.lock()).toBe("seal");
		expect(api.lock.lock.extra).toBe(3);
	});

	it("keeps an explicit undefined default under default beside its named export", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.blank;
		expect(api.blank.a).toBe(1);
		expect("default" in api.blank).toBe(true);
		expect(api.blank.default).toBeUndefined();
		expect(Object.keys(api.blank).sort()).toEqual(["a", "default"]);
	});
});
