/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-slot-default.test.vitest.mjs
 *	@Date: 2026-10-09T00:00:00-07:00 (1791529200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T00:00:00-07:00 (1791529200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A built-in or private-field default composed with named exports keeps working.
 *
 * @description
 * A `Map` keeps its entries in internal slots and a class keeps `#fields` on the instance; neither
 * survives a property copy. The api node answers through the default itself, with the named exports
 * beside it. Fixture `api_smart_flatten_slot_default`:
 * ```
 * registry.mjs          default new Map([["a", 1], ["b", 2]]) + extra()  → api.registry.get("a") = 1, .size = 2
 * counter.mjs           default new Counter() (#count)        + extra()  → api.counter.inc() = 1, .value = 1
 * store/store.mjs       default new Store() (#items)          + extra()  → api.store.add("b") = 2, .size = 2
 * store/sib.mjs         sib()                                            → api.store.sib()
 * ```
 *
 * @module tests/vitests/suites/smart-flattening/smart-flattening-slot-default
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_slot_default");

describe.each(getMatrixConfigs({}))("built-in and private-field defaults > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("a Map default answers get, has and size from its own entries", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.registry.get("a")).toBe(1);
		expect(await api.registry.has("b")).toBe(true);
		expect(await api.registry.size).toBe(2);
		expect(await api.registry.extra()).toBe("registry.extra");
	});

	it("a class default's methods and getter reach its private field", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.counter.value).toBe(0);
		expect(await api.counter.inc()).toBe(1);
		expect(await api.counter.inc()).toBe(2);
		expect(await api.counter.value).toBe(2);
		expect(await api.counter.extra()).toBe("counter.extra");
	});

	it("a folder's same-named class-instance default keeps its private field, beside a sibling", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.store.sib()).toBe("store.sib");
		expect(await api.store.size).toBe(1);
		expect(await api.store.add("b")).toBe(2);
		expect(await api.store.size).toBe(2);
		expect(await api.store.extra()).toBe("store.extra");
	});
});
