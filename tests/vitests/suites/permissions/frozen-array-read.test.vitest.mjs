/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/frozen-array-read.test.vitest.mjs
 *	@Date: 2026-10-24T14:33:07-07:00 (1792877587)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-24T14:57:30-07:00 (1792879050)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A frozen array of objects a module holds reads as plain JS through `self`, with the permission
 * system on as with it off (#655).
 *
 * @description
 * Fixture `api_test_frozen_array_read`:
 * ```
 * store.mjs    list = Object.freeze([{ a: 1 }, { b: 2 }]), data = { list: <the same, frozen> }
 * reader.mjs   readAll(): index, spread, map, JSON.stringify, and the nested array's index and spread
 * ```
 * A frozen array's elements are fixed members, so every read must hand back exactly what the array holds.
 *
 * @module tests/vitests/suites/permissions/frozen-array-read
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const BASE = new URL("../../../../api_tests/api_test_frozen_array_read", import.meta.url).pathname;

const EXPECTED = {
	index: JSON.stringify({ a: 1 }),
	spread: JSON.stringify([{ a: 1 }, { b: 2 }]),
	map: JSON.stringify([{ a: 1 }, { b: 2 }]),
	stringify: JSON.stringify([{ a: 1 }, { b: 2 }]),
	nestedIndex: JSON.stringify({ b: 2 }),
	nestedSpread: JSON.stringify([{ a: 1 }, { b: 2 }])
};

describe.each(getMatrixConfigs({}))("frozen array read (#655) > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each([
		["on", { permissions: { defaultPolicy: "allow" } }],
		["off", {}]
	])("another module reads a frozen array of objects as plain JS (permissions %s)", async (_label, options) => {
		api = await slothlet({ ...config, base: BASE, silent: true, ...options });
		expect(await api.reader.readAll()).toEqual(EXPECTED);
	});
});
