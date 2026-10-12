/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-addapi-value-default.test.vitest.mjs
 *	@Date: 2026-10-11T20:30:00-07:00 (1791783000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T20:30:00-07:00 (1791783000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An `addapi` file composes as the file named after its level (#585 review).
 * @description
 * Rule 11 (F06 / C24) flattens an `addapi` file into the level it sits in, which is the promotion F01
 * (C05) gives a file named after its folder. Its default is therefore the node, as a self-named file's
 * is, with its named exports and sibling files beside it: a function default is callable, a Map keeps
 * working as a Map, and an array mounted with `api.add` keeps its elements. A getter keeps reading the
 * node's later writes and a Proxy keeps answering what its traps serve, as the plain value does.
 *
 * Fixture (`api_smart_flatten_addapi_value_default`):
 * ```
 * tool/addapi.mjs   default main(x) → "tool:x", extra() → "tool.extra"
 * tool/side.mjs     side() → "tool.side"
 * bag/addapi.mjs    default new Map([["a", 1]]), extra() → "bag.extra"
 * bag/side.mjs      side() → "bag.side"
 * list/addapi.mjs   default [1, 2, 3]   (mounted with api.add)
 * gauge/addapi.mjs  default { level: 1, get double() }   gauge/side.mjs  side()
 * scope/addapi.mjs  default Proxy answering `dyn`        scope/side.mjs  side()
 * meter/addapi.mjs  default { level: 1, get double() }   (alone; mounted with api.add)
 * lens/addapi.mjs   default Proxy answering `dyn`, extra() (alone; mounted with api.add)
 * ```
 * @module tests/vitests/suites/smart-flattening/smart-flattening-addapi-value-default
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_addapi_value_default");

describe.each(getMatrixConfigs())("addapi default as the node > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("calls a function default, with its named export and a sibling beside it", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.tool(7)).toBe("tool:7");
		expect(await api.tool.extra()).toBe("tool.extra");
		expect(await api.tool.side()).toBe("tool.side");
	});

	it("keeps a Map default working as a Map, with its named export beside it", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.bag.get("a")).toBe(1);
		await api.bag.set("b", 2);
		expect(await api.bag.size).toBe(2);
		expect(await api.bag.has("b")).toBe(true);
		expect(await api.bag.extra()).toBe("bag.extra");
	});

	it("keeps an array default's elements when its folder is mounted with api.add", async () => {
		api = await slothlet({ ...config, base: path.join(BASE, "tool") });
		await api.slothlet.api.add("list", path.join(BASE, "list"));
		expect(await api.list.length).toBe(3);
		expect(await api.list[0]).toBe(1);
		expect(await api.list.join("-")).toBe("1-2-3");
	});

	it("keeps a default object's getter reading writes made through the node, with a sibling beside it", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.gauge;
		expect(api.gauge.double).toBe(2);
		api.gauge.level = 5;
		expect(api.gauge.level).toBe(5);
		expect(api.gauge.double).toBe(10);
		expect(await api.gauge.side()).toBe("gauge.side");
	});

	it("keeps a Proxy default answering a member it does not hold, with a sibling beside it", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.scope;
		expect(api.scope.level).toBe(1);
		expect(api.scope.dyn).toBe("dyn");
		expect(await api.scope.side()).toBe("scope.side");
	});

	it("keeps a mounted default object's getter reading writes made through the node", async () => {
		api = await slothlet({ ...config, base: path.join(BASE, "tool") });
		await api.slothlet.api.add("meter", path.join(BASE, "meter"));
		await api.meter;
		expect(api.meter.double).toBe(2);
		api.meter.level = 5;
		expect(api.meter.double).toBe(10);
	});

	it("keeps a mounted Proxy default answering a member it does not hold, with its named export beside it", async () => {
		api = await slothlet({ ...config, base: path.join(BASE, "tool") });
		await api.slothlet.api.add("lens", path.join(BASE, "lens"));
		await api.lens;
		expect(api.lens.level).toBe(1);
		expect(api.lens.dyn).toBe("dyn");
		expect(await api.lens.extra()).toBe("lens.extra");
	});
});
