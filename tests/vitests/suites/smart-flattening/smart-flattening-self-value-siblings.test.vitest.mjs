/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-self-value-siblings.test.vitest.mjs
 *	@Date: 2026-10-11T20:14:14-07:00 (1791774854)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T22:04:29-07:00 (1791781469)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A self-named file's non-function default keeps working as itself beside its folder's
 * other files, and the module's own value is never written to (#585 review).
 * @description
 * Fixture (`api_smart_flatten_self_value_siblings`):
 * ```
 * shelf/shelf.mjs    default new Map([["a", 1]])         shelf/item.mjs   item()
 * desk/desk.mjs      default class instance (#opened)     desk/pen.mjs     pen()
 * ledger/ledger.mjs  default Object.freeze({ total: 3 })  ledger/aside.mjs aside() (sorts first)
 * rack/rack.mjs      default [1, 2, 3]                    rack/slot.mjs    slot() (sorts after)
 * count/count.mjs    default 7 (its only export)
 * dial/dial.mjs      default { level: 1, get double() }   dial/knob.mjs   knob()
 * probe/probe.mjs    default callable Proxy answering `dyn` (alone)
 * ```
 * @module tests/vitests/suites/smart-flattening/smart-flattening-self-value-siblings
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_self_value_siblings");

describe.each(getMatrixConfigs())("self-named value default beside sibling files > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
		delete globalThis.__slothletSelfValueSiblings;
	});

	it("keeps a Map default working as a Map, with the sibling beside it and nothing written to the Map", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.shelf.get("a")).toBe(1);
		expect(await api.shelf.item()).toBe("shelf.item");
		await api.shelf.set("b", 2);
		expect(await api.shelf.size).toBe(2);
		expect(Object.keys(globalThis.__slothletSelfValueSiblings.shelf)).toEqual([]);
	});

	it("runs a class instance's methods on the instance, with the sibling beside it and nothing written to it", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.desk.inc()).toBe(2);
		expect(await api.desk.open()).toBe(1);
		expect(await api.desk.pen()).toBe("desk.pen");
		expect(Object.keys(globalThis.__slothletSelfValueSiblings.desk)).toEqual(["count"]);
	});

	it("keeps an array default an array, once loaded, with the sibling beside it", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.rack;
		expect(Array.isArray(api.rack)).toBe(true);
		expect(api.rack.length).toBe(3);
		expect(api.rack.includes(3)).toBe(true);
		expect(api.rack.join("-")).toBe("1-2-3");
		expect(await api.rack.slot()).toBe("rack.slot");
	});

	it("gives a lone primitive default the same node in both modes once loaded", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.count;
		expect(typeof api.count).toBe("object");
		expect(JSON.stringify(api.count)).toBe("7");
	});

	it("composes a frozen object default beside a sibling processed before it", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.ledger.describe()).toBe("ledger:3");
		expect(await api.ledger.aside()).toBe("ledger.aside");
	});

	it("keeps a default object's getter reading writes made through the node, with the sibling beside it", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.dial;
		expect(api.dial.double).toBe(2);
		api.dial.level = 5;
		expect(api.dial.level).toBe(5);
		expect(api.dial.double).toBe(10);
		expect(await api.dial.knob()).toBe("dial.knob");
	});

	it("keeps a callable Proxy default answering a member it does not hold, once loaded", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.probe(2)).toBe("probe:2");
		expect(api.probe.dyn).toBe("dyn");
	});
});
