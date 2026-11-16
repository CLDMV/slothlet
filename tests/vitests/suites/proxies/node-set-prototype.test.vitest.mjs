/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/node-set-prototype.test.vitest.mjs
 *	@Date: 2026-11-15T11:55:23-08:00 (1794772523)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T01:52:39-08:00 (1794822759)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `Object.setPrototypeOf` on an api node changes what the node reports and inherits from, as on a plain
 * value, never a `true` that changes nothing (#802).
 * @description
 * Every node holds a prototype. A node a module's own value backs as it is (an emitter, a class instance) has that
 * value's, and takes a new one on the value, as setting it on the value itself does: the module sees its value changed.
 * A function node has its function's and a namespace slothlet composed has `Object.prototype`, each kept on the node's
 * own record: a new one is taken there, so the module's function is never changed through the node. The node reports
 * it (`Object.getPrototypeOf`, `__proto__`), reads and lists what it inherits (`node.x`, `in`, `for…in`), and closes
 * with it, as the same operations on a plain object or function answer (each row's expected values are taken from
 * that plain twin). The record is the node's value's: a reload or an add that gives the node a value gives it that
 * value's prototype, and a removed node is gone with it. A lazy node that has not loaded refuses a prototype.
 * Module code meets the node's write rules first, whatever the answer would be: a module that does not own the node is
 * refused with `LOOSE_SET_NOT_OWNED` when the permission system is on. A member the node inherits is read under the
 * rules a member of its own by that name is read under.
 * @module tests/vitests/suites/proxies/node-set-prototype
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { EventEmitter } from "node:events";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_node_set_prototype");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const PERMISSIONS = [
	{ name: "permissions off", permissions: null },
	{ name: "permissions on, precise", permissions: { defaultPolicy: "allow", attribution: "precise" } },
	{ name: "permissions on, fast", permissions: { defaultPolicy: "allow", attribution: "fast" } }
];
const matrix = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => PERMISSIONS.map((entry) => ({ mode, runtime, ...entry }))));

/** A symbol key a prototype holds a member under. */
const SYMBOL = Symbol.for("slothlet-node-set-prototype");

/**
 * Run a change, answering how it went.
 * @param {function(): *} change - The change.
 * @returns {string} `"done"`, `"refused"` when it answered false, or the code or name of what it threw.
 */
function attempt(change) {
	try {
		return change() === false ? "refused" : "done";
	} catch (error) {
		return error?.code ?? error?.name ?? "threw";
	}
}

/**
 * A prototype holding data, an object, a getter, methods and a symbol-keyed member, and one member under a name the
 * value it is given to holds itself.
 * @param {string} ownName - A name the value holds.
 * @returns {object} The prototype.
 */
function makePrototype(ownName) {
	return {
		inherited: 5,
		settings: { depth: 1 },
		get viaThis() {
			return this.inherited + 1;
		},
		hello() {
			return "hi";
		},
		me() {
			return this;
		},
		[SYMBOL]: 7,
		[ownName]: "shadowed"
	};
}

/**
 * The names `for…in` lists that the value does not hold itself.
 * @param {object|Function} value - The value.
 * @returns {string[]} The inherited names.
 */
function inheritedNames(value) {
	const own = Object.keys(value);
	const names = [];
	for (const name in value) if (!own.includes(name)) names.push(name);
	return names;
}

/**
 * A prototype by the name the language gives it, for a comparison across two values.
 * @param {*} prototype - The prototype.
 * @returns {string} Its name.
 */
function named(prototype) {
	if (prototype === Object.prototype) return "Object.prototype";
	if (prototype === Function.prototype) return "Function.prototype";
	return prototype === null ? "null" : "other";
}

/**
 * Give a value a prototype, then none, then its first one back, answering what each step shows.
 * @param {object|Function} value - A plain value, or the node standing for one.
 * @param {string} ownName - A name the value holds itself.
 * @returns {object} What it showed.
 */
