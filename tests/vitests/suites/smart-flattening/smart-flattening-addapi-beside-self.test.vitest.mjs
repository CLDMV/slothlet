/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-addapi-beside-self.test.vitest.mjs
 *	@Date: 2026-10-12T02:05:51-07:00 (1791795951)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T13:05:44-07:00 (1791835544)
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
 * kit/kit.mjs       name = "kit"
 * kit/addapi.mjs    default new Kit() (#v with get/set v, set only, field n, bump())
 * slab/addapi.mjs   default { level: 1, get double() } (merged before slab/slab.mjs takes the slot)
 * slab/slab.mjs     slab = { x: 1 }
 * latch/addapi.mjs  default { level: 1, get double() } (merged before latch/latch.mjs takes the slot)
 * latch/latch.mjs   default function latch() → "latch"
 * vault/vault.mjs   name = "vault"
 * vault/addapi.mjs  default new Vault() (#secret read by reveal()), extra = "extra"
 * ```
 * The addapi file merges into the node its folder's self-named file makes. A getter stays a getter
 * there and reads writes made through the node. A primitive holds no members, so it is kept under
 * `default` beside the self-named file's members, as a primitive self-named default is beside
 * siblings. `export default undefined` binds `default` like any other value, so it is kept under
 * `default` as `0` and `null` are. A function default gets a layer for its named exports, so a frozen
 * function composes and the module's function is never written to. A class instance's accessors and
 * fields are read and written through the instance, and a getter merged in before the folder's
 * self-named file takes the slot stays a getter on that file's node.
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

	it("reads and writes a class-instance addapi default's accessors and fields through the instance", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.kit;
		expect(api.kit.name).toBe("kit");
		expect(api.kit.v).toBe(1);
		api.kit.v = 5;
		expect(api.kit.v).toBe(10);
		api.kit.only = 3;
		expect(api.kit.only).toBeUndefined();
		api.kit.n = 10;
		expect(api.kit.bump()).toBe(11);
		expect(api.kit.n).toBe(11);
	});

	it("calls a layered class-instance addapi default's prototype method on the instance", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.vault;
		expect(api.vault.name).toBe("vault");
		expect(await api.vault.reveal()).toBe("secret");
	});

	it.each(["slab", "latch"])("keeps an addapi getter live after %s's self-named file takes the slot", async (name) => {
		api = await slothlet({ ...config, base: BASE });
		await api[name];
		expect(api[name].double).toBe(2);
		api[name].level = 5;
		expect(api[name].double).toBe(10);
		if (name === "latch") expect(await api.latch()).toBe("latch");
		else expect(api.slab.x).toBe(1);
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
