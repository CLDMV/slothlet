/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-primitive-default.test.vitest.mjs
 *	@Date: 2026-10-10T09:36:21-07:00 (1791650181)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-10T09:36:21-07:00 (1791650181)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A primitive default beside named exports keeps both, wherever the module sits.
 *
 * @description
 * A primitive cannot hold the named exports, so the module becomes a namespace with the primitive
 * under `default`, as a plain file already does. Fixture `api_smart_flatten_primitive_default`:
 * ```
 * level.mjs         default 3  + label = "level"  → api.level.default = 3, api.level.label = "level"
 * limit/limit.mjs   default 42 + unit = "ms"      → api.limit.default = 42, api.limit.unit = "ms"
 * quota/quota.mjs   default 7  + unit = "req"     → api.quota.default = 7, api.quota.unit = "req"
 * quota/sib.mjs     sib()                         → api.quota.sib() = "quota.sib"
 * falsy/zero.mjs    default 0    + label()         → api.falsy.zero.default = 0
 * falsy/nothing.mjs default null + label()         → api.falsy.nothing.default = null
 * stock/stock.mjs   default 5 (only export)        → api.stock.default = 5
 * stock/aisle.mjs   aisle()                        → api.stock.aisle() = "stock.aisle"
 * ```
 *
 * @module tests/vitests/suites/smart-flattening/smart-flattening-primitive-default
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_primitive_default");
const ADDAPI_MOUNT = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_primitive_default_addapi");

describe.each(getMatrixConfigs({}))("primitive defaults beside named exports > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("a plain file keeps the primitive under default and its named export", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.level.default).toBe(3);
		expect(await api.level.label).toBe("level");
	});

	it("a folder's only, same-named file keeps the primitive under default and its named export", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.limit.default).toBe(42);
		expect(await api.limit.unit).toBe("ms");
	});

	it("a folder's same-named file beside a sibling keeps the primitive, its named export and the sibling", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.quota.default).toBe(7);
		expect(await api.quota.unit).toBe("req");
		expect(await api.quota.sib()).toBe("quota.sib");
	});

	it("a folder's addapi file keeps the primitive under default and its named export, beside the sibling", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.meter.default).toBe(5);
		expect(await api.meter.unit).toBe("rps");
		expect(await api.meter.probe()).toBe("meter.probe");
	});

	it.each([
		["zero", 0],
		["nothing", null]
	])("a falsy default (%s) is a default too: kept under default beside its named export", async (name, value) => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.falsy[name].default).toBe(value);
		expect(await api.falsy[name].label()).toBe(`falsy.${name}.label`);
	});

	it("a folder's same-named file with only a primitive default keeps it under default beside a sibling", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.stock.default).toBe(5);
		expect(await api.stock.aisle()).toBe("stock.aisle");
	});

	it("an addapi file mounted with api.add() keeps the primitive under default and its named export", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.slothlet.api.add("gauge", ADDAPI_MOUNT);
		expect(await api.gauge.default).toBe(9);
		expect(await api.gauge.unit).toBe("kb");
	});
});
