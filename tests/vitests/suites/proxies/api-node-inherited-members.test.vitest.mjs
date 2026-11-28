/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/proxies/api-node-inherited-members.test.vitest.mjs
 *	@Date: 2026-11-22T12:43:28-08:00 (1795380208)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:50-08:00 (1795869170)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A member an api node's value inherits stays inherited (#913), and a module's `self` reports the
 * prototype the api root was given (#914), as the same reads of a plain object answer.
 * @description
 * An object a module exports may take its methods from a prototype: one made with `Object.create`, a class instance.
 * Reading or calling such a method through its node never makes it a member of the node's own: `Object.keys()` does not
 * list it, `Object.hasOwn()` is false, and once the object's prototype changes the node no longer has it. The same
 * method read twice is the same function.
 *
 * An object api root given another prototype (`Object.setPrototypeOf(api, proto)`) reports it to module code through
 * `self` as it does to the host through `api`, inside a call and inside a `run()` alike: the prototype itself with the
 * permission system off, a view of it the module is handed with it on. Each row's expected values are taken from a
 * plain object given the same prototype.
 * @module tests/vitests/suites/proxies/api-node-inherited-members
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_proto_members/host");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const PERMISSIONS = [
	{ name: "permissions off", permissions: null },
	{ name: "permissions on", permissions: { policy: "allow" } }
];
const matrix = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => PERMISSIONS.map((entry) => ({ mode, runtime, ...entry }))));

/**
 * The plain values the data module exports, made the same way.
 * @returns {{obj: object, inst: object}} Them.
 */
function plainData() {
	const base = {
		hello() {
			return "hi";
		},
		me() {
			return this;
		},
		shared: 5
	};
	const obj = Object.create(base);
	obj.own = 1;
	class Greeter {
		constructor() {
			this.own = 1;
		}
		hello() {
			return "hi";
		}
	}
	return { obj, inst: new Greeter() };
}

/**
 * Read and call an inherited method of a value, then give the value another prototype, answering what each step shows.
 * @param {object} value - A plain value, or the node standing for one.
 * @returns {object} What it showed.
 */
function observe(value) {
	const shown = { before: Object.keys(value) };
	shown.called = value.hello();
	shown.same = value.hello === value.hello;
	shown.after = [Object.keys(value), Object.hasOwn(value, "hello"), Object.getOwnPropertyDescriptor(value, "hello") === undefined];
	shown.listed = Reflect.ownKeys(value).includes("hello");
	shown.has = "hello" in value;
	const forIn = [];
	for (const name in value) forIn.push(name);
	shown.forIn = forIn;
	shown.json = JSON.stringify(value);
	shown.set = Reflect.setPrototypeOf(value, { other: 2 });
	shown.moved = ["hello" in value, value.hello, value.other, Object.keys(value)];
	return shown;
}

/**
 * What a plain object root reports of a prototype it was given, as the module's probe asks it of `self`.
 * @param {object} root - The plain root.
 * @param {object|null} prototype - The prototype it was given.
 * @returns {object} What it showed.
 */
function rootShown(root, prototype) {
	const reported = Object.getPrototypeOf(root);
	return {
		same: reported === prototype,
		stable: reported === Object.getPrototypeOf(root),
		kind: reported === Object.prototype ? "Object.prototype" : reported === null ? "null" : "other",
		reads: [
			reported?.inheritedRoot,
			root.inheritedRoot,
			"inheritedRoot" in root,
			typeof root.greet === "function" ? root.greet() : undefined
		],
		isPrototypeOf: reported === null ? null : Object.prototype.isPrototypeOf.call(reported, root)
	};
}

/**
 * A prototype for the root.
 * @returns {object} It.
 */
function makeRootPrototype() {
	return {
		inheritedRoot: 7,
		greet() {
			return "g";
		}
	};
}

describe.each(matrix)("inherited members of api nodes > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	let api;

	/**
	 * Build the instance and load the nodes the tests use.
	 * @returns {Promise<object>} The api.
	 */
	const build = async () => {
		api = await slothlet({ base: FIXTURE, silent: true, mode, runtime, ...(permissions ? { permissions } : {}) });
		for (const node of [api.data, api.data.obj, api.data.inst, api.probe]) await node;
		return api;
	};

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it.each(["obj", "inst"])("%s: a method read from its prototype is never made a member of the node's own (#913)", async (which) => {
		await build();
		expect(observe(api.data[which])).toEqual(observe(plainData()[which]));
	});

	it.each(["obj", "inst"])("%s: a module calling the method through self leaves it inherited too (#913)", async (which) => {
		await build();
		const plain = plainData()[which];
		const expected = { called: plain.hello(), keys: Object.keys(plain), own: Object.hasOwn(plain, "hello"), has: "hello" in plain };
		expect(await api.probe.callAndList(which)).toEqual(expected);
		expect(Object.keys(api.data[which])).toEqual(Object.keys(plain));
		expect(Object.hasOwn(api.data[which], "hello")).toBe(false);
	});

	it("api reports the prototype an object root was given, as a plain object does", async () => {
		await build();
		const prototype = makeRootPrototype();
		expect(Reflect.setPrototypeOf(api, prototype)).toBe(true);
		expect(Object.getPrototypeOf(api)).toBe(prototype);
		expect([api.inheritedRoot, "inheritedRoot" in api, api.greet()]).toEqual([7, true, "g"]);
	});

	it("a module's self reports the prototype the object root was given, in a call and in a run (#914)", async () => {
		await build();
		const plainFirst = rootShown({}, Object.prototype);
		expect({ ...(await api.probe.rootShown(Object.prototype)), same: true }).toEqual({ ...plainFirst, same: true });

		const prototype = makeRootPrototype();
		Object.setPrototypeOf(api, prototype);
		const plainRoot = Object.setPrototypeOf({}, prototype);
		// With the permission system on, a module is handed its own view of the prototype, never the object itself.
		const expected = { ...rootShown(plainRoot, prototype), same: !permissions };
		expect(await api.probe.rootShown(prototype)).toEqual(expected);
		expect(await api.slothlet.context.run({ in: "run" }, () => api.probe.rootShown(prototype))).toEqual(expected);

		Object.setPrototypeOf(api, null);
		const plainNone = Object.setPrototypeOf({}, null);
		expect(await api.probe.rootShown(null)).toEqual(rootShown(plainNone, null));
	});
});