function observe(value, ownName) {
	const prototype = makePrototype(ownName);
	const first = Object.getPrototypeOf(value);
	const own = Object.keys(value);
	const shown = {
		first: named(first),
		firstDunder: value.__proto__ === first,
		firstInstance: [value instanceof Object, value instanceof Function]
	};
	shown.set = Reflect.setPrototypeOf(value, prototype);
	shown.reported = [
		Object.getPrototypeOf(value) === prototype,
		value.__proto__ === prototype,
		Object.prototype.isPrototypeOf.call(prototype, value)
	];
	shown.data = [value.inherited, value.settings.depth, value.viaThis, value[SYMBOL]];
	shown.method = [value.hello(), value.me() === value];
	shown.has = ["inherited" in value, "hello" in value, SYMBOL in value, "missing" in value, "toString" in value];
	shown.ownWins = [typeof value[ownName], value[ownName] === "shadowed"];
	shown.notOwn = [
		Object.keys(value).join() === own.join(),
		Object.hasOwn(value, "inherited"),
		Object.getOwnPropertyDescriptor(value, "hello") === undefined,
		Reflect.ownKeys(value).includes(SYMBOL)
	];
	shown.forIn = inheritedNames(value).filter((name) => name !== ownName);
	shown.kind = [value instanceof Object, value instanceof Function, typeof value.toString, typeof value.call, String(value) === ""];
	shown.again = Reflect.setPrototypeOf(value, prototype);
	shown.setNull = Reflect.setPrototypeOf(value, null);
	shown.none = [
		Object.getPrototypeOf(value),
		value.__proto__,
		value.inherited,
		value.toString,
		value.constructor,
		value.call,
		"toString" in value,
		"inherited" in value,
		value instanceof Object,
		value instanceof Function,
		inheritedNames(value)
	];
	shown.setBack = Reflect.setPrototypeOf(value, first);
	shown.back = [named(Object.getPrototypeOf(value)), value.inherited, typeof value.toString, typeof value.call, value instanceof Object];
	return shown;
}

/**
 * Give a value a prototype and close it, answering what the closed value shows and takes.
 * @param {object|Function} value - A plain value, or the node standing for one.
 * @param {"seal"|"freeze"|"preventExtensions"} how - How it is closed.
 * @returns {object} What it showed.
 */
function observeClosed(value, how) {
	const prototype = makePrototype("none");
	Object.setPrototypeOf(value, prototype);
	Object[how](value);
	// A closed node reports a checked view of the prototype it was given, to the host too, so the two are compared by
	// what the reported prototype holds rather than by identity.
	return {
		reported: [Object.getPrototypeOf(value).inherited, value.__proto__.inherited, Object.getPrototypeOf(value) === value.__proto__],
		reads: [value.inherited, value.hello(), "inherited" in value, inheritedNames(value)],
		another: [Reflect.setPrototypeOf(value, {}), Reflect.setPrototypeOf(value, null), attempt(() => Object.setPrototypeOf(value, {}))],
		same: Reflect.setPrototypeOf(value, Object.getPrototypeOf(value)),
		still: [Object.getPrototypeOf(value).inherited, value.inherited]
	};
}

/**
 * Close a value that was given no prototype, answering what it takes afterwards.
 * @param {object|Function} value - A plain value, or the node standing for one.
 * @param {"seal"|"freeze"|"preventExtensions"} how - How it is closed.
 * @returns {object} What it showed.
 */
function observeClosedFirst(value, how) {
	const first = Object.getPrototypeOf(value);
	Object[how](value);
	return {
		reported: named(Object.getPrototypeOf(value)),
		another: [Reflect.setPrototypeOf(value, { inherited: 5 }), Reflect.setPrototypeOf(value, null)],
		same: Reflect.setPrototypeOf(value, first),
		still: [Object.getPrototypeOf(value) === first, value.inherited, typeof value.toString]
	};
}

/**
 * The nodes whose prototype is kept on the node, each with a plain value of its kind and a name both hold.
 * @type {Array<{label: string, node: function(object): *, plain: function(): *, ownName: string, call: string|null}>}
 */
