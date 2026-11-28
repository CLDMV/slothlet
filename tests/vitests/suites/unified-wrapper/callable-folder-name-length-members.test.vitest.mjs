/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/unified-wrapper/callable-folder-name-length-members.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:09-08:00 (1795869189)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * A callable folder's `name` and `length` subfolders are members once the folder has loaded, in lazy mode
 * as in eager (#1018). Lazy mode took the node's own answer (`"tool"`, `0`) for a first-loaded primitive
 * leaf and never assigned the subfolders.
 *
 * Fixture (`api_test_wrapper_prop_members_callable`), with its plain-JS twin:
 * ```
 * tool/tool.mjs            → api.tool()                 → "tool"
 * tool/name/set.mjs        → api.tool.name.set()        → "tool.name.set"
 * tool/length/get.mjs      → api.tool.length.get()      → "tool.length.get"
 * tool/prototype/get.mjs   → api.tool.prototype.get()   → "tool.prototype.get"
 * multi/…                  → the same, plus api.multi.other()
 * ```
 *
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * The plain-JS twin of a folder: its function, with the members defined over the function's own
 * `name`, `length` and `prototype`.
 * @param {string} folder - Folder name.
 * @param {string[]} [extra] - Other member names, each a function returning `<folder>.<name>`.
 * @returns {Function} The twin.
 */
function plainTwin(folder, extra = []) {
	const fn = { [folder]: () => folder }[folder];
	const members = {
		name: { set: () => `${folder}.name.set` },
		length: { get: () => `${folder}.length.get` },
		prototype: { get: () => `${folder}.prototype.get` }
	};
	for (const [key, value] of Object.entries(members)) {
		Object.defineProperty(fn, key, { value, writable: false, enumerable: true, configurable: true });
	}
	for (const key of extra) fn[key] = () => `${folder}.${key}`;
	return fn;
}

const PERMISSIONS = [
	["permissions off", {}],
	["permissions on", { permissions: { mode: "on", policy: "allow" } }]
];

const CONFIGS = getMatrixConfigs({ hook: { enabled: false } }).flatMap(({ name, config }) =>
	PERMISSIONS.map(([label, extra]) => ({ name: `${name} ${label}`, config: { ...config, ...extra } }))
);

describe.each(CONFIGS)("a callable folder's `name` and `length` members once it has loaded (#1018) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each([
		["tool", []],
		["multi", ["other"]]
	])("%s: reads each member as its plain-JS twin does", async (folder, extra) => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS_CALLABLE });
		await api[folder];
		const twin = plainTwin(folder, extra);
		const node = api[folder];
		for (const key of ["name", "length", "prototype"]) {
			expect(typeof node[key]).not.toBe("string");
			expect(typeof node[key]).not.toBe("number");
		}
		expect(await node.name.set()).toBe(twin.name.set());
		expect(await node.length.get()).toBe(twin.length.get());
		expect(await node.prototype.get()).toBe(twin.prototype.get());
		expect(await node()).toBe(twin());
	});

	it.each([
		["tool", []],
		["multi", ["other"]]
	])("%s: lists the same keys as its plain-JS twin", async (folder, extra) => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS_CALLABLE });
		await api[folder];
		expect(Object.keys(api[folder]).sort()).toEqual(Object.keys(plainTwin(folder, extra)).sort());
	});

	it("reads the members after a call loaded the folder", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_WRAPPER_PROP_MEMBERS_CALLABLE });
		expect(await api.tool()).toBe("tool");
		expect(await api.tool.name.set()).toBe("tool.name.set");
		expect(await api.tool.length.get()).toBe("tool.length.get");
	});
});
