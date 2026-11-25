/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hook-pattern-builtin-names.test.vitest.mjs
 *	@Date: 2026-11-25T08:34:19-08:00 (1795624459)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T08:59:34-08:00 (1795625974)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Hook patterns that share a name with a built-in object member (`constructor`, `toString`, `valueOf`,
 * `hasOwnProperty`, `__proto__`) are stored, listed and removed like any other pattern.
 *
 * @description
 * The hook index is keyed by pattern. Read through an ordinary object, such a pattern found the inherited member
 * instead of an empty slot: the hook was written onto that shared value rather than into the index, `remove({ id })`
 * reported the index as corrupt, and `remove({ pattern })` miscounted.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const NAMES = ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"];

/** The shared values a misplaced hook would land on. */
const SHARED = [Object, Function, Object.prototype, Function.prototype, ...NAMES.map((name) => Object.prototype[name]).filter((v) => v)];

/** Own keys of every shared value, to check none was added. */
const ownKeys = () => SHARED.map((value) => Reflect.ownKeys(value).map(String).sort());

describe.each(getMatrixConfigs())("hook patterns named like built-in members > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each(NAMES)("pattern %j registers, lists and removes by id", async (name) => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, silent: true });
		const before = ownKeys();
		const id = api.slothlet.hook.on(`${name}:before`, () => {});
		expect(ownKeys()).toEqual(before);
		expect({}[0]).toBeUndefined();
		expect(api.slothlet.hook.list({ pattern: name }).registeredHooks.map((h) => h.id)).toEqual([id]);
		expect(api.slothlet.hook.remove({ id })).toBe(1);
		expect(api.slothlet.hook.list({ pattern: name }).registeredHooks).toEqual([]);
		expect(ownKeys()).toEqual(before);
	});

	it.each(NAMES)("pattern %j removes by pattern with an exact count", async (name) => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, silent: true });
		api.slothlet.hook.on(`${name}:before`, () => {});
		api.slothlet.hook.on(`${name}:after`, () => {});
		expect(api.slothlet.hook.remove({ pattern: name })).toBe(2);
		expect(api.slothlet.hook.list({ pattern: name }).registeredHooks).toEqual([]);
	});

	it("an unregistered built-in name removes nothing", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, silent: true });
		for (const name of NAMES) expect(api.slothlet.hook.remove({ pattern: name })).toBe(0);
		expect(api.slothlet.hook.list({ pattern: "toString" }).registeredHooks).toEqual([]);
	});
});