const NODES = [
	{
		label: "a file's namespace",
		node: (api) => api.leaf,
		plain: () => ({ only() {}, untouched() {} }),
		ownName: "untouched",
		call: null
	},
	{
		label: "a folder's namespace",
		node: (api) => api.sub,
		plain: () => ({ lay() {}, other: {} }),
		ownName: "other",
		call: null
	},
	{
		label: "a function leaf",
		node: (api) => api.leaf.only,
		plain: () =>
			function only() {
				return "only";
			},
		ownName: "name",
		call: "only"
	},
	{
		label: "a folder that is its file's function",
		node: (api) => api.grp,
		plain: () =>
			function fn() {
				return "fn";
			},
		ownName: "name",
		call: "fn"
	},
	{
		label: "a function with named exports beside it",
		node: (api) => api.sub.lay,
		plain: () =>
			Object.assign(
				function lay() {
					return "lay";
				},
				{ side: 1, untouched() {} }
			),
		ownName: "side",
		call: "lay"
	}
];

describe.each(matrix)("setPrototypeOf on an api node > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	let api;

	/**
	 * Build the instance, with the reader module added, and load every node the tests use.
	 * @param {object} [overrides] - Permission settings over the config's.
	 * @returns {Promise<object>} The api.
	 */
	const build = async (overrides) => {
		const settings = permissions || overrides ? { permissions: { ...permissions, ...overrides } } : {};
		api = await slothlet({ base: join(FIXTURE, "host"), silent: true, mode, runtime, ...settings });
		await api.slothlet.api.add("reader", join(FIXTURE, "reader"), { moduleID: "reader" });
		for (const node of [api.leaf, api.leaf.only, api.grp, api.sub, api.sub.lay, api.sub.other, api.ev, api.ev.em, api.ev.inst, api.reader])
			await node;
		return api;
	};

	/**
	 * Add the `extra` module and load its nodes.
	 * @returns {Promise<void>}
	 */
	const addExtra = async () => {
		await api.slothlet.api.add("extra", join(FIXTURE, "extra"), { moduleID: "extra" });
		for (const node of [api.extra, api.extra.tool, api.extra.tool.run, api.extra.data]) await node;
	};

	/**
	 * What the `extra` module's nodes inherit now: the folder's namespace, the file's namespace and the function leaf.
	 * @returns {Array<number|undefined>} Each node's `inherited`.
	 */
	const extraInherits = () => [api.extra.inherited, api.extra.tool.inherited, api.extra.tool.run.inherited];

	/**
	 * Give each of the `extra` module's nodes a prototype.
	 * @param {object} prototype - The prototype.
	 * @returns {boolean[]} Whether each took it.
	 */
	const setExtra = (prototype) => [api.extra, api.extra.tool, api.extra.tool.run].map((node) => Reflect.setPrototypeOf(node, prototype));

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it.each(NODES)("$label takes, reports and inherits from a prototype as its plain twin does", async ({ node, plain, ownName, call }) => {
		await build();
		expect(observe(node(api), ownName)).toEqual(observe(plain(), ownName));
		// The node still calls, and the module's own function kept its prototype.
		// (A lazy namespace is `typeof "function"` whatever its prototype, so `typeof` is compared for function nodes only.)
		if (call) expect(typeof node(api)).toBe(typeof plain());
		if (call) expect(await node(api)()).toBe(call);
		expect(await api.leaf.untouched()).toBe(true);
		expect(await api.sub.lay.untouched()).toBe(true);
	});

	it.each(NODES)("$label reports the prototype it was given once it is closed, and then takes no other", async ({ node, plain }) => {
		for (const how of ["seal", "freeze", "preventExtensions"]) {
			await build();
			expect(observeClosed(node(api), how), how).toEqual(observeClosed(plain(), how));
			await api.shutdown();
		}
		api = null;
	});

	it.each(NODES)("$label closed with the prototype it was built with takes no other", async ({ node, plain }) => {
		for (const how of ["seal", "freeze", "preventExtensions"]) {
			await build();
			expect(observeClosedFirst(node(api), how), how).toEqual(observeClosedFirst(plain(), how));
			await api.shutdown();
		}
		api = null;
	});

	it("a prototype goes with the value a reload or a later add gives the node, and stays through a reload elsewhere", async () => {
		await build();
		await addExtra();
		const prototype = { inherited: 5 };
		expect(setExtra(prototype)).toEqual([true, true, true]);
		expect(extraInherits()).toEqual([5, 5, 5]);
		// A reload of another module's path gives these nodes no new value.
		await api.slothlet.api.reload("leaf");
		expect(extraInherits()).toEqual([5, 5, 5]);
		// A reload of the module gives each node its value again, and with it that value's prototype.
		await api.slothlet.api.reload("extra");
		for (const loaded of [api.extra, api.extra.tool, api.extra.tool.run]) await loaded;
		expect(extraInherits()).toEqual([undefined, undefined, undefined]);
		expect(Object.getPrototypeOf(api.extra)).toBe(Object.prototype);
		expect(Object.getPrototypeOf(api.extra.tool.run)).toBe(Function.prototype);
		// So does an add that replaces what is there.
		expect(setExtra(prototype)).toEqual([true, true, true]);
		await api.slothlet.api.add("extra", join(FIXTURE, "over"), { moduleID: "over", forceOverwrite: true });
		for (const loaded of [api.extra, api.extra.tool, api.extra.tool.run]) await loaded;
		expect(await api.extra.tool.run()).toBe("over");
		expect(extraInherits()).toEqual([undefined, undefined, undefined]);
		// And a full reload.
		expect(setExtra(prototype)).toEqual([true, true, true]);
		await api.slothlet.reload();
		for (const loaded of [api.extra, api.extra.tool, api.extra.tool.run]) await loaded;
		expect(extraInherits()).toEqual([undefined, undefined, undefined]);
	});

	it("a removed node's prototype is gone with it: the same path added again starts with its value's own", async () => {
		await build();
		await addExtra();
		expect(setExtra({ inherited: 5 })).toEqual([true, true, true]);
		await api.slothlet.api.remove("extra");
		expect("extra" in api).toBe(false);
		await addExtra();
		expect(extraInherits()).toEqual([undefined, undefined, undefined]);
		expect(Object.getPrototypeOf(api.extra)).toBe(Object.prototype);
		expect(Object.getPrototypeOf(api.extra.tool)).toBe(Object.prototype);
		expect(Object.getPrototypeOf(api.extra.tool.run)).toBe(Function.prototype);
	});

	it.runIf(mode === "lazy")("a lazy node that has not loaded refuses a prototype, and takes it once loaded", async () => {
		api = await slothlet({ base: join(FIXTURE, "host"), silent: true, mode, runtime, ...(permissions ? { permissions } : {}) });
		const prototype = { inherited: 5 };
		expect(api.sub.__materialized).toBe(false);
		expect(Reflect.setPrototypeOf(api.sub, prototype)).toBe(false);
		await api.sub;
		expect(Reflect.setPrototypeOf(api.sub, prototype)).toBe(true);
		expect(api.sub.inherited).toBe(5);
	});

	it("an emitter a module holds takes the prototype on the module's emitter, and inherits from it", async () => {
		await build();
		const prototype = Object.create(EventEmitter.prototype, { inherited: { value: 5 } });
		expect(Reflect.setPrototypeOf(api.ev.em, prototype)).toBe(true);
		expect(Object.getPrototypeOf(api.ev.em)).toBe(prototype);
		expect(api.ev.em.inherited).toBe(5);
		expect(api.ev.em instanceof EventEmitter).toBe(true);
		expect((await api.ev.prototypes()).em).toBe(prototype);
	});

	it("a class instance a module holds takes the prototype on the module's instance, and inherits from it", async () => {
		await build();
		const prototype = { inherited: 5 };
		expect(Reflect.setPrototypeOf(api.ev.inst, prototype)).toBe(true);
		expect(Object.getPrototypeOf(api.ev.inst)).toBe(prototype);
		expect(api.ev.inst.inherited).toBe(5);
		expect((await api.ev.prototypes()).inst).toBe(prototype);
	});

	it("the owning module's code changes its own values' and nodes' prototypes, and its functions keep theirs", async () => {
		await build();
		const prototype = { inherited: 5 };
		expect(await api.ev.change("em", prototype)).toBe("done");
		expect(await api.ev.change("inst", prototype)).toBe("done");
		expect(await api.ev.change("leaf", prototype)).toBe("done");
		expect(await api.ev.change("grp", prototype)).toBe("done");
		expect(await api.ev.change("lay", prototype)).toBe("done");
		expect(await api.ev.change("ns", prototype)).toBe("done");
		const held = await api.ev.prototypes();
		expect(held.em).toBe(prototype);
		expect(held.inst).toBe(prototype);
		for (const node of [api.leaf.only, api.grp, api.sub.lay, api.ev]) {
			expect(Object.getPrototypeOf(node)).toBe(prototype);
			expect(node.inherited).toBe(5);
		}
		expect(await api.ev.read("inherited")).toBe(5);
		expect(await api.leaf.untouched()).toBe(true);
		expect(await api.sub.lay.untouched()).toBe(true);
	});

	it("a module is handed the prototype itself with the permission system off or disabled, and its own view of it with it on", async () => {
		const prototype = { inherited: 5 };
		for (const overrides of permissions ? [undefined] : [undefined, { mode: "disabled" }]) {
			await build(overrides);
			for (const path of ["ev", "leaf.only", "sub.lay"]) {
				const node = path.split(".").reduce((holder, key) => holder[key], api);
				Object.setPrototypeOf(node, prototype);
				expect(Object.getPrototypeOf(node)).toBe(prototype);
				const shown = await api.reader.listed(path, prototype, ["inherited"]);
				expect([shown.same, shown.stable, shown.keys, shown.has]).toEqual([!permissions, true, ["inherited"], [true]]);
				expect(await api.reader.read(path, "inherited", 1)).toBe(5);
			}
			await api.shutdown();
		}
		api = null;
	});

	it("another module's code meets the node's write rules first", async () => {
		await build();
		const before = await api.ev.prototypes();
		const answers = {};
		for (const which of ["em", "inst", "leaf", "grp", "lay", "ns"]) answers[which] = await api.reader.change(which);
		if (permissions) {
			expect(answers).toEqual({
				em: "LOOSE_SET_NOT_OWNED",
				inst: "LOOSE_SET_NOT_OWNED",
				leaf: "LOOSE_SET_NOT_OWNED",
				grp: "LOOSE_SET_NOT_OWNED",
				lay: "LOOSE_SET_NOT_OWNED",
				ns: "LOOSE_SET_NOT_OWNED"
			});
			expect(await api.ev.prototypes()).toEqual(before);
			for (const node of [api.leaf.only, api.grp, api.sub.lay]) expect(Object.getPrototypeOf(node)).toBe(Function.prototype);
			expect(Object.getPrototypeOf(api.ev)).toBe(Object.prototype);
			expect(api.ev.theirs).toBeUndefined();
		} else {
			expect(answers).toEqual({ em: "done", inst: "done", leaf: "done", grp: "done", lay: "done", ns: "done" });
			const after = await api.ev.prototypes();
			expect(after.em).toEqual({ theirs: true });
			expect(after.inst).toEqual({ theirs: true });
			for (const node of [api.leaf.only, api.grp, api.sub.lay, api.ev]) expect(node.theirs).toBe(true);
		}
		expect(await api.leaf.untouched()).toBe(true);
		expect(await api.sub.lay.untouched()).toBe(true);
	});

	describe.runIf(permissions)('under `defaultPolicy: "deny"`', () => {
		/** The nodes given a prototype, by path. */
		const PATHS = ["ev", "leaf.only", "sub.lay"];
		/** Rules letting one leaf of the reader read one inherited and one own data member, and call one of each. */
		const rules = PATHS.flatMap((path) => [
			{ caller: "reader.read", target: `${path}.inherited`, effect: "allow" },
			{ caller: "reader.read", target: `${path}.ownData`, effect: "allow" },
			{ caller: "reader.call", target: `${path}.hello`, effect: "allow" },
			{ caller: "reader.call", target: `${path}.ownHello`, effect: "allow" },
			{ caller: "reader.listed", target: `${path}.inherited`, effect: "allow" },
			{ caller: "reader.viewKeys", target: `${path}.inherited`, effect: "allow" },
			// A closed function node lists its function's own members only to a module that may call it.
			{ caller: "reader.listed", target: path, effect: "allow" },
			{ caller: "reader.read", target: `${path}.deepRuled`, effect: "allow" },
			{ caller: "reader.listed", target: `${path}.deepRuled`, effect: "allow" },
			// One leaf of an object member, inherited and own, and nothing beneath the other.
			{ caller: "reader.objectListing", target: `${path}.partly.a`, effect: "allow" },
			{ caller: "reader.objectListing", target: `${path}.ownPartly.a`, effect: "allow" }
		]);
		/**
		 * The node at a dotted path.
		 * @param {string} path - The path.
		 * @returns {*} The node.
		 */
		const at = (path) => path.split(".").reduce((node, key) => node[key], api);

		it.each(PATHS)("%s: an inherited member is read and called under the rules a member of the node's own is", async (path) => {
			await build({ defaultPolicy: "deny", rules });
			const prototype = {
				inherited: 5,
				unruled: 6,
				hello() {
					return "hi";
				},
				bye() {
					return "bye";
				}
			};
			const node = at(path);
			expect(Reflect.setPrototypeOf(node, prototype)).toBe(true);
			// The same members, held by the node itself.
			node.ownData = 5;
			node.ownUnruled = 6;
			node.ownHello = () => "hi";
			node.ownBye = () => "bye";
			// The host reads everything.
			expect([node.inherited, node.unruled, node.hello(), node.bye()]).toEqual([5, 6, "hi", "bye"]);
			// The leaf a rule names reads the data member; without a rule, and for another leaf, the read is refused.
			expect(await api.reader.read(path, "inherited")).toBe(5);
			expect(await api.reader.read(path, "unruled")).toEqual({ threw: "PERMISSION_DENIED" });
			expect(await api.reader.peek(path, "inherited")).toEqual({ threw: "PERMISSION_DENIED" });
			// An inherited function is called under the rule for its name at the node.
			expect(await api.reader.call(path, "hello")).toBe("hi");
			expect(await api.reader.call(path, "bye")).toEqual({ threw: "PERMISSION_DENIED" });
			// Each answer is the one the node's own member by the same rule gets.
			for (const [inheritedName, ownName] of [
				["inherited", "ownData"],
				["unruled", "ownUnruled"]
			]) {
				expect(await api.reader.read(path, inheritedName), inheritedName).toEqual(await api.reader.read(path, ownName));
				expect(await api.reader.peek(path, inheritedName), inheritedName).toEqual(await api.reader.peek(path, ownName));
			}
			expect(await api.reader.call(path, "bye")).toEqual(await api.reader.call(path, "ownBye"));
			expect(await api.reader.call(path, "hello")).toEqual(await api.reader.call(path, "ownHello"));
			// An inherited member is `in` the node and never among its own keys, whoever reads; the module is handed its own
			// view of the prototype, never the object.
			for (const name of ["inherited", "unruled"]) {
				expect(await api.reader.shown(path, name, prototype), name).toEqual({ has: true, own: false, same: false });
			}
		});

		it.each(PATHS)("%s: the prototype a module is handed reads and lists each member as the node does", async (path) => {
			await build({ defaultPolicy: "deny", rules });
			const deep = { deepRuled: 1, deepUnruled: 2 };
			const prototype = Object.assign(Object.create(deep), {
				inherited: 5,
				unruled: 6,
				hello() {
					return "hi";
				}
			});
			const node = at(path);
			expect(Reflect.setPrototypeOf(node, prototype)).toBe(true);
			// The host is handed the object itself.
			expect(Object.getPrototypeOf(node)).toBe(prototype);
			expect(node.__proto__).toBe(prototype);
			// A module reads a member from the prototype under the rule it reads it through the node under, and is refused
			// the same way where it has none.
			expect(await api.reader.read(path, "inherited", 1)).toBe(5);
			expect(await api.reader.read(path, "unruled", 1)).toEqual({ threw: "PERMISSION_DENIED" });
			expect(await api.reader.peek(path, "inherited", 1)).toEqual({ threw: "PERMISSION_DENIED" });
			const throughNode = await api.reader.refusal(path, "unruled", 0);
			expect(throughNode.code).toBe("PERMISSION_DENIED");
			expect(await api.reader.refusal(path, "unruled", 1)).toEqual(throughNode);
			// Each prototype further up is read the same way.
			expect(await api.reader.read(path, "deepRuled", 2)).toBe(1);
			expect(await api.reader.read(path, "deepRuled", 1)).toBe(1);
			expect(await api.reader.read(path, "deepUnruled", 2)).toEqual({ threw: "PERMISSION_DENIED" });
			expect(await api.reader.refusal(path, "deepUnruled", 2)).toEqual(await api.reader.refusal(path, "deepUnruled", 0));
			// Its listings leave out what the module may not read; `in` answers as for a member of the node's own.
			expect(await api.reader.listed(path, prototype, ["inherited", "unruled", "hello", "deepRuled", "deepUnruled"])).toEqual({
				same: false,
				stable: true,
				keys: ["inherited", "hello"],
				ownKeys: ["inherited", "hello"],
				forIn: ["inherited", "hello", "deepRuled"],
				viewForIn: ["inherited", "hello", "deepRuled"],
				spread: ["inherited", "hello"],
				json: '{"inherited":5}',
				has: [true, true, true, true, true],
				described: [true, false, true, false, false]
			});
			// A write through it is a write at the node's path: refused to a module that does not own the node.
			expect(await api.reader.write(path, "written", 1)).toBe("LOOSE_SET_NOT_OWNED");
			expect(Object.hasOwn(prototype, "written")).toBe(false);
		});

		it.each(PATHS)("%s: an inherited object member the module may read nothing beneath is left out of its listings", async (path) => {
			await build({ defaultPolicy: "deny", rules });
			const node = at(path);
			expect(Reflect.setPrototypeOf(node, { nothing: { a: 1 }, partly: { a: 1, b: 2 } })).toBe(true);
			// The same members, held by the node itself.
			node.ownNothing = { a: 1 };
			node.ownPartly = { a: 1, b: 2 };
			// Plain JS lists both members; the module may read nothing beneath `nothing` and one leaf of `partly`, so
			// `nothing` is left out as `ownNothing` is, and `partly` is listed holding the leaf it may read.
			expect(await api.reader.objectListing(path)).toEqual({
				own: ["ownPartly"],
				keys: ["partly"],
				ownKeys: ["partly"],
				forIn: ["partly"],
				viewForIn: ["partly"],
				spread: ["partly"],
				json: '{"partly":{"a":1}}',
				has: [true, true, true],
				partly: [1, ["a"]]
			});
		});

		it("the module owning the node writes through the prototype it is handed, onto the object", async () => {
			await build({ defaultPolicy: "deny", rules });
			const prototype = { inherited: 5 };
			expect(await api.ev.change("ns", prototype)).toBe("done");
			expect(await api.ev.write("written", 1)).toBe("done");
			expect(prototype.written).toBe(1);
		});

		it.each(PATHS)("%s: a closed node holds the checked prototype for every holder", async (path) => {
			await build({ defaultPolicy: "deny", rules });
			const prototype = { inherited: 5, unruled: 6 };
			const node = at(path);
			Object.setPrototypeOf(node, prototype);
			Object.freeze(node);
			// The host reads through it; the object itself is no longer what the closed node reports.
			expect(Object.getPrototypeOf(node)).not.toBe(prototype);
			expect(Object.getPrototypeOf(node)).toBe(Object.getPrototypeOf(node));
			expect([Object.getPrototypeOf(node).inherited, Object.getPrototypeOf(node).unruled, node.unruled]).toEqual([5, 6, 6]);
			// It takes only the prototype it reports now.
			expect(Reflect.setPrototypeOf(node, Object.getPrototypeOf(node))).toBe(true);
			expect(Reflect.setPrototypeOf(node, prototype)).toBe(false);
			expect(Reflect.setPrototypeOf(node, {})).toBe(false);
			expect(await api.reader.read(path, "inherited", 1)).toBe(5);
			expect(await api.reader.read(path, "unruled", 1)).toEqual({ threw: "PERMISSION_DENIED" });
			expect(await api.reader.viewKeys(path)).toEqual(["inherited"]);
		});

		it("the module that set the prototype reads what it inherits as it reads its own member", async () => {
			await build({ defaultPolicy: "deny", rules });
			expect(await api.ev.change("ns", { inherited: 5 })).toBe("done");
			api.ev.ownData = 5;
			expect(await api.ev.read("inherited")).toEqual(await api.ev.read("ownData"));
		});
	});
});
