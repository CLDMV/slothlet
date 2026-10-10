/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-default-member-conflict.test.vitest.mjs
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
 * @fileoverview A named export conflicts with its default's member by one rule on every composition path.
 *
 * @description
 * The default has a member named `key` when `key` is its own property, enumerable or not, or comes from
 * a prototype the module defines (a class's method). Members of Object.prototype, Function.prototype and
 * Array.prototype are not the default's members. Under `merge` the default's member wins (#421).
 *
 * Fixture `api_smart_flatten_default_member_conflict` (the same three modules as plain files and as a
 * folder's same-named file):
 * ```
 * nonenum.mjs / folder/folder.mjs  default { visible, secret (non-enumerable) } + named secret, toString
 *   → secret = default's, toString = named, visible = default's
 * klass.mjs / inst/inst.mjs        default new Store() (add, own on the prototype) + named add, extra
 *   → add = default's, own = default's, extra = named
 * plain/fn.mjs / fnd/fnd.mjs       default function + named call, bind
 *   → call = named, bind = named
 * ```
 *
 * @module tests/vitests/suites/smart-flattening/smart-flattening-default-member-conflict
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_default_member_conflict");

describe.each(getMatrixConfigs({}))("default member vs named export > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each(["nonenum", "folder"])("%s: an own non-enumerable member is the default's; Object.prototype's toString is not", async (key) => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api[key].secret()).toBe("default.secret");
		expect(await api[key].toString()).toBe("named.toString");
		expect(await api[key].visible()).toBe("default.visible");
	});

	it.each(["klass", "inst"])("%s: a class instance's prototype methods are the default's members", async (key) => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api[key].add()).toBe("default.add");
		expect(await api[key].own()).toBe("default.own");
		expect(await api[key].extra()).toBe("named.extra");
	});

	it.each([
		["plain.fn", "fn"],
		["fnd", "fnd"]
	])("%s: Function.prototype's call and bind are not the function default's members", async (apiPath, name) => {
		api = await slothlet({ ...config, base: BASE });
		const node = apiPath.split(".").reduce((n, k) => n[k], api);
		expect(await node()).toBe(name);
		expect(await node.call()).toBe("named.call");
		expect(await node.bind()).toBe("named.bind");
	});
});

describe.each(getMatrixConfigs({}))("a named export winning over a read-only member > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each(["replace", "merge-replace", "warn"])("under %s, replaces the default's non-configurable read-only member", async (initial) => {
		api = await slothlet({ ...config, base: BASE, collision: { initial } });
		for (const key of ["nonenum", "folder"]) {
			expect(await api[key].secret()).toBe("named.secret");
			expect(await api[key].visible()).toBe("default.visible");
		}
	});
});

describe.each(getMatrixConfigs({}))("an api-root function default's members vs its named exports > Config: $name", ({ config }) => {
	const ROOT_BASE = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_default_member_conflict_root");
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each([
		["merge", "default"],
		["skip", "default"],
		["warn", "named"],
		["replace", "named"],
		["merge-replace", "named"]
	])("under %s, the %s member wins", async (initial, winner) => {
		api = await slothlet({ ...config, base: ROOT_BASE, collision: { initial }, silent: true });
		expect(await api()).toBe("root");
		expect(await api.tag()).toBe(`${winner}.tag`);
		expect(await api.fixed()).toBe(`${winner}.fixed`);
		expect(await api.extra()).toBe("named.extra");
	});

	it("under error, the conflict throws", async () => {
		await expect(slothlet({ ...config, base: ROOT_BASE, collision: { initial: "error" } })).rejects.toThrow(
			/COLLISION_DEFAULT_EXPORT_ERROR/
		);
	});
});
