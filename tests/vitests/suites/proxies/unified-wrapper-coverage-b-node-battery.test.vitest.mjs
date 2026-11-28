/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/proxies/unified-wrapper-coverage-b-node-battery.test.vitest.mjs
 *	@Date: 2026-11-25T01:44:38-08:00 (1795599878)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:56-08:00 (1795869176)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Reflection and integrity operations on api nodes answer as the same operations on the module's plain
 * value answer.
 *
 * @description
 * Fixture `api_test_uwb_shapes`:
 * ```
 * arr.mjs      default [1, { two: 2 }, "three"]
 * obj.mjs      data, num, hello(), conf = { get g / set g, v }   (conf: a module's own object holding an accessor)
 * inst.mjs     default new Counter()      (a class instance)
 * folder/      a.mjs ping(), b.mjs value
 * ```
 * One battery (keys and descriptors, defining data, accessor and fixed members, deleting, setting, prototype reads and
 * writes, seal and freeze, then the same reads, writes and redefinitions on the closed value) runs on each node and on the plain
 * twin of the same module, imported directly. Every answer has to match. Keys listed after the value is closed are
 * compared as sorted string keys: the node's own inspect hook stays on its closed shell (reported separately).
 *
 * @module tests/vitests/suites/proxies/unified-wrapper-coverage-b-node-battery
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_uwb_shapes", import.meta.url).pathname;

/**
 * The module's value imported as a plain module, fresh each call: what plain JavaScript holds.
 * @param {string} name - The node's name.
 * @returns {Promise<*>} The plain value.
 */
async function plainOf(name) {
	const fresh = `?plain=${Math.random()}`;
	if (name === "folder") {
		const a = await import(`${BASE}/folder/a.mjs${fresh}`);
		const b = await import(`${BASE}/folder/b.mjs${fresh}`);
		return { a: { ...a }, b: { ...b } };
	}
	if (name === "conf") return (await import(`${BASE}/obj.mjs${fresh}`)).conf;
	const module = await import(`${BASE}/${name}.mjs${fresh}`);
	return name === "obj" ? { ...module } : module.default;
}

/**
 * Run the operations on a value, each answer normalized so a node and a plain value compare.
 * @param {*} n - The value.
 * @returns {Array<[string, *]>} Each operation's name and answer.
 */
function battery(n) {
	const log = [];
	const norm = (r) =>
		r === null ? "null" : typeof r === "function" ? "fn" : typeof r === "object" ? "obj" : typeof r === "symbol" ? "sym" : r;
	const t = (name, f) => {
		try {
			log.push([name, norm(f())]);
		} catch (e) {
			log.push([name, "ERR " + (e?.code || e?.constructor?.name)]);
		}
	};
	const dsc = (d) =>
		d === undefined
			? "undef"
			: Object.keys(d).sort().join(",") +
				"|" +
				("value" in d ? norm(d.value) : "acc") +
				(d.writable ? "w" : "") +
				(d.enumerable ? "e" : "") +
				(d.configurable ? "c" : "");
	t("keys", () => Reflect.ownKeys(n).map(String).join(","));
	for (const k of Reflect.ownKeys(n)) t("desc " + String(k), () => dsc(Object.getOwnPropertyDescriptor(n, k)));
	t("define data", () => Reflect.defineProperty(n, "dd", { value: 1, writable: true, configurable: true, enumerable: true }));
	t("define acc", () => Reflect.defineProperty(n, "acc", { get: () => 2, set: () => {}, configurable: true, enumerable: true }));
	t("read acc", () => n.acc);
	t("set acc", () => Reflect.set(n, "acc", 5));
	t("define nc", () => Reflect.defineProperty(n, "nc", { value: 3, writable: false, configurable: false }));
	t("redefine nc", () => Reflect.defineProperty(n, "nc", { value: 3, writable: false, configurable: false }));
	t("redefine nc2", () => Reflect.defineProperty(n, "nc", { value: 4 }));
	t("delete dd", () => Reflect.deleteProperty(n, "dd"));
	t("delete nc", () => Reflect.deleteProperty(n, "nc"));
	t("set new", () => Reflect.set(n, "newKey", { z: 1 }));
	t("set idx", () => Reflect.set(n, "0", 9));
	t("set length", () => Reflect.set(n, "length", 2));
	t("has", () => "newKey" in n);
	t("setproto same", () => Reflect.setPrototypeOf(n, Object.getPrototypeOf(n)));
	t("call", () => n(2));
	t("new", () => typeof new n(2));
	t("delete acc", () => Reflect.deleteProperty(n, "acc"));
	t("json", () => JSON.stringify(n));
	t("seal", () => Reflect.preventExtensions(Object.seal(n)));
	t("isSealed", () => Object.isSealed(n));
	t("set after seal", () => Reflect.set(n, "another", 1));
	t("define after seal", () => Reflect.defineProperty(n, "dd", { value: 7 }));
	t("define new after seal", () => Reflect.defineProperty(n, "zz", { value: 7 }));
	t("freeze", () => Object.isFrozen(Object.freeze(n)));
	t("keys after", () =>
		Reflect.ownKeys(n)
			.filter((k) => typeof k === "string")
			.sort()
			.join(",")
	);
	for (const k of Reflect.ownKeys(n)
		.filter((k) => typeof k === "string")
		.sort())
		t("desc2 " + String(k), () => dsc(Object.getOwnPropertyDescriptor(n, k)));
	const firstKey = Reflect.ownKeys(n).filter((k) => typeof k === "string")[0];
	t("frozen define configurable", () => Reflect.defineProperty(n, firstKey, { configurable: true }));
	t("frozen define enumerable flip", () =>
		Reflect.defineProperty(n, firstKey, { enumerable: !Object.getOwnPropertyDescriptor(n, firstKey).enumerable })
	);
	t("frozen define accessor", () => Reflect.defineProperty(n, firstKey, { get: () => 1 }));
	t("frozen define empty", () => Reflect.defineProperty(n, firstKey, {}));
	t("frozen define same attrs", () => Reflect.defineProperty(n, firstKey, { writable: false, configurable: false }));
	t("frozen define writable", () => Reflect.defineProperty(n, firstKey, { writable: true }));
	t("set frozen", () => Reflect.set(n, "dd", 8));
	t("setproto frozen", () => Reflect.setPrototypeOf(n, {}));
	t("setproto frozen same", () => Reflect.setPrototypeOf(n, Object.getPrototypeOf(n)));
	t("delete frozen", () => Reflect.deleteProperty(n, "dd"));
	t("isExtensible", () => Reflect.isExtensible(n));
	return log;
}

const MATRIX = ["eager", "lazy"].flatMap((mode) => [
	{ mode, name: "permissions on", permissions: { policy: "allow" } },
	{ mode, name: "permissions off", permissions: null }
]);

describe.each(MATRIX)("node operations against the plain value > $mode / $name", ({ mode, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it.each([["arr"], ["obj"], ["inst"], ["folder"], ["conf"]])("%s answers as its plain value", async (name) => {
		api = await slothlet({ mode, base: BASE, silent: true, ...(permissions ? { permissions } : {}) });
		if (mode === "lazy") await api[name === "conf" ? "obj" : name];
		const node = name === "conf" ? api.obj.conf : api[name];
		expect(battery(node)).toEqual(battery(await plainOf(name)));
	});
});
