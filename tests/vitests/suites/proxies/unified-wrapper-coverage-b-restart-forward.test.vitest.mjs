/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/unified-wrapper-coverage-b-restart-forward.test.vitest.mjs
 *	@Date: 2026-11-25T02:02:16-08:00 (1795600936)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:16:03-08:00 (1795601763)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview References held across `restart()` forward to the live nodes and keep the shape they were closed in;
 * a definition repeating a member's value keeps its node.
 *
 * @description
 * Fixture `api_test_uwb_shapes` (`folder/`, `arr.mjs`, `obj.mjs`). A folder node sealed and an array node closed to new
 * members before the restart keep refusing new keys afterwards, as the sealed objects they were; the object node,
 * left open, takes a fixed member and then refuses to change or delete it, as an object does. Keys are compared as
 * sorted string keys (a closed node's own inspect hook stays on its shell, and is reported separately).
 *
 * @module tests/vitests/suites/proxies/unified-wrapper-coverage-b-restart-forward
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_uwb_shapes", import.meta.url).pathname;

/**
 * A value's own string keys, sorted.
 * @param {object} value - The value.
 * @returns {string[]} The keys.
 */
const stringKeys = (value) =>
	Reflect.ownKeys(value)
		.filter((key) => typeof key === "string")
		.sort();

describe.each([["eager"], ["lazy"]])("references held across restart (%s)", (mode) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("answer definitions, deletions and key listings as the plain values would", async () => {
		api = await slothlet({ mode, base: BASE, silent: true });
		if (mode === "lazy") {
			await api.folder;
			await api.arr;
			await api.obj;
		}
		const folder = api.folder;
		const arr = api.arr;
		const obj = api.obj;
		Object.seal(folder);
		Object.preventExtensions(arr);
		await api.slothlet.restart();

		expect(Reflect.defineProperty(folder, "fresh", { value: 1, configurable: true })).toBe(false);
		expect(Reflect.defineProperty(arr, "0", { value: 5 })).toBe(true);
		expect(stringKeys(arr)).toEqual(["0", "1", "2", "length"]);
		expect(Reflect.defineProperty(obj, "nc", { value: 1, configurable: false, writable: false })).toBe(true);
		expect(Reflect.defineProperty(obj, "nc", { value: 2 })).toBe(false);
		expect(stringKeys(obj)).toEqual(["conf", "data", "hello", "nc", "num"]);
		expect(Reflect.deleteProperty(obj, "nc")).toBe(false);
		expect("nc" in obj).toBe(true);
		expect(obj.nc).toBe(1);
	});

	it("a definition with the object a member already holds keeps that member's node", async () => {
		api = await slothlet({ mode, base: BASE, silent: true });
		if (mode === "lazy") await api.obj;
		const value = { x: 1 };
		api.obj.held = value;
		const before = api.obj.held;
		expect(Reflect.defineProperty(api.obj, "held", { value, writable: true, enumerable: true, configurable: true })).toBe(true);
		expect(api.obj.held).toBe(before);
		expect(api.obj.held.x).toBe(1);
		expect(api.slothlet.same(api.obj.held, value)).toBe(true);
	});
});
